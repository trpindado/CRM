# 01 — Tablas Dataverse

> Todas las tablas se crean dentro de una **Solución** llamada `CRM_GNL`.
> Publisher prefix: `gnl`
> Cada tabla hereda automáticamente las columnas de sistema: `CreatedOn`, `ModifiedOn`, `CreatedBy`, `ModifiedBy`, `Owner`.

---

## Tabla: gnl_Pais

**Nombre para mostrar:** País
**Nombre plural:** Países
**Clave primaria (Name column):** `gnl_CodigoPaisNormalizado`

| Nombre columna | Nombre display | Tipo Dataverse | Obligatorio | Notas |
|---|---|---|---|---|
| `gnl_CodigoPaisNormalizado` | Código País | Text (100) | Sí | PK — código ISO 3166-1 alpha-3. Ej: ESP, FRA |
| `gnl_Nombre` | Nombre | Text (200) | Sí | |
| `gnl_Region` | Región | Text (100) | No | |
| `gnl_ReferenciaIndice` | Referencia Índice | Text (200) | No | |
| `gnl_LinkFichaPais` | Link Ficha País | URL | No | |
| `gnl_PersonaReferencia` | Persona Referencia Oportunidades | Text (200) | No | |
| `gnl_Comentarios` | Comentarios | Multiline Text | No | |

---

## Tabla: gnl_Entidad

**Nombre para mostrar:** Entidad
**Nombre plural:** Entidades
**Clave primaria (Name column):** `gnl_CodigoEntidad`

| Nombre columna | Nombre display | Tipo Dataverse | Obligatorio | Notas |
|---|---|---|---|---|
| `gnl_CodigoEntidad` | Código Entidad | Text (50) | Sí | PK — formato ENT-XXXXX |
| `gnl_Compania` | Compañía | Text (300) | Sí | |
| `gnl_Region` | Región | Text (100) | No | |
| `gnl_Tipo` | Tipo | Choice | No | Ver opciones abajo |
| `gnl_PaisId` | País | Lookup → gnl_Pais | No | |
| `gnl_FiscalCode` | Fiscal Code | Text (100) | No | |
| `gnl_LEI` | LEI | Text (100) | No | |
| `gnl_Ticker` | Ticker | Text (50) | No | |
| `gnl_DunsNumber` | DUNS Number | Text (50) | No | |
| `gnl_Direccion` | Dirección | Multiline Text | No | |
| `gnl_Comentarios` | Comentarios | Multiline Text | No | |

**Choice: gnl_TipoEntidad**
```
100  Productor
200  Distribuidor
300  Trader
400  Utilities
500  Industrial
600  Shipping
700  Broker
800  Banco / Financiero
900  Otros
```

---

## Tabla: gnl_Contacto

**Nombre para mostrar:** Contacto
**Nombre plural:** Contactos
**Clave primaria (Name column):** `gnl_CodigoContacto`

| Nombre columna | Nombre display | Tipo Dataverse | Obligatorio | Notas |
|---|---|---|---|---|
| `gnl_CodigoContacto` | Código Contacto | Text (50) | Sí | PK — formato CON-XXXXX |
| `gnl_EntidadId` | Entidad | Lookup → gnl_Entidad | Sí | |
| `gnl_Nombre` | Nombre | Text (200) | No | |
| `gnl_Cargo` | Cargo | Text (200) | No | |
| `gnl_Email` | Email | Email | No | |
| `gnl_Telefono1` | Teléfono 1 | Phone | No | |
| `gnl_Telefono2` | Teléfono 2 | Phone | No | |
| `gnl_Via` | Vía de contacto | Choice | No | Ver opciones abajo |
| `gnl_FechaUltimoContacto` | Fecha Último Contacto | Date Only | No | |
| `gnl_DemorarContactoAfecha` | Demorar Contacto a Fecha | Date Only | No | |
| `gnl_ProbabilidadExito` | Probabilidad Éxito | Choice | No | Ver opciones abajo |
| `gnl_Linkedin` | LinkedIn | URL | No | |
| `gnl_Comentarios` | Comentarios | Multiline Text | No | |

**Choice: gnl_ViaContacto**
```
100  Email
200  Teléfono
300  LinkedIn
400  Reunión presencial
500  Videoconferencia
600  Conferencia / Evento
```

