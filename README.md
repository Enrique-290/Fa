# Backend CFDI Full (JWT + roles + SQLite + UUID dedupe)
1) `npm install`
2) `cp .env.example .env` (opcional editar puerto/secret)
3) `npm start`  → http://localhost:4000

## Flujo
- Crear usuario:
  POST /api/auth/seed  { "email":"admin@demo.com", "full_name":"Admin", "role_name":"Admin" }
- Login:
  POST /api/auth/login { "email":"admin@demo.com", "password":"loquesea" }
- Subir CFDI:
  POST /api/facturas/cargar  (Authorization: Bearer <TOKEN>, form-data: xml, pdf opcional)
- KPIs:
  GET /api/reportes/kpis  (con token)
- Descargar archivo:
  GET /api/files/:file  (con token)
