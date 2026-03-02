# 03 — Pantallas Power Apps (Canvas App)

> Tipo de app: **Canvas App** (Tablet layout, 1366×768)
> Tema: Colores corporativos — Primary: #0078D4 (azul Microsoft/GNL)

---

## Estructura de pantallas

```
App
├── scrInicio          → Dashboard / KPIs
├── scrEntidades       → Lista de entidades
├── scrEntidadDetalle  → Detalle + subgrids
├── scrContactos       → Lista de contactos
├── scrContactoForm    → Formulario contacto (nuevo/editar)
├── scrOportunidades   → Pipeline de oportunidades
├── scrOportunidadForm → Formulario oportunidad (nuevo/editar)
├── scrDocumentos      → Lista de documentos/NDAs
├── scrDocumentoForm   → Formulario documento (nuevo/editar)
├── scrMapa            → Mapa mundial con entidades
├── scrBusqueda        → Búsqueda global
├── scrAsistenteIA     → Chat con Copilot Studio
└── scrAdminUsuarios   → Gestión de roles (solo admin)
```

---

## scrInicio — Dashboard

### Descripción
Pantalla principal con KPIs, gráficos y acceso rápido.

### Componentes

| Control | Nombre | Tipo | Posición |
|---|---|---|---|
| Fondo degradado | rectHeader | Rectangle | Top, full width, H:80 |
| Logo/Título | lblTitulo | Label | En rectHeader |
| Usuario logado | lblUsuario | Label | Top-right |
| KPI Entidades | cardEntidades | Component Card | Fila 1, col 1 |
| KPI Contactos | cardContactos | Component Card | Fila 1, col 2 |
| KPI Oportunidades | cardOportunidades | Component Card | Fila 1, col 3 |
| KPI Países | cardPaises | Component Card | Fila 1, col 4 |
| Gráfico por Región | chartRegion | Column chart | Fila 2, col 1-2 |
| Gráfico por Timing | chartTiming | Pie chart | Fila 2, col 3-4 |
| Últimas oportunidades | galUltimasOpor | Gallery | Fila 3 |
| Contactos pendientes | galContactosPend | Gallery | Fila 3 |
| Navbar lateral | compNavbar | Component | Left, full height |

### Propiedades clave

**rectHeader:**
```
Fill: RGBA(0, 120, 212, 1)
Width: Parent.Width
Height: 70
```

**lblTitulo:**
```
Text: "GNL CRM — Gestor Comercial"
Color: White
Font: Bold, Size 20
```

**lblUsuario:**
```
Text: Office365Users.MyProfileV2().displayName
Color: White
```

**cardEntidades (para cada KPI card):**
```
// Dentro de la card:
lblNumero.Text: Text(CountRows(gnl_Entidad))
lblEtiqueta.Text: "Entidades"
icono: Icon.Building
Color fondo: RGBA(0, 120, 212, 0.1)
```

**galUltimasOpor:**
```
Items: FirstN(
    SortByColumns(gnl_Oportunidad, "createdon", Descending),
    5
)
```

**galContactosPend:**
```
Items: Filter(
    gnl_Contacto,
    gnl_DemorarContactoAfecha <= DateAdd(Today(), 7, TimeUnit.Days)
        && gnl_DemorarContactoAfecha >= Today()
)
```

---

## scrEntidades — Lista de Entidades

### Componentes

| Control | Nombre | Tipo |
|---|---|---|
| Buscador | txtBuscarEntidad | Text Input |
| Filtro Tipo | dpTipoEntidad | Dropdown |
| Filtro País | dpPaisEntidad | Dropdown |
| Galería principal | galEntidades | Vertical Gallery |
| Botón Nuevo | btnNuevaEntidad | Button |
| Contador resultados | lblContadorEntidades | Label |

### Propiedades clave

**galEntidades:**
```
Items: SortByColumns(
    Filter(
        gnl_Entidad,
        (txtBuscarEntidad.Text = "" ||
            StartsWith(gnl_Compania, txtBuscarEntidad.Text) ||
            gnl_CodigoEntidad = txtBuscarEntidad.Text),
        dpTipoEntidad.Selected.Value = "Todos" ||
            gnl_Tipo = dpTipoEntidad.Selected.Value,
        dpPaisEntidad.Selected.Value = "Todos" ||
            gnl_PaisId.gnl_Nombre = dpPaisEntidad.Selected.Value
    ),
    "gnl_Compania", SortOrder.Ascending
)
WrapCount: 1
TemplateHeight: 72
```

