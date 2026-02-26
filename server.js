const express = require('express');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'crm-gnl-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 hours
}));
app.use(express.static(path.join(__dirname, 'public')));

// File upload config
const upload = multer({ dest: path.join(__dirname, 'uploads') });

// Init database
db.initSchema();
db.runMigrations();

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: 'No autorizado' });
}

// ============ AUTH ============
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.getDb().prepare('SELECT id, username, nombre, rol FROM Usuarios WHERE username = ? AND password = ?').get(username, password);
  if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });
  req.session.user = user;
  res.json({ user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ user: req.session.user });
  }
  res.json({ user: null });
});

// ============ DASHBOARD ============
app.get('/api/dashboard', requireAuth, (req, res) => {
  res.json(db.getDashboardStats());
});

// ============ SEARCH ============
app.get('/api/search', requireAuth, (req, res) => {
  const q = req.query.q || '';
  res.json(db.searchEntities(q));
});

// ============ ENTITY DETAIL ============
app.get('/api/entidades/:codigo/detail', requireAuth, (req, res) => {
  const detail = db.getEntityDetail(req.params.codigo);
  if (!detail) return res.status(404).json({ error: 'Entidad no encontrada' });
  res.json(detail);
});

// ============ GENERIC CRUD ROUTES ============
const tableConfig = {
  paises: { table: 'Pais', pk: 'CodigoPaisNormalizado' },
  entidades: { table: 'Entidades', pk: 'CodigoEntidad' },
  contactos: { table: 'Contactos', pk: 'id', codeField: 'CodigoContacto', codePrefix: 'CON', requiresEntity: true },
  oportunidades: { table: 'Oportunidades', pk: 'id', codeField: 'CodigoOportunidad', codePrefix: 'OPO', requiresEntity: true },
  documentos: { table: 'Documentos', pk: 'id', codeField: 'CodigoDocumento', codePrefix: 'DOC', requiresEntity: true },
};

Object.entries(tableConfig).forEach(([route, config]) => {
  // GET all
  app.get(`/api/${route}`, requireAuth, (req, res) => {
    const filters = { ...req.query };
    delete filters._;
    res.json(db.getAll(config.table, filters));
  });

  // GET by id
  app.get(`/api/${route}/:id`, requireAuth, (req, res) => {
    const item = db.getById(config.table, config.pk, req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    res.json(item);
  });

  // POST create
  app.post(`/api/${route}`, requireAuth, (req, res) => {
    try {
      // Validate CodigoEntidad if required
      if (config.requiresEntity) {
        if (!req.body.CodigoEntidad || req.body.CodigoEntidad.trim() === '') {
          return res.status(400).json({ error: 'CodigoEntidad es obligatorio' });
        }
        if (!db.entityExists(req.body.CodigoEntidad)) {
          return res.status(400).json({ error: `La entidad "${req.body.CodigoEntidad}" no existe` });
        }
      }
      // Auto-generate code if applicable
      if (config.codeField && (!req.body[config.codeField] || req.body[config.codeField].trim() === '')) {
        req.body[config.codeField] = db.generateNextCode(config.table, config.codeField, config.codePrefix);
      }
      const result = db.insert(config.table, req.body);
      res.json({ ok: true, id: result.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // PUT update
  app.put(`/api/${route}/:id`, requireAuth, (req, res) => {
    try {
      // Validate CodigoEntidad if required and changed
      if (config.requiresEntity && req.body.CodigoEntidad) {
        if (req.body.CodigoEntidad.trim() === '') {
          return res.status(400).json({ error: 'CodigoEntidad es obligatorio' });
        }
        if (!db.entityExists(req.body.CodigoEntidad)) {
          return res.status(400).json({ error: `La entidad "${req.body.CodigoEntidad}" no existe` });
        }
      }
      db.update(config.table, config.pk, req.params.id, req.body);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // DELETE
  app.delete(`/api/${route}/:id`, requireAuth, (req, res) => {
    try {
      db.remove(config.table, config.pk, req.params.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
});

// ============ IMPORT EXCEL ============
app.post('/api/import', requireAuth, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se ha proporcionado archivo' });

    const wb = XLSX.readFile(req.file.path);
    const results = {};

    const sheetMap = {
      'Pais': 'Pais',
      'Entidades': 'Entidades',
      'Contactos': 'Contactos',
      'Oportunidades': 'Oportunidades',
      'Documentos': 'Documentos',
    };

    // Import order matters due to foreign keys
    const importOrder = ['Pais', 'Entidades', 'Contactos', 'Oportunidades', 'Documentos'];

    for (const sheetName of importOrder) {
      if (wb.SheetNames.includes(sheetName)) {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws);
        // Clean null/undefined values
        const cleanedRows = rows.map(row => {
          const clean = {};
          Object.entries(row).forEach(([k, v]) => {
            clean[k] = v != null ? String(v) : null;
          });
          return clean;
        });
        results[sheetName] = db.bulkImport(sheetName, cleanedRows);
      }
    }

    // Clean up uploaded file
    const fs = require('fs');
    fs.unlinkSync(req.file.path);

    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ USERS MANAGEMENT (admin only) ============
app.get('/api/usuarios', requireAuth, (req, res) => {
  const users = db.getDb().prepare('SELECT id, username, nombre, rol FROM Usuarios').all();
  res.json(users);
});

app.post('/api/usuarios', requireAuth, (req, res) => {
  try {
    const { username, password, nombre, rol } = req.body;
    db.getDb().prepare('INSERT INTO Usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)').run(username, password, nombre, rol);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/usuarios/:id', requireAuth, (req, res) => {
  db.getDb().prepare('DELETE FROM Usuarios WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ ENTIDADES LIST (lightweight for dropdowns) ============
app.get('/api/entidades-list', requireAuth, (req, res) => {
  res.json(db.getEntidadesList());
});

// ============ AI CHAT ============
app.post('/api/ai/chat', requireAuth, (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Mensaje vacío' });
    }
    const response = db.processAiQuery(message);
    res.json({ response });
  } catch (e) {
    res.status(500).json({ error: 'Error procesando consulta: ' + e.message });
  }
});

// SPA fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CRM GNL corriendo en http://localhost:${PORT}`);
  console.log(`  Usuario: admin / admin123`);
});
