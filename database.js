const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'crm.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initSchema() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS Pais (
      CodigoPaisNormalizado TEXT PRIMARY KEY,
      Nombre TEXT,
      Region TEXT,
      ReferenciaIndice TEXT,
      LinkFichaPais TEXT,
      PersonaReferenciaOportun TEXT,
      Comentarios TEXT
    );

    CREATE TABLE IF NOT EXISTS Entidades (
      CodigoEntidad TEXT PRIMARY KEY,
      Compania TEXT NOT NULL,
      Region TEXT,
      Tipo TEXT,
      CodigoPaisNormalizado TEXT REFERENCES Pais(CodigoPaisNormalizado),
      FiscalCode TEXT,
      LEI TEXT,
      Ticker TEXT,
      DunsNumber TEXT,
      Direccion TEXT,
      Comentarios TEXT
    );

    CREATE TABLE IF NOT EXISTS Contactos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      CodigoEntidad TEXT NOT NULL REFERENCES Entidades(CodigoEntidad),
      Nombre TEXT,
      Cargo TEXT,
      Email TEXT,
      Telefono1 TEXT,
      Telefono2 TEXT,
      Via TEXT,
      FechaUltimoContacto TEXT,
      DemorarContactoAfecha TEXT,
      ProbabilidadExito TEXT,
      Linkedin TEXT,
      Comentarios TEXT
    );

    CREATE TABLE IF NOT EXISTS Oportunidades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      CodigoEntidad TEXT NOT NULL REFERENCES Entidades(CodigoEntidad),
      Contraparte TEXT,
      OwnerAccount TEXT,
      Entrega TEXT,
      Periodo TEXT,
      Volumen TEXT,
      Precio TEXT,
      SpecsContrapartePCS TEXT,
      ProximosPasosNTGY TEXT,
      ProximosPasosContraparte TEXT,
      Timing TEXT,
      Origen TEXT,
      Comentarios TEXT
    );

    CREATE TABLE IF NOT EXISTS Documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      CodigoEntidad TEXT NOT NULL REFERENCES Entidades(CodigoEntidad),
      KYC_S_N TEXT,
      KYC_link TEXT,
      NDA_S_N TEXT,
      FechaExpiracionNDA TEXT,
      NDALink TEXT,
      MSPASN TEXT,
      LinkMSPA TEXT,
      Comentarios TEXT
    );

    CREATE TABLE IF NOT EXISTS Usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nombre TEXT,
      rol TEXT NOT NULL DEFAULT 'user'
    );
  `);

  // Seed default users if not exist
  const count = db.prepare('SELECT COUNT(*) as c FROM Usuarios').get().c;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO Usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)');
    insert.run('admin', 'admin123', 'Administrador', 'admin');
    insert.run('comercial', 'comercial123', 'Usuario Comercial', 'comercial');
  }
}

// Generic CRUD helpers
function getAll(table, filters = {}) {
  const db = getDb();
  let sql = `SELECT * FROM ${table}`;
  const params = [];
  const conditions = [];

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      conditions.push(`${key} LIKE ?`);
      params.push(`%${value}%`);
    }
  });

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  return db.prepare(sql).all(...params);
}

function getById(table, pkField, pkValue) {
  const db = getDb();
  return db.prepare(`SELECT * FROM ${table} WHERE ${pkField} = ?`).get(pkValue);
}

function insert(table, data) {
  const db = getDb();
  const keys = Object.keys(data);
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  return db.prepare(sql).run(...Object.values(data));
}

function update(table, pkField, pkValue, data) {
  const db = getDb();
  const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const sql = `UPDATE ${table} SET ${sets} WHERE ${pkField} = ?`;
  return db.prepare(sql).run(...Object.values(data), pkValue);
}

function remove(table, pkField, pkValue) {
  const db = getDb();
  return db.prepare(`DELETE FROM ${table} WHERE ${pkField} = ?`).run(pkValue);
}

// Entity detail with all related data
function getEntityDetail(codigoEntidad) {
  const db = getDb();
  const entidad = db.prepare('SELECT e.*, p.Nombre as PaisNombre FROM Entidades e LEFT JOIN Pais p ON e.CodigoPaisNormalizado = p.CodigoPaisNormalizado WHERE e.CodigoEntidad = ?').get(codigoEntidad);
  if (!entidad) return null;

  const contactos = db.prepare('SELECT * FROM Contactos WHERE CodigoEntidad = ?').all(codigoEntidad);
  const oportunidades = db.prepare('SELECT * FROM Oportunidades WHERE CodigoEntidad = ?').all(codigoEntidad);
  const documentos = db.prepare('SELECT * FROM Documentos WHERE CodigoEntidad = ?').all(codigoEntidad);
  const pais = entidad.CodigoPaisNormalizado
    ? db.prepare('SELECT * FROM Pais WHERE CodigoPaisNormalizado = ?').get(entidad.CodigoPaisNormalizado)
    : null;

  return { entidad, contactos, oportunidades, documentos, pais };
}

// Search across entities
function searchEntities(query) {
  const db = getDb();
  const sql = `
    SELECT e.*, p.Nombre as PaisNombre,
      (SELECT COUNT(*) FROM Contactos WHERE CodigoEntidad = e.CodigoEntidad) as numContactos,
      (SELECT COUNT(*) FROM Oportunidades WHERE CodigoEntidad = e.CodigoEntidad) as numOportunidades
    FROM Entidades e
    LEFT JOIN Pais p ON e.CodigoPaisNormalizado = p.CodigoPaisNormalizado
    WHERE e.CodigoEntidad LIKE ? OR e.Compania LIKE ? OR e.Region LIKE ? OR p.Nombre LIKE ?
    ORDER BY e.Compania
  `;
  const param = `%${query}%`;
  return db.prepare(sql).all(param, param, param, param);
}

// Dashboard stats
function getDashboardStats() {
  const db = getDb();
  return {
    totalEntidades: db.prepare('SELECT COUNT(*) as c FROM Entidades').get().c,
    totalContactos: db.prepare('SELECT COUNT(*) as c FROM Contactos').get().c,
    totalOportunidades: db.prepare('SELECT COUNT(*) as c FROM Oportunidades').get().c,
    totalDocumentos: db.prepare('SELECT COUNT(*) as c FROM Documentos').get().c,
    totalPaises: db.prepare('SELECT COUNT(*) as c FROM Pais').get().c,
    entidadesPorRegion: db.prepare('SELECT Region, COUNT(*) as total FROM Entidades GROUP BY Region ORDER BY total DESC').all(),
    oportunidadesPorTiming: db.prepare('SELECT Timing, COUNT(*) as total FROM Oportunidades GROUP BY Timing ORDER BY total DESC').all(),
    probabilidadContactos: db.prepare('SELECT ProbabilidadExito, COUNT(*) as total FROM Contactos GROUP BY ProbabilidadExito ORDER BY total DESC').all(),
    entidadesPorTipo: db.prepare('SELECT Tipo, COUNT(*) as total FROM Entidades GROUP BY Tipo ORDER BY total DESC').all(),
    entidadesPorPais: db.prepare(`
      SELECT p.CodigoPaisNormalizado, p.Nombre, p.Region,
        COUNT(e.CodigoEntidad) as numEntidades
      FROM Pais p INNER JOIN Entidades e ON p.CodigoPaisNormalizado = e.CodigoPaisNormalizado
      GROUP BY p.CodigoPaisNormalizado ORDER BY numEntidades DESC
    `).all(),
  };
}

// Bulk import
function bulkImport(table, rows) {
  const db = getDb();
  let inserted = 0;
  let updated = 0;
  let errors = [];

  const transaction = db.transaction((rows) => {
    for (const row of rows) {
      try {
        if (table === 'Pais') {
          const existing = db.prepare('SELECT 1 FROM Pais WHERE CodigoPaisNormalizado = ?').get(row.CodigoPaisNormalizado);
          if (existing) {
            const { CodigoPaisNormalizado, ...rest } = row;
            update('Pais', 'CodigoPaisNormalizado', CodigoPaisNormalizado, rest);
            updated++;
          } else {
            insert('Pais', row);
            inserted++;
          }
        } else if (table === 'Entidades') {
          const existing = db.prepare('SELECT 1 FROM Entidades WHERE CodigoEntidad = ?').get(row.CodigoEntidad);
          if (existing) {
            const { CodigoEntidad, ...rest } = row;
            update('Entidades', 'CodigoEntidad', CodigoEntidad, rest);
            updated++;
          } else {
            insert('Entidades', row);
            inserted++;
          }
        } else {
          // Auto-generate codes for child tables if missing
          if (table === 'Contactos' && !row.CodigoContacto) {
            row.CodigoContacto = generateNextCode('Contactos', 'CodigoContacto', 'CON');
          } else if (table === 'Oportunidades' && !row.CodigoOportunidad) {
            row.CodigoOportunidad = generateNextCode('Oportunidades', 'CodigoOportunidad', 'OPO');
          } else if (table === 'Documentos' && !row.CodigoDocumento) {
            row.CodigoDocumento = generateNextCode('Documentos', 'CodigoDocumento', 'DOC');
          }
          insert(table, row);
          inserted++;
        }
      } catch (e) {
        errors.push({ row, error: e.message });
      }
    }
  });

  transaction(rows);
  return { inserted, updated, errors };
}

function clearTable(table) {
  const db = getDb();
  db.prepare(`DELETE FROM ${table}`).run();
}

// Run migrations for new columns (codes in child tables)
function runMigrations() {
  const db = getDb();

  const migrations = [
    { table: 'Contactos', column: 'CodigoContacto', prefix: 'CON', index: 'idx_contactos_codigo' },
    { table: 'Oportunidades', column: 'CodigoOportunidad', prefix: 'OPO', index: 'idx_oportunidades_codigo' },
    { table: 'Documentos', column: 'CodigoDocumento', prefix: 'DOC', index: 'idx_documentos_codigo' },
  ];

  for (const m of migrations) {
    // Check if column exists
    const cols = db.prepare(`PRAGMA table_info(${m.table})`).all();
    const hasColumn = cols.some(c => c.name === m.column);

    if (!hasColumn) {
      db.exec(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} TEXT`);
      console.log(`Migration: added ${m.column} to ${m.table}`);

      // Backfill existing records
      const rows = db.prepare(`SELECT id FROM ${m.table} ORDER BY id`).all();
      const updateStmt = db.prepare(`UPDATE ${m.table} SET ${m.column} = ? WHERE id = ?`);
      rows.forEach((row, i) => {
        const code = `${m.prefix}-${String(i + 1).padStart(5, '0')}`;
        updateStmt.run(code, row.id);
      });
      if (rows.length > 0) {
        console.log(`Migration: backfilled ${rows.length} codes in ${m.table}`);
      }
    }

    // Create unique index if not exists
    try {
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ${m.index} ON ${m.table}(${m.column})`);
    } catch (e) {
      // Index may already exist
    }
  }
}

// Generate next sequential code for a table
function generateNextCode(table, codeColumn, prefix) {
  const db = getDb();
  const row = db.prepare(
    `SELECT ${codeColumn} FROM ${table} WHERE ${codeColumn} IS NOT NULL ORDER BY ${codeColumn} DESC LIMIT 1`
  ).get();

  let nextNum = 1;
  if (row && row[codeColumn]) {
    const match = row[codeColumn].match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return `${prefix}-${String(nextNum).padStart(5, '0')}`;
}

// Get list of entidades for dropdown
function getEntidadesList() {
  const db = getDb();
  return db.prepare('SELECT CodigoEntidad, Compania FROM Entidades ORDER BY Compania').all();
}

// Check if entity exists
function entityExists(codigoEntidad) {
  const db = getDb();
  return !!db.prepare('SELECT 1 FROM Entidades WHERE CodigoEntidad = ?').get(codigoEntidad);
}

// AI Query processor
function processAiQuery(message) {
  const db = getDb();
  const msg = message.toLowerCase().trim();

  // Check for country names dynamically
  const paises = db.prepare('SELECT CodigoPaisNormalizado, Nombre FROM Pais').all();
  for (const pais of paises) {
    if (msg.includes(pais.Nombre.toLowerCase()) || msg.includes(pais.CodigoPaisNormalizado.toLowerCase())) {
      const entidades = db.prepare(`
        SELECT e.CodigoEntidad, e.Compania, e.Tipo, e.Region
        FROM Entidades e
        WHERE e.CodigoPaisNormalizado = ?
        ORDER BY e.Compania
      `).all(pais.CodigoPaisNormalizado);

      const oportunidades = db.prepare(`
        SELECT o.Contraparte, o.Volumen, o.Precio, o.Timing, e.Compania
        FROM Oportunidades o
        JOIN Entidades e ON o.CodigoEntidad = e.CodigoEntidad
        WHERE e.CodigoPaisNormalizado = ?
      `).all(pais.CodigoPaisNormalizado);

      const contactos = db.prepare(`
        SELECT c.Nombre, c.Cargo, c.Email, e.Compania
        FROM Contactos c
        JOIN Entidades e ON c.CodigoEntidad = e.CodigoEntidad
        WHERE e.CodigoPaisNormalizado = ?
      `).all(pais.CodigoPaisNormalizado);

      let resp = `**${pais.Nombre}** (${pais.CodigoPaisNormalizado})\n\n`;
      resp += `**Entidades (${entidades.length}):**\n`;
      if (entidades.length === 0) resp += 'No hay entidades registradas.\n';
      else entidades.forEach(e => { resp += `- ${e.Compania} (${e.CodigoEntidad}) - ${e.Tipo || 'N/A'}\n`; });

      resp += `\n**Oportunidades (${oportunidades.length}):**\n`;
      if (oportunidades.length === 0) resp += 'No hay oportunidades.\n';
      else oportunidades.forEach(o => { resp += `- ${o.Compania}: ${o.Contraparte || 'N/A'} - Vol: ${o.Volumen || 'N/A'}, Precio: ${o.Precio || 'N/A'}, Timing: ${o.Timing || 'N/A'}\n`; });

      resp += `\n**Contactos (${contactos.length}):**\n`;
      if (contactos.length === 0) resp += 'No hay contactos.\n';
      else contactos.forEach(c => { resp += `- ${c.Nombre || 'N/A'} (${c.Cargo || 'N/A'}) - ${c.Compania}\n`; });

      return resp;
    }
  }

  // Documents / NDA expiring
  if (msg.includes('nda') || msg.includes('expiracion') || msg.includes('vencimiento') || msg.includes('documento')) {
    const docs = db.prepare(`
      SELECT d.*, e.Compania
      FROM Documentos d
      JOIN Entidades e ON d.CodigoEntidad = e.CodigoEntidad
      WHERE d.NDA_S_N = 'Sí' OR d.NDA_S_N = 'Si' OR d.NDA_S_N = 'S'
      ORDER BY d.FechaExpiracionNDA ASC
    `).all();

    let resp = `**Documentos NDA (${docs.length} con NDA activo):**\n\n`;
    if (docs.length === 0) resp += 'No se encontraron NDAs activos.\n';
    else docs.forEach(d => {
      resp += `- **${d.Compania}** (${d.CodigoEntidad}): Expira ${d.FechaExpiracionNDA || 'sin fecha'}`;
      if (d.KYC_S_N) resp += ` | KYC: ${d.KYC_S_N}`;
      if (d.MSPASN) resp += ` | MSPA: ${d.MSPASN}`;
      resp += '\n';
    });
    return resp;
  }

  // Active opportunities
  if (msg.includes('oportunidad') || msg.includes('pipeline') || msg.includes('oportunidades')) {
    const byTiming = db.prepare(`
      SELECT Timing, COUNT(*) as total FROM Oportunidades GROUP BY Timing ORDER BY total DESC
    `).all();

    const top = db.prepare(`
      SELECT o.Contraparte, o.Volumen, o.Precio, o.Timing, o.Origen, e.Compania
      FROM Oportunidades o
      JOIN Entidades e ON o.CodigoEntidad = e.CodigoEntidad
      ORDER BY o.id DESC LIMIT 10
    `).all();

    let resp = `**Resumen de Oportunidades:**\n\n`;
    resp += `**Por Timing:**\n`;
    byTiming.forEach(t => { resp += `- ${t.Timing || 'Sin timing'}: ${t.total}\n`; });

    resp += `\n**Ultimas 10 oportunidades:**\n`;
    top.forEach(o => {
      resp += `- **${o.Compania}**: ${o.Contraparte || 'N/A'} - Vol: ${o.Volumen || 'N/A'}, Timing: ${o.Timing || 'N/A'}\n`;
    });
    return resp;
  }

  // Next steps
  if (msg.includes('accion') || msg.includes('pendiente') || msg.includes('paso') || msg.includes('proxim') || msg.includes('próxim')) {
    const pasos = db.prepare(`
      SELECT o.Contraparte, o.ProximosPasosNTGY, o.ProximosPasosContraparte, o.Timing, e.Compania
      FROM Oportunidades o
      JOIN Entidades e ON o.CodigoEntidad = e.CodigoEntidad
      WHERE o.ProximosPasosNTGY IS NOT NULL AND o.ProximosPasosNTGY != ''
         OR o.ProximosPasosContraparte IS NOT NULL AND o.ProximosPasosContraparte != ''
      ORDER BY o.id DESC
    `).all();

    let resp = `**Proximos Pasos Pendientes (${pasos.length}):**\n\n`;
    if (pasos.length === 0) resp += 'No hay acciones pendientes registradas.\n';
    else pasos.forEach(p => {
      resp += `- **${p.Compania}** (${p.Contraparte || 'N/A'}):\n`;
      if (p.ProximosPasosNTGY) resp += `  NTGY: ${p.ProximosPasosNTGY}\n`;
      if (p.ProximosPasosContraparte) resp += `  Contraparte: ${p.ProximosPasosContraparte}\n`;
    });
    return resp;
  }

  // Contact follow-up
  if (msg.includes('contacto') || msg.includes('seguimiento')) {
    const contactos = db.prepare(`
      SELECT c.Nombre, c.Cargo, c.Email, c.DemorarContactoAfecha, c.FechaUltimoContacto, c.ProbabilidadExito, e.Compania
      FROM Contactos c
      JOIN Entidades e ON c.CodigoEntidad = e.CodigoEntidad
      WHERE c.DemorarContactoAfecha IS NOT NULL AND c.DemorarContactoAfecha != ''
      ORDER BY c.DemorarContactoAfecha ASC
    `).all();

    let resp = `**Seguimiento de Contactos (${contactos.length} con fecha programada):**\n\n`;
    if (contactos.length === 0) resp += 'No hay contactos con seguimiento programado.\n';
    else contactos.forEach(c => {
      resp += `- **${c.Nombre || 'N/A'}** (${c.Compania}) - ${c.Cargo || 'N/A'}\n`;
      resp += `  Demorar a: ${c.DemorarContactoAfecha} | Ultimo contacto: ${c.FechaUltimoContacto || 'N/A'} | Prob: ${c.ProbabilidadExito || 'N/A'}\n`;
    });
    return resp;
  }

  // General summary / dashboard
  if (msg.includes('resumen') || msg.includes('dashboard') || msg.includes('general') || msg.includes('estadistica')) {
    const stats = getDashboardStats();
    let resp = `**Resumen General del CRM:**\n\n`;
    resp += `- **Entidades:** ${stats.totalEntidades}\n`;
    resp += `- **Contactos:** ${stats.totalContactos}\n`;
    resp += `- **Oportunidades:** ${stats.totalOportunidades}\n`;
    resp += `- **Documentos:** ${stats.totalDocumentos}\n`;
    resp += `- **Paises:** ${stats.totalPaises}\n`;

    if (stats.entidadesPorRegion.length > 0) {
      resp += `\n**Entidades por Region:**\n`;
      stats.entidadesPorRegion.forEach(r => { resp += `- ${r.Region || 'Sin region'}: ${r.total}\n`; });
    }
    if (stats.oportunidadesPorTiming.length > 0) {
      resp += `\n**Oportunidades por Timing:**\n`;
      stats.oportunidadesPorTiming.forEach(t => { resp += `- ${t.Timing || 'Sin timing'}: ${t.total}\n`; });
    }
    return resp;
  }

  // Default: help menu
  return `**Asistente CRM GNL - Opciones disponibles:**\n\n` +
    `Puedes preguntarme sobre:\n` +
    `- **Nombre de un pais** (ej: "India", "Vietnam") → Entidades, oportunidades y contactos del pais\n` +
    `- **"NDA"** o **"documentos"** → NDAs y documentos con fechas de expiracion\n` +
    `- **"Oportunidades"** o **"pipeline"** → Resumen de oportunidades por timing\n` +
    `- **"Proximos pasos"** o **"acciones"** → Acciones pendientes en oportunidades\n` +
    `- **"Contactos"** o **"seguimiento"** → Contactos con seguimiento programado\n` +
    `- **"Resumen"** o **"dashboard"** → Estadisticas generales del CRM\n`;
}

// Build context string for OpenAI based on message keywords
function getCrmContext(message) {
  const db = getDb();
  const msg = message.toLowerCase();
  const lines = [];

  // Always include global summary
  const stats = getDashboardStats();
  lines.push('=== RESUMEN GLOBAL CRM ===');
  lines.push(`Entidades: ${stats.totalEntidades} | Contactos: ${stats.totalContactos} | Oportunidades: ${stats.totalOportunidades} | Documentos: ${stats.totalDocumentos} | Países: ${stats.totalPaises}`);
  if (stats.oportunidadesPorTiming && stats.oportunidadesPorTiming.length > 0) {
    lines.push('Pipeline por timing: ' + stats.oportunidadesPorTiming.map(t => `${t.Timing || 'Sin timing'}: ${t.total}`).join(', '));
  }

  // Always include full entity list
  const todasEntidades = db.prepare('SELECT CodigoEntidad, Compania, Tipo, CodigoPaisNormalizado, Region FROM Entidades ORDER BY Compania').all();
  lines.push('\n=== ENTIDADES ===');
  todasEntidades.forEach(e => {
    lines.push(`${e.Compania} [${e.CodigoEntidad}] | Tipo: ${e.Tipo || 'N/A'} | País: ${e.CodigoPaisNormalizado || 'N/A'} | Región: ${e.Region || 'N/A'}`);
  });

  // Always include all opportunities
  const todasOpors = db.prepare(`
    SELECT o.CodigoOportunidad, o.Contraparte, o.Volumen, o.Precio, o.Timing, o.Origen,
           o.ProximosPasosNTGY, o.ProximosPasosContraparte, o.Periodo, o.Entrega,
           e.Compania, e.CodigoPaisNormalizado
    FROM Oportunidades o JOIN Entidades e ON o.CodigoEntidad = e.CodigoEntidad
    ORDER BY o.Timing, e.Compania
  `).all();
  lines.push('\n=== OPORTUNIDADES / PIPELINE ===');
  todasOpors.forEach(o => {
    lines.push(`[${o.CodigoOportunidad}] ${o.Compania} (${o.CodigoPaisNormalizado}) | Contraparte: ${o.Contraparte || 'N/A'} | Vol: ${o.Volumen || 'N/A'} | Precio: ${o.Precio || 'N/A'} | Timing: ${o.Timing || 'N/A'} | Entrega: ${o.Entrega || 'N/A'} | Próximos pasos NTGY: ${o.ProximosPasosNTGY || 'N/A'}`);
  });

  // Always include all contacts
  const todosContactos = db.prepare(`
    SELECT c.Nombre, c.Cargo, c.Email, c.Via, c.FechaUltimoContacto, c.DemorarContactoAfecha,
           c.ProbabilidadExito, c.Comentarios, e.Compania, e.CodigoPaisNormalizado
    FROM Contactos c JOIN Entidades e ON c.CodigoEntidad = e.CodigoEntidad
    ORDER BY c.DemorarContactoAfecha ASC, e.Compania
  `).all();
  lines.push('\n=== CONTACTOS ===');
  todosContactos.forEach(c => {
    lines.push(`${c.Nombre || 'N/A'} (${c.Compania}, ${c.CodigoPaisNormalizado}) | ${c.Cargo || 'N/A'} | Último contacto: ${c.FechaUltimoContacto || 'N/A'} | Seguimiento: ${c.DemorarContactoAfecha || 'N/A'} | Prob: ${c.ProbabilidadExito || 'N/A'}${c.Comentarios ? ' | Nota: ' + c.Comentarios : ''}`);
  });

  // Always include documents
  const todosDocs = db.prepare(`
    SELECT d.NDA_S_N, d.FechaExpiracionNDA, d.KYC_S_N, d.MSPASN, e.Compania, e.CodigoEntidad
    FROM Documentos d JOIN Entidades e ON d.CodigoEntidad = e.CodigoEntidad
    ORDER BY d.FechaExpiracionNDA ASC
  `).all();
  lines.push('\n=== DOCUMENTOS / NDAs / KYC ===');
  todosDocs.forEach(d => {
    lines.push(`${d.Compania} [${d.CodigoEntidad}]: NDA=${d.NDA_S_N || 'N/A'}, Expira=${d.FechaExpiracionNDA || 'N/A'}, KYC=${d.KYC_S_N || 'N/A'}, MSPA=${d.MSPASN || 'N/A'}`);
  });

  // Country-specific deep context if a country is mentioned
  const paises = db.prepare('SELECT CodigoPaisNormalizado, Nombre, Region, ReferenciaIndice, Comentarios FROM Pais').all();
  lines.push('\n=== PAÍSES ===');
  paises.forEach(p => {
    lines.push(`${p.Nombre} [${p.CodigoPaisNormalizado}] | Región: ${p.Region || 'N/A'} | Índice: ${p.ReferenciaIndice || 'N/A'}${p.Comentarios ? ' | ' + p.Comentarios : ''}`);
  });

  return lines.join('\n');
}

module.exports = {
  getDb,
  initSchema,
  runMigrations,
  generateNextCode,
  getAll,
  getById,
  insert,
  update,
  remove,
  getEntityDetail,
  searchEntities,
  getDashboardStats,
  bulkImport,
  clearTable,
  getEntidadesList,
  entityExists,
  processAiQuery,
  getCrmContext,
};
