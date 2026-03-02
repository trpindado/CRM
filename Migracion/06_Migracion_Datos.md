# 06 — Migración de Datos: SQLite → Dataverse

---

## Visión general del proceso

```
SQLite (crm.db)
    │
    ▼
[Exportar a CSV/Excel con script Node.js]
    │
    ▼
Excel / CSV por tabla
    │
    ▼
[Importar en Dataverse via Power Apps / Dataflow]
    │
    ▼
Dataverse (tablas gnl_*)
```

---

## Paso 1 — Exportar datos desde SQLite

Ejecutar el siguiente script desde la carpeta del CRM:

```bash
node Migracion/exportar_sqlite.js
```

### Script: exportar_sqlite.js

Crear el archivo `Migracion/exportar_sqlite.js`:

```javascript
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'crm.db'));
const outputDir = path.join(__dirname, 'exports');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

function exportToCSV(table, filename) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all();
  if (rows.length === 0) {
    console.log(`${table}: 0 registros, omitiendo`);
    return;
  }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('\n') || str.includes('"')
          ? `"${str}"`
          : str;
      }).join(',')
    )
  ].join('\n');

  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8'); // BOM para Excel
  console.log(`✓ ${table}: ${rows.length} registros → ${filename}`);
}

exportToCSV('Pais',          '01_Pais.csv');
exportToCSV('Entidades',     '02_Entidades.csv');
exportToCSV('Contactos',     '03_Contactos.csv');
exportToCSV('Oportunidades', '04_Oportunidades.csv');
exportToCSV('Documentos',    '05_Documentos.csv');

console.log('\n✅ Exportación completada en:', outputDir);
db.close();
```

Los archivos CSV se guardarán en `Migracion/exports/`.

---

## Paso 2 — Revisar y limpiar los CSV antes de importar

### Verificaciones recomendadas

| Tabla | Qué revisar |
|---|---|
| Pais | Que `CodigoPaisNormalizado` use formato ISO 3166-1 alpha-3 (ESP, FRA...) |
| Entidades | Que `CodigoEntidad` no tenga duplicados. Comprobar que `CodigoPaisNormalizado` existe en Pais |
| Contactos | Que `CodigoEntidad` exista en Entidades. Revisar formatos de Email y fechas |
| Oportunidades | Que `CodigoEntidad` exista en Entidades. Revisar valores de Timing |
| Documentos | Que `CodigoEntidad` exista en Entidades. Revisar NDA_S_N → normalizar a "Sí"/"No" |

### Normalización de campos Choice antes de importar

Los campos Choice en Dataverse usan valores numéricos. Antes de importar, mapear:

**NDA_S_N / KYC_S_N / MSPASN:**
```
"Sí" / "Si" / "S" / "YES"  →  Sí
"No" / "N"                  →  No
vacío                        →  (dejar en blanco)
```

**Timing (Oportunidades):**
```
"Corto"  / "Corto plazo"  →  Corto plazo (< 3 meses)
"Medio"  / "Medio plazo"  →  Medio plazo (3-12 meses)
"Largo"  / "Largo plazo"  →  Largo plazo (> 12 meses)
```

---

## Paso 3 — Importar en Dataverse

### Método A: Importación directa desde Power Apps (recomendado para <5.000 filas)

1. Ir a **make.powerapps.com** → **Dataverse** → **Tablas**
2. Seleccionar tabla (empezar por `gnl_Pais`)
3. **Importar** → **Importar datos desde Excel**
4. Subir el CSV correspondiente
5. Mapear columnas:

| Columna CSV | Columna Dataverse |
|---|---|
| CodigoPaisNormalizado | gnl_CodigoPaisNormalizado (Name) |
| Nombre | gnl_Nombre |
| Region | gnl_Region |
| ... | ... |

6. **Guardar** y esperar a que el job finalice

### Orden de importación (obligatorio por dependencias FK)

```
1. gnl_Pais           (sin dependencias)
2. gnl_Entidad        (depende de gnl_Pais)
3. gnl_Contacto       (depende de gnl_Entidad)
4. gnl_Oportunidad    (depende de gnl_Entidad)
5. gnl_Documento      (depende de gnl_Entidad)
```

### Mapeo de Lookup en la importación

Para `gnl_Entidad.gnl_PaisId` (Lookup a gnl_Pais):
- En el wizard de importación, seleccionar el campo Lookup
- Indicar que el valor de referencia es `gnl_CodigoPaisNormalizado`
- Dataverse resolverá el GUID automáticamente

Para `gnl_Contacto.gnl_EntidadId` (Lookup a gnl_Entidad):
- Indicar que la columna de referencia es `gnl_CodigoEntidad`

---

### Método B: Power Query / Dataflow (para migraciones repetidas o +5.000 filas)

1. **make.powerapps.com** → **Dataverse** → **Dataflows** → **Nuevo Dataflow**
2. Nombre: `Migracion_CRM_GNL`
3. Fuente: **Texto/CSV** → subir el CSV desde OneDrive
4. Transformaciones en Power Query:
   - Renombrar columnas al naming de Dataverse
   - Cambiar tipos de dato (texto, fecha, número)
   - Reemplazar valores de Choice (Sí/No → valores numéricos)
5. Destino: Tabla Dataverse correspondiente
6. Mapear columnas
7. **Publicar** y ejecutar

---

## Paso 4 — Verificar la importación

Tras cada importación, ejecutar estas comprobaciones desde Power Apps:

```powerfx
// Verificar totales (ejecutar en App.OnStart o en una pantalla de diagnóstico)
Set(varDiagnostico, {
    paises:        CountRows(gnl_Pais),
    entidades:     CountRows(gnl_Entidad),
    contactos:     CountRows(gnl_Contacto),
    oportunidades: CountRows(gnl_Oportunidad),
    documentos:    CountRows(gnl_Documento)
})

// Mostrar en pantalla de diagnóstico:
lblDiagPaises.Text:        "Países: " & varDiagnostico.paises
lblDiagEntidades.Text:     "Entidades: " & varDiagnostico.entidades
lblDiagContactos.Text:     "Contactos: " & varDiagnostico.contactos
lblDiagOportunidades.Text: "Oportunidades: " & varDiagnostico.oportunidades
lblDiagDocumentos.Text:    "Documentos: " & varDiagnostico.documentos
```

Comparar con los totales del CRM original (disponibles en el Dashboard).

---

## Paso 5 — Publicar la Power App

1. **Power Apps Studio** → **Archivo** → **Guardar** → **Publicar**
2. Compartir con usuarios:
   - **Compartir** → buscar usuarios o grupos de Azure AD
   - Asignar rol **GNL_Comercial** o **GNL_Admin**
3. Distribuir el enlace de la app o añadir a **Teams** como pestaña

---

## Resumen de tiempos estimados

| Tarea | Tiempo estimado |
|---|---|
| Crear tablas y relaciones en Dataverse | 3-4 horas |
| Exportar y limpiar datos SQLite | 1-2 horas |
| Importar datos en Dataverse | 1-2 horas |
| Crear Canvas App (pantallas base) | 2-3 días |
| Configurar Copilot Studio | 4-6 horas |
| Testing y ajustes | 1-2 días |
| **Total** | **~5-7 días de trabajo** |

---

## Rollback / Marcha atrás

El CRM actual (Node.js + SQLite) puede seguir funcionando en paralelo durante la migración. No hay destructive changes en el origen. Para volver al sistema anterior simplemente arrancar el servidor Node.js como hasta ahora.
