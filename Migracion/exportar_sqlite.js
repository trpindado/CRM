/**
 * exportar_sqlite.js
 * Exporta todas las tablas del CRM (crm.db) a ficheros CSV
 * listos para importar en Dataverse.
 *
 * Uso:
 *   cd C:\Claude\CRM
 *   node Migracion/exportar_sqlite.js
 *
 * Los CSV se generan en: Migracion/exports/
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'crm.db');
const OUTPUT_DIR = path.join(__dirname, 'exports');

// Crear carpeta de salida si no existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
  console.log('Carpeta creada:', OUTPUT_DIR);
}

const db = new Database(DB_PATH);

function exportToCSV(table, filename) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all();

  if (rows.length === 0) {
    console.log(`  ${table}: 0 registros — omitiendo`);
    return 0;
  }

  const headers = Object.keys(rows[0]);

  const csv = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        // Entrecomillar si contiene coma, salto de línea o comillas
        return (str.includes(',') || str.includes('\n') || str.includes('"'))
          ? `"${str}"`
          : str;
      }).join(',')
    )
  ].join('\n');

  const filePath = path.join(OUTPUT_DIR, filename);
  // BOM UTF-8 para que Excel lo abra correctamente con tildes y caracteres especiales
  fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8');
  console.log(`  ✓ ${table}: ${rows.length} registros → ${filename}`);
  return rows.length;
}

console.log('\n=== Exportación CRM GNL: SQLite → CSV ===\n');
console.log('Base de datos:', DB_PATH);
console.log('Destino:', OUTPUT_DIR);
console.log('');

// Exportar en orden (respetando dependencias de FK para la importación en Dataverse)
const totals = {};
totals.Pais          = exportToCSV('Pais',          '01_Pais.csv');
totals.Entidades     = exportToCSV('Entidades',     '02_Entidades.csv');
totals.Contactos     = exportToCSV('Contactos',     '03_Contactos.csv');
totals.Oportunidades = exportToCSV('Oportunidades', '04_Oportunidades.csv');
totals.Documentos    = exportToCSV('Documentos',    '05_Documentos.csv');

db.close();

console.log('\n=== Resumen ===');
Object.entries(totals).forEach(([tabla, n]) => {
  console.log(`  ${tabla.padEnd(15)} ${n} registros`);
});
console.log('\n✅ Exportación completada. Ficheros listos en:', OUTPUT_DIR);
console.log('\nPróximo paso: importar en Dataverse en este orden:');
console.log('  1. 01_Pais.csv');
console.log('  2. 02_Entidades.csv');
console.log('  3. 03_Contactos.csv');
console.log('  4. 04_Oportunidades.csv');
console.log('  5. 05_Documentos.csv');
console.log('  Ver instrucciones completas en: 06_Migracion_Datos.md\n');
