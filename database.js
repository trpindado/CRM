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
      rol TEXT NOT NULL CHECK(rol IN ('admin', 'comercial'))
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

  return { entidad, contactos, oportunidades, documentos };
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

module.exports = {
  getDb,
  initSchema,
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
};
