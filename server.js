
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'api/uploads/' });

app.post('/api/facturas/cargar', upload.fields([{ name: 'xml', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]), (req, res) => {
    try {
        const xmlFile = req.files.xml ? req.files.xml[0] : null;
        if (!xmlFile) return res.status(400).json({ error: 'XML requerido' });

        const xmlText = fs.readFileSync(xmlFile.path, 'utf8');
        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
        const data = parser.parse(xmlText);
        res.json({ ok: true, parsed: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(4000, () => console.log('Servidor corriendo en http://localhost:4000'));
