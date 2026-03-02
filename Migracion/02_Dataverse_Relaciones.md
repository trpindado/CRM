# 02 — Relaciones entre Tablas en Dataverse

---

## Diagrama de relaciones (ERD)

```
┌─────────────┐
│  gnl_Pais   │
│─────────────│
│ CodigoPais  │◄──────────────────────────────────┐
│ Nombre      │                                   │
│ Region      │                                   │ Lookup
└─────────────┘                                   │
                                                  │
                                        ┌─────────────────┐
                                        │  gnl_Entidad    │
                                        │─────────────────│
                              ┌────────►│ CodigoEntidad   │◄─────────────────────┐
                              │         │ Compania        │                      │
                              │         │ PaisId (Lookup) │                      │
                              │         └─────────────────┘                      │
                              │                  ▲                               │
                    Lookup    │                  │ Lookup (1:N)                  │
                              │    ┌─────────────┤─────────────┐                │
                              │    │             │             │                 │
                    ┌─────────┴────┴──┐  ┌───────┴─────┐  ┌───┴──────────┐    │
                    │  gnl_Contacto   │  │gnl_Oportunid│  │gnl_Documento │    │
                    │─────────────────│  │─────────────│  │──────────────│    │
                    │ CodigoContacto  │  │CodigoOpor.. │  │CodigoDoc...  │    │
                    │ EntidadId       │  │EntidadId    │  │EntidadId     │    │
                    │ Nombre          │  │Contraparte  │  │NDA           │    │
                    │ Email           │  │Timing       │  │FechaExpNDA   │    │
                    └─────────────────┘  └─────────────┘  └──────────────┘    │
```

---

## Relaciones a crear en Dataverse

### 1. gnl_Pais → gnl_Entidad (1:N)

| Campo | Valor |
|---|---|
| Tipo | One-to-Many (1:N) |
| Tabla primaria | gnl_Pais |
| Tabla relacionada | gnl_Entidad |
| Campo Lookup en gnl_Entidad | `gnl_PaisId` |
| Nombre display del Lookup | "País" |
| Comportamiento al borrar | Restrict (no borrar país si tiene entidades) |
| Comportamiento al reasignar | Cascade |

---

### 2. gnl_Entidad → gnl_Contacto (1:N)

| Campo | Valor |
|---|---|
| Tipo | One-to-Many (1:N) |
| Tabla primaria | gnl_Entidad |
| Tabla relacionada | gnl_Contacto |
| Campo Lookup en gnl_Contacto | `gnl_EntidadId` |
| Nombre display del Lookup | "Entidad" |
| Comportamiento al borrar | Cascade (borrar entidad → borrar sus contactos) |
| Comportamiento al reasignar | Cascade |

---

### 3. gnl_Entidad → gnl_Oportunidad (1:N)

| Campo | Valor |
|---|---|
| Tipo | One-to-Many (1:N) |
| Tabla primaria | gnl_Entidad |
| Tabla relacionada | gnl_Oportunidad |
| Campo Lookup en gnl_Oportunidad | `gnl_EntidadId` |
| Nombre display del Lookup | "Entidad" |
| Comportamiento al borrar | Cascade |
| Comportamiento al reasignar | Cascade |

---

### 4. gnl_Entidad → gnl_Documento (1:N)

| Campo | Valor |
|---|---|
| Tipo | One-to-Many (1:N) |
| Tabla primaria | gnl_Entidad |
| Tabla relacionada | gnl_Documento |
| Campo Lookup en gnl_Documento | `gnl_EntidadId` |
| Nombre display del Lookup | "Entidad" |
| Comportamiento al borrar | Cascade |
| Comportamiento al reasignar | Cascade |

---

## Pasos para crear relaciones en Power Apps / Make.powerapps.com

1. Ir a **make.powerapps.com** → **Dataverse** → **Tablas**
2. Seleccionar la tabla **gnl_Entidad**
3. Pestaña **Relaciones** → **Añadir relación**
4. Seleccionar tipo **Muchos a uno (N:1)** desde gnl_Contacto hacia gnl_Entidad
5. Repetir para gnl_Oportunidad y gnl_Documento

> En Dataverse las relaciones se crean siempre desde la tabla "hija" como N:1 hacia la tabla "padre".

---

## Columnas calculadas recomendadas (Rollup / Calculated)

Estas columnas se crean en **gnl_Entidad** para tener los totales sin hacer queries:

| Columna | Tipo | Fórmula |
|---|---|---|
| `gnl_NumContactos` | Whole Number (Rollup) | COUNT de gnl_Contacto donde EntidadId = este registro |
| `gnl_NumOportunidades` | Whole Number (Rollup) | COUNT de gnl_Oportunidad donde EntidadId = este registro |
| `gnl_TieneNDA` | Yes/No (Calculated) | IF gnl_Documento.NDA = "Sí" THEN true |
| `gnl_ProximoVencimientoNDA` | Date (Rollup) | MIN de gnl_Documento.FechaExpiracionNDA |

---

## Índices recomendados

Dataverse gestiona índices automáticamente para columnas Lookup. Adicionalmente, activar **Quick Find** sobre:

- `gnl_Entidad`: Compania, CodigoEntidad, CodigoPaisNormalizado
- `gnl_Contacto`: Nombre, Email, Cargo
- `gnl_Oportunidad`: Contraparte, Timing, CodigoOportunidad
- `gnl_Pais`: Nombre, CodigoPaisNormalizado