**Dentro de cada item de galEntidades:**
```
lblNombreEntidad.Text:  ThisItem.gnl_Compania
lblCodigoEntidad.Text:  ThisItem.gnl_CodigoEntidad
lblTipoEntidad.Text:    ThisItem.gnl_Tipo
lblPaisEntidad.Text:    ThisItem.gnl_PaisId.gnl_Nombre
lblNumContactos.Text:   Text(CountRows(
    Filter(gnl_Contacto, gnl_EntidadId.gnl_CodigoEntidad = ThisItem.gnl_CodigoEntidad)
))
```

**Al hacer clic en item de galería:**
```
OnSelect:
Set(varEntidadSeleccionada, ThisItem);
Navigate(scrEntidadDetalle, ScreenTransition.Fade)
```

**lblContadorEntidades:**
```
Text: Text(CountRows(galEntidades.AllItems)) & " entidades"
```

**dpTipoEntidad:**
```
Items: ["Todos", "Productor", "Distribuidor", "Trader", "Utilities",
        "Industrial", "Shipping", "Broker", "Banco / Financiero", "Otros"]
```

---

## scrEntidadDetalle — Detalle de Entidad

### Componentes

| Control | Nombre | Tipo |
|---|---|---|
| Breadcrumb | lblBreadcrumb | Label |
| Nombre empresa | lblNombreDetalle | Label |
| Modo ver/editar | togModoEdicion | Toggle |
| Formulario datos | frmEntidad | Edit Form |
| Tab Contactos | btnTabContactos | Button |
| Tab Oportunidades | btnTabOportunidades | Button |
| Tab Documentos | btnTabDocumentos | Button |
| Subgrid activo | galSubgrid | Gallery (variable) |
| Botón añadir sub | btnAddSubitem | Button |
| Botón guardar | btnGuardarEntidad | Button |
| Botón eliminar | btnEliminarEntidad | Button |

### Propiedades clave

**frmEntidad:**
```
DataSource: gnl_Entidad
Item: varEntidadSeleccionada
DefaultMode: If(togModoEdicion.Value, FormMode.Edit, FormMode.View)
```

**Variable de tab activo:**
```
// Al inicio de pantalla (OnVisible):
Set(varTabActivo, "Contactos")
```

**galSubgrid (contactos):**
```
Items: If(varTabActivo = "Contactos",
    Filter(gnl_Contacto, gnl_EntidadId.gnl_CodigoEntidad = varEntidadSeleccionada.gnl_CodigoEntidad),
    If(varTabActivo = "Oportunidades",
        Filter(gnl_Oportunidad, gnl_EntidadId.gnl_CodigoEntidad = varEntidadSeleccionada.gnl_CodigoEntidad),
        Filter(gnl_Documento, gnl_EntidadId.gnl_CodigoEntidad = varEntidadSeleccionada.gnl_CodigoEntidad)
    )
)
```

**btnGuardarEntidad:**
```
OnSelect:
If(SubmitForm(frmEntidad),
    Notify("Entidad guardada correctamente", NotificationType.Success);
    Set(varEntidadSeleccionada, frmEntidad.LastSubmit),
    Notify("Error al guardar: " & frmEntidad.Error, NotificationType.Error)
)
```

**btnEliminarEntidad:**
```
OnSelect:
If(Confirm("¿Eliminar esta entidad y todos sus registros relacionados?",
    {ConfirmButton: "Eliminar", CancelButton: "Cancelar"}),
    Remove(gnl_Entidad, varEntidadSeleccionada);
    Navigate(scrEntidades, ScreenTransition.Back)
)
```

---

## scrOportunidades — Pipeline

### Componentes

| Control | Nombre | Tipo |
|---|---|---|
| Vista Kanban/Lista | togVistaKanban | Toggle |
| Filtro Timing | dpFiltroTiming | Dropdown |
| Galería lista | galOportunidades | Gallery |
| Contenedor Kanban | cntKanban | Container |
| Columna Corto | galKanbanCorto | Gallery |
| Columna Medio | galKanbanMedio | Gallery |
| Columna Largo | galKanbanLargo | Gallery |

