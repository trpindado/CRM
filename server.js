// Load .env if present (no extra dependency)
const _envPath = require('path').join(__dirname, '.env');
if (require('fs').existsSync(_envPath)) {
  require('fs').readFileSync(_envPath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [k, ...v] = trimmed.split('=');
    if (k?.trim()) process.env[k.trim()] = v.join('=').trim();
  });
  console.log('OpenAI disponible:', !!process.env.OPENAI_API_KEY);
}

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const db = require('./database');

const SYSTEM_PROMPT = `Eres un asistente comercial experto del CRM GNL (Gas Natural Licuado) de Naturgy.
Respondes siempre en español, de forma clara, útil y conversacional.

Tienes acceso al contexto completo de la base de datos del CRM (entidades, contactos, oportunidades, documentos, países).
Usa esos datos para responder, analizar, comparar y dar recomendaciones comerciales.

Puedes y debes:
- Analizar el pipeline comercial y dar insights sobre oportunidades
- Resumir el estado de relaciones con contrapartes y países
- Sugerir próximos pasos comerciales basándote en los datos disponibles
- Responder preguntas generales sobre el sector LNG/GNL y mercados de gas
- Hacer cálculos, comparativas y rankings con los datos del CRM
- Dar contexto de mercado cuando sea relevante

Formato: usa **negrita** para destacar cifras, nombres y fechas clave. Usa listas cuando ayude a la claridad.
Si no tienes datos suficientes sobre algo muy específico, dilo brevemente y ofrece lo que sí puedes aportar.`;

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

// ============ USERS MANAGEMENT ============
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.rol === 'admin') return next();
  res.status(403).json({ error: 'Solo administradores' });
}

// Admin: list all users
app.get('/api/usuarios', requireAdmin, (req, res) => {
  const users = db.getDb().prepare('SELECT id, username, nombre, rol FROM Usuarios').all();
  res.json(users);
});

// Admin: create user
app.post('/api/usuarios', requireAdmin, (req, res) => {
  try {
    const { username, password, nombre, rol } = req.body;
    db.getDb().prepare('INSERT INTO Usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)').run(username, password, nombre, rol);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Admin: get user by id (includes password)
app.get('/api/usuarios/:id', requireAdmin, (req, res) => {
  const user = db.getDb().prepare('SELECT id, username, password, nombre, rol FROM Usuarios WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

// Admin: update any user
app.put('/api/usuarios/:id', requireAdmin, (req, res) => {
  try {
    const { username, nombre, rol, password } = req.body;
    if (password) {
      db.getDb().prepare('UPDATE Usuarios SET username = ?, nombre = ?, rol = ?, password = ? WHERE id = ?').run(username, nombre, rol, password, req.params.id);
    } else {
      db.getDb().prepare('UPDATE Usuarios SET username = ?, nombre = ?, rol = ? WHERE id = ?').run(username, nombre, rol, req.params.id);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Admin: delete user
app.delete('/api/usuarios/:id', requireAdmin, (req, res) => {
  db.getDb().prepare('DELETE FROM Usuarios WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Any user: get own profile
app.get('/api/mi-perfil', requireAuth, (req, res) => {
  const user = db.getDb().prepare('SELECT id, username, password, nombre, rol FROM Usuarios WHERE id = ?').get(req.session.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

// Any user: update own password
app.put('/api/mi-perfil', requireAuth, (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.trim() === '') {
      return res.status(400).json({ error: 'La contraseña no puede estar vacía' });
    }
    db.getDb().prepare('UPDATE Usuarios SET password = ? WHERE id = ?').run(password, req.session.user.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============ ENTIDADES LIST (lightweight for dropdowns) ============
app.get('/api/entidades-list', requireAuth, (req, res) => {
  res.json(db.getEntidadesList());
});

app.get('/api/paises-list', requireAuth, (req, res) => {
  res.json(db.getPaisesList());
});

// ============ AI CHAT ============
app.get('/api/ai/status', (req, res) => {
  res.json({ openaiAvailable: !!process.env.OPENAI_API_KEY });
});

app.post('/api/ai/chat', requireAuth, async (req, res) => {
  const { message, useAI = false } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Mensaje vacío' });

  if (useAI && process.env.OPENAI_API_KEY) {
    try {
      const { OpenAI } = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const context = db.getCrmContext(message);
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + '\n\n' + context },
          { role: 'user', content: message }
        ],
        max_tokens: 1500,
        temperature: 0.5
      });
      return res.json({ response: completion.choices[0].message.content, mode: 'openai' });
    } catch (e) {
      const fallback = db.processAiQuery(message);
      return res.json({ response: '⚠️ OpenAI no disponible, usando respuesta básica.\n\n' + fallback, mode: 'fallback' });
    }
  }

  try {
    const response = db.processAiQuery(message);
    res.json({ response, mode: 'basic' });
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
});
