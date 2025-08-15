import express from 'express';
import cors from 'cors';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parseCfdi } from './cfdi.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const DB_FILE = process.env.DB_FILE || 'db/facturacion.db';
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'api/uploads';
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const db = new Database(DB_FILE);
db.exec(fs.readFileSync('db/schema.sql','utf-8'));

const uid = () => crypto.randomBytes(6).toString('hex');

function auth(req,res,next){
  const h=req.headers.authorization||''; const token=h.startsWith('Bearer ')?h.slice(7):null;
  if(!token) return res.status(401).json({error:'No token'});
  try{ req.user = jwt.verify(token, JWT_SECRET); next(); }catch(e){ return res.status(401).json({error:'Invalid token'}); }
}
function role(...allowed){ return (req,res,next)=>{ if(!allowed.includes(req.user.role)) return res.status(403).json({error:'Forbidden'}); next(); } }

// Storage
const storage = multer.diskStorage({
  destination: (req,file,cb)=>cb(null, UPLOAD_DIR),
  filename: (req,file,cb)=>cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

// ===== Auth =====
app.post('/api/auth/seed', (req,res)=>{
  const {email, full_name, role_name='Admin'} = req.body||{};
  if(!email) return res.status(400).json({error:'email requerido'});
  const role = db.prepare('SELECT id FROM roles WHERE name=?').get(role_name);
  try{ db.prepare('INSERT INTO users(email,password_hash,full_name,role_id) VALUES (?,?,?,?)').run(email,'demo',full_name||'',role.id);
       res.json({ok:true}); }catch(e){ res.status(400).json({error:'usuario ya existe'}); }
});
app.post('/api/auth/login', (req,res)=>{
  const {email, password} = req.body||{};
  const u = db.prepare('SELECT u.*, r.name as role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE email=?').get(email);
  if(!u) return res.status(401).json({error:'Usuario no encontrado'});
  const token = jwt.sign({id:u.id,email,role:u.role_name}, JWT_SECRET, {expiresIn:'12h'});
  res.json({token, user:{id:u.id,email,role:u.role_name,full_name:u.full_name}});
});

// ===== KPI ping =====
app.get('/api/reportes/kpis', auth, (req,res)=>{
  const total = db.prepare('SELECT COALESCE(SUM(total),0) t FROM invoices').get().t;
  res.json({totalComprado:0,totalFacturado:total,margen:0,pendientes:0});
});

// ===== CFDI upload =====
const uploadFields = upload.fields([{name:'xml',maxCount:1},{name:'pdf',maxCount:1}]);
app.post('/api/facturas/cargar', auth, role('Admin','Facturacion'), uploadFields, (req,res)=>{
  try{
    const xmlFile = (req.files?.xml||[])[0];
    const pdfFile = (req.files?.pdf||[])[0];
    if(!xmlFile) return res.status(400).json({error:'XML requerido'});
    const xmlText = fs.readFileSync(xmlFile.path,'utf-8');
    const data = parseCfdi(xmlText);

    // Dedupe by UUID
    if(data.timbre.uuid){
      const ex = db.prepare('SELECT id FROM invoices WHERE uuid=?').get(data.timbre.uuid);
      if(ex) return res.status(409).json({error:'UUID ya existe', uuid:data.timbre.uuid, id:ex.id});
    }

    // Upsert client by RFC
    let clientId = null;
    if(data.receptor?.rfc){
      const c = db.prepare('SELECT id FROM clients WHERE rfc=?').get(data.receptor.rfc);
      if(c) clientId = c.id;
      else{
        const ins = db.prepare('INSERT INTO clients(rfc,razon_social,regimen_fiscal,cp,email) VALUES (?,?,?,?,?)')
                      .run(data.receptor.rfc, data.receptor.nombre||data.receptor.rfc, '', '', '');
        clientId = ins.lastInsertRowid;
      }
    }

    const id = uid();
    db.prepare(`INSERT INTO invoices
      (id, client_id, concepto, subtotal, total, fecha_emision, rfc_emisor, nombre_emisor, rfc_receptor, nombre_receptor,
       uso_cfdi, metodo_pago, forma_pago, status, uuid, xml_path, pdf_path, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, clientId, (data.conceptos[0]?.descripcion||'SERVICIO'), data.subtotal, data.total, data.fecha,
           data.emisor.rfc, data.emisor.nombre, data.receptor.rfc, data.receptor.nombre,
           data.usoCFDI, data.metodoPago, data.formaPago, 'stamped', data.timbre.uuid,
           path.basename(xmlFile.path), pdfFile?path.basename(pdfFile.path):null, req.user.id);

    const insItem = db.prepare('INSERT INTO invoice_items(invoice_id,clave_prodserv,clave_unidad,descripcion,cantidad,valor_unitario,importe) VALUES (?,?,?,?,?,?,?)');
    for(const it of data.conceptos){
      insItem.run(id, it.claveProdServ, it.claveUnidad, it.descripcion, it.cantidad, it.valorUnitario, it.importe);
    }

    db.prepare('INSERT INTO audit_log(user_id,entity,entity_id,action,payload) VALUES (?,?,?,?,?)')
      .run(req.user.id, 'invoice', id, 'import_cfdi', JSON.stringify({uuid:data.timbre.uuid}));

    res.json({
      ok:true, id, uuid:data.timbre.uuid, fecha:data.fecha,
      emisor:{rfc:data.emisor.rfc,nombre:data.emisor.nombre},
      receptor:{rfc:data.receptor.rfc,nombre:data.receptor.nombre},
      totales:{subtotal:data.subtotal,total:data.total},
      archivos:{
        xml:`/api/files/${path.basename(xmlFile.path)}`,
        pdf: pdfFile?`/api/files/${path.basename(pdfFile.path)}`:null
      }
    });
  }catch(e){ console.error(e); res.status(500).json({error:'Fallo al procesar CFDI', detail:e.message}); }
});

// ===== Downloads =====
app.get('/api/files/:file', auth, (req,res)=>{
  const full = path.join(UPLOAD_DIR, path.basename(req.params.file));
  if(!fs.existsSync(full)) return res.status(404).end();
  res.download(full);
});

app.get('/', (req,res)=>res.json({ok:true, service:'Facturacion CFDI Full'}));
app.listen(PORT, ()=>console.log('API en http://localhost:'+PORT));
