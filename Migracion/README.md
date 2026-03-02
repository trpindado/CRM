# Migración CRM GNL → Power Apps + Dataverse

## Índice de documentos

| Fichero | Contenido |
|---|---|
| [01_Dataverse_Tablas.md](./01_Dataverse_Tablas.md) | Definición completa de tablas, columnas y tipos de datos |
| [02_Dataverse_Relaciones.md](./02_Dataverse_Relaciones.md) | Relaciones entre tablas, cardinalidad y lookups |
| [03_PowerApps_Pantallas.md](./03_PowerApps_Pantallas.md) | Pantallas, controles, propiedades y layout |
| [04_PowerApps_Formulas.md](./04_PowerApps_Formulas.md) | Fórmulas Power Fx por pantalla y funcionalidad |
| [05_Copilot_Studio.md](./05_Copilot_Studio.md) | Agente IA con Copilot Studio — tópicos, acciones y conectores |
| [06_Migracion_Datos.md](./06_Migracion_Datos.md) | Pasos para exportar SQLite e importar en Dataverse |

---

## Resumen ejecutivo

### Stack actual (Node.js)
```
SQLite (crm.db) ← Node.js/Express → HTML/CSS/JS (SPA)
                                   → OpenAI GPT-4o-mini
```

### Stack objetivo (Microsoft 365)
```
Dataverse ← Power Apps Canvas App → Azure AD (auth automática)
          ← Power Automate         → Copilot Studio (IA)
```

---

## Decisiones de arquitectura

### Tipo de app Power Apps
**Canvas App** (no Model-driven) — permite control total del UI, replicando la experiencia actual.

### Fuente de datos
**Dataverse** — base de datos relacional real incluida en la licencia, sin límites de registros, con relaciones nativas entre tablas y búsqueda full-text.

### Autenticación
Eliminada del diseño — Azure AD autentica automáticamente. El usuario se obtiene con `Office365Users.MyProfileV2()`. Los roles se gestionan con grupos de seguridad de Azure AD o con una tabla `Usuarios` en Dataverse.

### Inteligencia Artificial
**Copilot Studio** en lugar de llamada directa a OpenAI. Se crea un agente con acceso a Dataverse mediante conectores nativos. Se integra en Power Apps como componente de chat embebido.

---

## Entidades del sistema

| Tabla Dataverse | Equivalente SQLite | Registros estimados |
|---|---|---|
| gnl_Pais | Pais | < 100 |
| gnl_Entidad | Entidades | ~200-500 |
| gnl_Contacto | Contactos | ~500-2000 |
| gnl_Oportunidad | Oportunidades | ~200-1000 |
| gnl_Documento | Documentos | ~200-500 |

> El prefijo `gnl_` es el publisher prefix de la solución en Dataverse.

---

## Licencias necesarias

| Componente | Licencia |
|---|---|
| Power Apps Canvas | Microsoft 365 E3/E5 o Power Apps per-app/per-user |
| Dataverse | Power Apps Premium (incluido en licencias M365 E5 o Dynamics 365) |
| Copilot Studio | Microsoft Copilot Studio (standalone o incluido en M365 Copilot) |
| Power Automate | Microsoft 365 (incluido) |
