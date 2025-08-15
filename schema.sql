
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS roles ( id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL );
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role_id INTEGER NOT NULL REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY,
  rfc TEXT NOT NULL,
  razon_social TEXT NOT NULL,
  regimen_fiscal TEXT,
  cp TEXT,
  email TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  concepto TEXT,
  subtotal REAL,
  total REAL,
  fecha_emision TEXT,
  rfc_emisor TEXT,
  nombre_emisor TEXT,
  rfc_receptor TEXT,
  nombre_receptor TEXT,
  uso_cfdi TEXT,
  metodo_pago TEXT,
  forma_pago TEXT,
  status TEXT DEFAULT 'stamped',
  uuid TEXT UNIQUE,
  xml_path TEXT,
  pdf_path TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
  clave_prodserv TEXT,
  clave_unidad TEXT,
  descripcion TEXT,
  cantidad REAL,
  valor_unitario REAL,
  importe REAL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  entity TEXT,
  entity_id TEXT,
  action TEXT,
  payload TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO roles(id,name) VALUES (1,'Admin'),(2,'Facturacion'),(3,'Ventas');
