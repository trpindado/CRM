const XLSX = require('xlsx');
const path = require('path');
const db = require('./database');

const EXCEL_PATH = 'C:/Users/quesc/Mi unidad/Teresa/AAA_soporte precios y margenes y gestor comercial/gestor comercial/GNL_CRM_Datos_Sinteticos_vers_2.xlsx';

console.log('Inicializando base de datos...');
db.initSchema();

console.log('Leyendo archivo Excel...');
const wb = XLSX.readFile(EXCEL_PATH);

const importOrder = ['Pais', 'Entidades', 'Contactos', 'Oportunidades', 'Documentos'];

for (const sheetName of importOrder) {
  if (!wb.SheetNames.includes(sheetName)) {
    console.log(`  AVISO: Hoja "${sheetName}" no encontrada, saltando...`);
    continue;
  }

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws);

  // Clean data: convert all values to strings, handle nulls
  const cleanedRows = rows.map(row => {
    const clean = {};
    Object.entries(row).forEach(([k, v]) => {
      clean[k] = v != null ? String(v) : null;
    });
    return clean;
  });

  console.log(`  Importando ${sheetName}: ${cleanedRows.length} filas...`);
  const result = db.bulkImport(sheetName, cleanedRows);
  console.log(`    Insertados: ${result.inserted}, Actualizados: ${result.updated}, Errores: ${result.errors.length}`);
  if (result.errors.length > 0) {
    result.errors.forEach(e => console.log(`    ERROR: ${e.error}`));
  }
}

console.log('\nImportacion completada. Base de datos lista.');
console.log('Ejecuta: node server.js');