**Choice: gnl_ProbabilidadExito**
```
100  Alta
200  Media
300  Baja
400  Sin definir
```

---

## Tabla: gnl_Oportunidad

**Nombre para mostrar:** Oportunidad
**Nombre plural:** Oportunidades
**Clave primaria (Name column):** `gnl_CodigoOportunidad`

| Nombre columna | Nombre display | Tipo Dataverse | Obligatorio | Notas |
|---|---|---|---|---|
| `gnl_CodigoOportunidad` | Código Oportunidad | Text (50) | Sí | PK — formato OPO-XXXXX |
| `gnl_EntidadId` | Entidad | Lookup → gnl_Entidad | Sí | |
| `gnl_Contraparte` | Contraparte | Text (300) | No | |
| `gnl_OwnerAccount` | Owner Account | Text (200) | No | |
| `gnl_Entrega` | Entrega | Text (100) | No | Ej: DES, FOB, CIF |
| `gnl_Periodo` | Período | Text (100) | No | Ej: 2025-Q1 |
| `gnl_Volumen` | Volumen | Text (100) | No | Se mantiene texto por flexibilidad |
| `gnl_Precio` | Precio | Text (100) | No | Se mantiene texto por flexibilidad |
| `gnl_SpecsContrapartePCS` | Specs Contraparte PCS | Text (200) | No | |
| `gnl_ProximosPasosNTGY` | Próximos Pasos NTGY | Multiline Text | No | |
| `gnl_ProximosPasosContraparte` | Próximos Pasos Contraparte | Multiline Text | No | |
| `gnl_Timing` | Timing | Choice | No | Ver opciones abajo |
| `gnl_Origen` | Origen | Text (200) | No | |
| `gnl_Comentarios` | Comentarios | Multiline Text | No | |

**Choice: gnl_Timing**
```
100  Corto plazo (< 3 meses)
200  Medio plazo (3-12 meses)
300  Largo plazo (> 12 meses)
400  En negociación
500  Cerrada ganada
600  Cerrada perdida
700  En espera
```

---

## Tabla: gnl_Documento

**Nombre para mostrar:** Documento
**Nombre plural:** Documentos
**Clave primaria (Name column):** `gnl_CodigoDocumento`

| Nombre columna | Nombre display | Tipo Dataverse | Obligatorio | Notas |
|---|---|---|---|---|
| `gnl_CodigoDocumento` | Código Documento | Text (50) | Sí | PK — formato DOC-XXXXX |
| `gnl_EntidadId` | Entidad | Lookup → gnl_Entidad | Sí | |
| `gnl_KYC` | KYC | Choice (Sí/No/Pendiente) | No | |
| `gnl_KYCLink` | Link KYC | URL | No | |
| `gnl_NDA` | NDA | Choice (Sí/No/Pendiente) | No | |
| `gnl_FechaExpiracionNDA` | Fecha Expiración NDA | Date Only | No | |
| `gnl_NDALink` | Link NDA | URL | No | |
| `gnl_MSPA` | MSPA | Choice (Sí/No/Pendiente) | No | |
| `gnl_MSPALink` | Link MSPA | URL | No | |
| `gnl_Comentarios` | Comentarios | Multiline Text | No | |

**Choice: gnl_EstadoDocumento** (compartida para KYC, NDA, MSPA)
```
100  Sí / Firmado
200  No / Pendiente
300  En proceso
400  Expirado
```

---

## Tabla: gnl_ConfiguracionUsuario (opcional)

Para guardar preferencias de usuario si se necesita (reemplaza `localStorage`).

| Nombre columna | Tipo | Notas |
|---|---|---|
| `gnl_UsuarioAAD` | Text (200) | Email del usuario de Azure AD |
| `gnl_Preferencias` | Multiline Text | JSON de preferencias |

---

## Configuración recomendada al crear cada tabla

1. **Auditoría**: Activar `Track changes` en cada tabla
2. **Búsqueda**: Activar `Quick Find` sobre columnas Name, Compañía, Email
3. **Permisos**: Crear roles de seguridad `GNL_Admin` y `GNL_Comercial`
4. **Columna de nombre**: Usar el código (ENT-XXXXX) como columna principal — es única y buscable
