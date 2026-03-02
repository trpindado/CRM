# Memoria del proyecto — CRM GNL

## Proyecto principal
- **Ruta local:** `C:\Claude\CRM\`
- **GitHub:** https://github.com/trpindado/CRM.git (rama `master`)
- **Stack:** Node.js + Express 5 + SQLite (better-sqlite3) + SPA vanilla JS

## Arrancar el servidor
```bash
kill -9 $(ps aux | grep node | grep -v grep | awk '{print $1}') 2>/dev/null
cd /c/Claude/CRM && node server.js > /tmp/server.log 2>&1 & disown
timeout 5 bash -c 'until curl -s http://localhost:3000/api/me > /dev/null 2>&1; do true; done' && echo "LISTO"
```
> `taskkill /F /IM node.exe` NO funciona en Git Bash — usar `kill -9` por PID.

## Estructura clave
```
CRM/
├── server.js          # Express 5, endpoints API, carga .env al arrancar
├── database.js        # SQLite, CRUD, processAiQuery(), getCrmContext()
├── public/
│   ├── index.html     # SPA con AI chat panel + toggle Básico/IA
│   ├── js/app.js      # Lógica frontend, checkAiStatus(), sendAiMessage()
│   └── css/style.css  # Estilos incluyendo toggle switch IA
├── .env               # OPENAI_API_KEY (nunca a GitHub)
└── Migracion/         # Documentación migración Power Apps + Dataverse
```

## Funcionalidades implementadas
- CRUD completo: Países, Entidades, Contactos, Oportunidades, Documentos
- Dashboard con KPIs, gráficos y mapa mundial (Leaflet, ISO 3166-1 alpha-3)
- Importación Excel (XLSX), exportación
- Gestión de usuarios con roles (admin / comercial)
- Asistente IA con toggle Básico/OpenAI — GPT-4o-mini con contexto de BD
- Presentación corporativa integrada

## Asistente IA
- Toggle en la cabecera del chat, persiste en `localStorage`
- `GET /api/ai/status` → `{ openaiAvailable: true/false }` — **sin requireAuth** (Express 5 bug con rutas nested)
- `POST /api/ai/chat` → acepta `{ message, useAI }` — fallback automático si OpenAI falla
- `getCrmContext(message)` en database.js inyecta datos reales de la BD al prompt

## Problema conocido: Express 5 + requireAuth en rutas nested
`/api/ai/status` con `requireAuth` no se registra correctamente en Express 5 (cae al SPA fallback).
**Solución aplicada:** quitar `requireAuth` de ese endpoint (solo devuelve un booleano, no es dato sensible).

## Migración Power Apps (documentación en Migracion/)
- `01_Dataverse_Tablas.md` — 5 tablas con prefijo `gnl_`
- `02_Dataverse_Relaciones.md` — ERD y relaciones 1:N
- `03_PowerApps_Pantallas.md` — pantallas y controles
- `04_PowerApps_Formulas.md` — fórmulas Power Fx
- `05_Copilot_Studio.md` — agente IA con tópicos y flows
- `06_Migracion_Datos.md` — exportación SQLite + importación Dataverse
- `exportar_sqlite.js` — script listo para generar CSVs: `node Migracion/exportar_sqlite.js`

## Ficheros que NO van a GitHub
- `crm.db` (y -shm, -wal, .backup) — BD con datos reales
- `.env` — API key OpenAI
- `Migracion/exports/` — CSVs exportados

## Usuarios por defecto
- Dos usuarios de desarrollo definidos en database.js (initSchema)