### Propiedades clave

**galOportunidades:**
```
Items: Filter(
    gnl_Oportunidad,
    dpFiltroTiming.Selected.Value = "Todos" ||
        gnl_Timing = dpFiltroTiming.Selected.Value,
    txtBuscarOpor.Text = "" ||
        StartsWith(gnl_Contraparte, txtBuscarOpor.Text) ||
        StartsWith(gnl_EntidadId.gnl_Compania, txtBuscarOpor.Text)
)
```

**galKanbanCorto (columna Kanban):**
```
Items: Filter(gnl_Oportunidad, gnl_Timing = 100)  // 100 = Corto plazo
```

---

## scrMapa — Mapa Mundial

### Componentes

| Control | Nombre | Tipo |
|---|---|---|
| Control mapa | mapEntidades | Map control (premium) |
| Panel lateral | galPaisesLateral | Gallery |
| Info popup | cntInfoPais | Container |

### Propiedades clave

**mapEntidades:**
```
// El control Map de Power Apps requiere habilitar el conector de mapas
ItemsLabels: galPaisesLateral.AllItems
Items: AddColumns(
    Filter(gnl_Pais, CountRows(
        Filter(gnl_Entidad, gnl_PaisId.gnl_CodigoPaisNormalizado = gnl_CodigoPaisNormalizado)
    ) > 0),
    "Latitude", LookUp(coordenadasPaises, codigo = gnl_CodigoPaisNormalizado, lat),
    "Longitude", LookUp(coordenadasPaises, codigo = gnl_CodigoPaisNormalizado, lng)
)
```

> **Nota:** Las coordenadas por país se almacenan en una colección `coordenadasPaises` cargada en `App.OnStart` desde una tabla auxiliar o hardcoded.

---

## scrAsistenteIA — Chat con Copilot

### Componentes

| Control | Nombre | Tipo |
|---|---|---|
| Chat embed | copilotChat | Copilot Studio Component |
| Panel info | lblModoIA | Label |

> Ver documento `05_Copilot_Studio.md` para configuración del agente.

---

## Componente Navbar (compNavbar — reutilizable)

Crear como **componente** para reutilizar en todas las pantallas.

### Controles del componente

```
rectNavFondo       Rectangle   Fill: RGBA(0,120,212,1)   W:220  H:Parent.Height
btnNavInicio       Button      Navigate(scrInicio)
btnNavEntidades    Button      Navigate(scrEntidades)
btnNavContactos    Button      Navigate(scrContactos)
btnNavOportunidades Button     Navigate(scrOportunidades)
btnNavDocumentos   Button      Navigate(scrDocumentos)
btnNavMapa         Button      Navigate(scrMapa)
btnNavBusqueda     Button      Navigate(scrBusqueda)
btnNavAsistente    Button      Navigate(scrAsistenteIA)
btnNavAdmin        Button      Visible: varEsAdmin   Navigate(scrAdminUsuarios)
lblVersion         Label       Text: "v2.0 | Power Apps"
```

### Propiedad de pantalla activa

```
// En cada botón de nav, highlight si es la pantalla actual:
btnNavInicio.Fill:
    If(App.ActiveScreen.Name = "scrInicio",
        RGBA(255,255,255,0.2),
        Transparent
    )
```

---

## Variables globales (App.OnStart)

```powerfx
// Usuario actual
Set(varUsuario, Office365Users.MyProfileV2());
Set(varNombreUsuario, varUsuario.displayName);
Set(varEmailUsuario, varUsuario.mail);

// Comprobar si es admin (por grupo AAD o tabla de config)
Set(varEsAdmin,
    !IsBlank(LookUp(gnl_ConfiguracionUsuario,
        gnl_UsuarioAAD = varEmailUsuario &&
        gnl_Rol = "Admin"
    ))
);

// Cargar coordenadas de países (colección auxiliar para el mapa)
ClearCollect(coordenadasPaises,
    {codigo:"ESP", lat:40.46, lng:-3.75},
    {codigo:"FRA", lat:46.60, lng:1.89},
    {codigo:"IND", lat:20.59, lng:78.96},
    {codigo:"CHN", lat:35.86, lng:104.20},
    // ... resto de países
);

// Navegar al dashboard
Navigate(scrInicio, ScreenTransition.None)
```
