# 04 — Fórmulas Power Fx

---

## Patrones generales

### Crear nuevo registro

```powerfx
// Botón "Nuevo" en cualquier pantalla de lista
OnSelect:
NewForm(frmEntidad);
Set(varModoFormulario, "Nuevo");
Navigate(scrEntidadDetalle, ScreenTransition.Fade)
```

### Editar registro existente

```powerfx
// Al seleccionar un item de la galería
OnSelect:
Set(varEntidadSeleccionada, ThisItem);
EditForm(frmEntidad);
Set(varModoFormulario, "Editar");
Navigate(scrEntidadDetalle, ScreenTransition.Fade)
```

### Guardar formulario con validación

```powerfx
// Botón Guardar
OnSelect:
If(
    IsBlank(txtNombreEntidad.Text),
    Notify("El nombre de la compañía es obligatorio", NotificationType.Error),
    If(
        SubmitForm(frmEntidad),
        Notify("Guardado correctamente ✓", NotificationType.Success);
        Navigate(scrEntidades, ScreenTransition.Back),
        Notify("Error: " & frmEntidad.Error, NotificationType.Error)
    )
)
```

### Eliminar con confirmación

```powerfx
OnSelect:
If(
    Confirm(
        "¿Eliminar '" & varEntidadSeleccionada.gnl_Compania & "'? Esta acción no se puede deshacer.",
        {ConfirmButton: "Sí, eliminar", CancelButton: "Cancelar"}
    ),
    Remove(gnl_Entidad, varEntidadSeleccionada);
    Notify("Entidad eliminada", NotificationType.Success);
    Navigate(scrEntidades, ScreenTransition.Back)
)
```

---

## Dashboard (scrInicio)

### Totales KPI

```powerfx
// Total entidades
lblNumEntidades.Text:   Text(CountRows(gnl_Entidad))

// Total contactos
lblNumContactos.Text:   Text(CountRows(gnl_Contacto))

// Total oportunidades
lblNumOportunidades.Text: Text(CountRows(gnl_Oportunidad))

// Total países con entidades
lblNumPaises.Text: Text(
    CountRows(
        Distinct(gnl_Entidad, gnl_PaisId.gnl_CodigoPaisNormalizado)
    )
)
```

### Galería alertas NDA próximos 30 días

```powerfx
galNDAProximos.Items:
SortByColumns(
    Filter(
        gnl_Documento,
        gnl_NDA = 100,  // 100 = Sí/Firmado
        gnl_FechaExpiracionNDA <= DateAdd(Today(), 30, TimeUnit.Days),
        gnl_FechaExpiracionNDA >= Today()
    ),
    "gnl_FechaExpiracionNDA", SortOrder.Ascending
)

// Dentro del item:
lblEmpresaNDA.Text:    ThisItem.gnl_EntidadId.gnl_Compania
lblFechaExpNDA.Text:   Text(ThisItem.gnl_FechaExpiracionNDA, "DD/MM/YYYY")
lblDiasRestantes.Text: Text(DateDiff(Today(), ThisItem.gnl_FechaExpiracionNDA, TimeUnit.Days)) & " días"

// Color de alerta:
lblDiasRestantes.Color:
    If(
        DateDiff(Today(), ThisItem.gnl_FechaExpiracionNDA, TimeUnit.Days) <= 7,
        RGBA(209, 52, 56, 1),    // Rojo — crítico
        If(
            DateDiff(Today(), ThisItem.gnl_FechaExpiracionNDA, TimeUnit.Days) <= 15,
            RGBA(255, 140, 0, 1),  // Naranja — advertencia
            RGBA(0, 120, 212, 1)   // Azul — ok
        )
    )
```

### Datos para gráfico de entidades por región

```powerfx
// Fuente de datos para chart de columnas
chartRegiones.Items:
AddColumns(
    GroupBy(gnl_Entidad, "gnl_Region", "Entidades"),
    "Label", gnl_Region,
    "Value", CountRows(Entidades)
)
```

---

## Entidades (scrEntidades)

### Búsqueda combinada

```powerfx
galEntidades.Items:
SortByColumns(
    Filter(
        gnl_Entidad,
        // Búsqueda de texto
        txtBuscar.Text = "" ||
            StartsWith(Lower(gnl_Compania), Lower(txtBuscar.Text)) ||
            StartsWith(gnl_CodigoEntidad, txtBuscar.Text) ||
            gnl_PaisId.gnl_Nombre = txtBuscar.Text,
        // Filtro tipo
        dpFiltroTipo.Selected.Value = "Todos" ||
            Text(gnl_Tipo) = dpFiltroTipo.Selected.Value,
        // Filtro región
        dpFiltroRegion.Selected.Value = "Todos" ||
            gnl_Region = dpFiltroRegion.Selected.Value
    ),
    "gnl_Compania", SortOrder.Ascending
)
```

### Generar código automático (nuevo registro)

```powerfx
// En el campo CodigoEntidad del formulario, DefaultValue:
"ENT-" & Text(
    Value(
        Mid(
            Last(
                Sort(
                    Filter(gnl_Entidad, StartsWith(gnl_CodigoEntidad, "ENT-")),
                    gnl_CodigoEntidad, SortOrder.Descending
                )
            ).gnl_CodigoEntidad,
            5
        )
    ) + 1,
    "00000"
)
```

---

## Detalle Entidad (scrEntidadDetalle)

### Control de modo Ver/Editar

```powerfx
// Toggle modo edición
frmEntidad.DefaultMode:
    If(togModoEdicion.Value, FormMode.Edit, FormMode.View)

// Botones visibles solo en modo edición
btnGuardar.Visible:  togModoEdicion.Value
btnCancelar.Visible: togModoEdicion.Value
btnEditar.Visible:   !togModoEdicion.Value
```

### Navegación entre tabs de subgrid

```powerfx
// Botón Tab Contactos
btnTabContactos.OnSelect:
    Set(varTabActivo, "Contactos")

// Subrayado activo del tab
rectUnderlineContactos.Visible:
    varTabActivo = "Contactos"

// Items del subgrid dinámico
galSubgrid.Items:
Switch(varTabActivo,
    "Contactos",
    Filter(gnl_Contacto, gnl_EntidadId.gnl_CodigoEntidad = varEntidadSeleccionada.gnl_CodigoEntidad),
    "Oportunidades",
    Filter(gnl_Oportunidad, gnl_EntidadId.gnl_CodigoEntidad = varEntidadSeleccionada.gnl_CodigoEntidad),
    "Documentos",
    Filter(gnl_Documento, gnl_EntidadId.gnl_CodigoEntidad = varEntidadSeleccionada.gnl_CodigoEntidad),
    // Default vacío
    Filter(gnl_Contacto, false)
)
```

### Botón añadir subregistro

```powerfx
btnAddSubitem.OnSelect:
Switch(varTabActivo,
    "Contactos",
    Set(varEntidadParaSubregistro, varEntidadSeleccionada);
    NewForm(frmContacto);
    Navigate(scrContactoForm, ScreenTransition.Fade),
    "Oportunidades",
    Set(varEntidadParaSubregistro, varEntidadSeleccionada);
    NewForm(frmOportunidad);
    Navigate(scrOportunidadForm, ScreenTransition.Fade),
    "Documentos",
    Set(varEntidadParaSubregistro, varEntidadSeleccionada);
    NewForm(frmDocumento);
    Navigate(scrDocumentoForm, ScreenTransition.Fade)
)
```

---

## Contactos (scrContactos / scrContactoForm)

### Lista con semáforo de seguimiento

```powerfx
galContactos.Items:
SortByColumns(
    Filter(
        gnl_Contacto,
        txtBuscarContacto.Text = "" ||
            StartsWith(Lower(gnl_Nombre), Lower(txtBuscarContacto.Text)) ||
            StartsWith(Lower(gnl_Email), Lower(txtBuscarContacto.Text))
    ),
    "gnl_DemorarContactoAfecha", SortOrder.Ascending
)

// Icono semáforo por urgencia
icoSemaforo.Color:
If(
    IsBlank(ThisItem.gnl_DemorarContactoAfecha), RGBA(180,180,180,1),  // Gris: sin fecha
    ThisItem.gnl_DemorarContactoAfecha < Today(), RGBA(209,52,56,1),   // Rojo: vencido
    ThisItem.gnl_DemorarContactoAfecha <= DateAdd(Today(),7,TimeUnit.Days), RGBA(255,140,0,1),  // Naranja: próximo
    RGBA(16,124,16,1)  // Verde: ok
)
```

### Formulario contacto — DefaultValue del Lookup de Entidad

```powerfx
// Cuando venimos del detalle de entidad, pre-rellenar:
frmContacto_EntidadId.DefaultValue:
    If(!IsBlank(varEntidadParaSubregistro),
        varEntidadParaSubregistro,
        Blank()
    )
```

---

## Oportunidades (scrOportunidades)

### Vista Kanban por Timing

```powerfx
// Colección para columnas Kanban
ClearCollect(colKanbanColumnas,
    {timing: "Corto plazo", valor: 100, color: RGBA(209,52,56,1)},
    {timing: "Medio plazo", valor: 200, color: RGBA(255,140,0,1)},
    {timing: "Largo plazo", valor: 300, color: RGBA(0,120,212,1)},
    {timing: "En negociación", valor: 400, color: RGBA(16,124,16,1)}
)

// Items de cada columna Kanban (repetir por columna)
galKanbanCorto.Items:
    Filter(galOportunidadesFiltradas.AllItems, gnl_Timing = 100)

galKanbanMedio.Items:
    Filter(galOportunidadesFiltradas.AllItems, gnl_Timing = 200)
```

### Suma de oportunidades por columna

```powerfx
// Total oportunidades en Corto Plazo
lblTotalCorto.Text:
    Text(CountRows(Filter(gnl_Oportunidad, gnl_Timing = 100))) & " ops"
```

---

## Documentos — Control de estado NDA

```powerfx
// Color de fila según estado NDA
galDocumentos.TemplateFill:
If(
    IsBlank(ThisItem.gnl_FechaExpiracionNDA) || ThisItem.gnl_NDA <> 100,
    White,
    If(
        ThisItem.gnl_FechaExpiracionNDA < Today(),
        RGBA(253, 231, 233, 1),   // Fondo rojo claro — expirado
        If(
            ThisItem.gnl_FechaExpiracionNDA <= DateAdd(Today(), 30, TimeUnit.Days),
            RGBA(255, 244, 206, 1),  // Fondo amarillo — próximo
            RGBA(223, 246, 221, 1)   // Fondo verde — ok
        )
    )
)
```

---

## Búsqueda Global (scrBusqueda)

```powerfx
// Buscar en todas las tablas simultáneamente
btnBuscar.OnSelect:
Set(varTerminoBusqueda, txtBusquedaGlobal.Text);

// Colección resultado entidades
ClearCollect(colResultadosEntidades,
    AddColumns(
        Filter(gnl_Entidad,
            StartsWith(Lower(gnl_Compania), Lower(varTerminoBusqueda)) ||
            gnl_CodigoEntidad = varTerminoBusqueda
        ),
        "TipoResultado", "Entidad",
        "Subtitulo", gnl_PaisId.gnl_Nombre
    )
);

// Colección resultado contactos
ClearCollect(colResultadosContactos,
    AddColumns(
        Filter(gnl_Contacto,
            StartsWith(Lower(gnl_Nombre), Lower(varTerminoBusqueda)) ||
            StartsWith(Lower(gnl_Email), Lower(varTerminoBusqueda))
        ),
        "TipoResultado", "Contacto",
        "gnl_Compania", gnl_EntidadId.gnl_Compania,
        "Subtitulo", gnl_Cargo
    )
);

Set(varTotalResultados,
    CountRows(colResultadosEntidades) +
    CountRows(colResultadosContactos)
)
```

---

## Utilidades comunes

### Formatear fecha en español

```powerfx
// DD/MM/YYYY o "Sin fecha"
If(IsBlank(fechaValor), "Sin fecha",
    Text(fechaValor, "DD/MM/YYYY")
)
```

### Truncar texto largo

```powerfx
// Máximo 80 caracteres con "..."
If(Len(textoValor) > 80,
    Left(textoValor, 80) & "...",
    textoValor
)
```

### Navegar atrás con historial

```powerfx
// Botón Atrás
btnAtras.OnSelect:
Back()
// O con pantalla explícita:
Navigate(scrEntidades, ScreenTransition.Back)
```

### Toast de notificación (nativo Power Apps)

```powerfx
// Éxito
Notify("Operación completada", NotificationType.Success, 3000)

// Error
Notify("Error: " & Concatenate(Form.Errors, ", "), NotificationType.Error, 5000)

// Advertencia
Notify("El NDA expira en menos de 30 días", NotificationType.Warning, 4000)
```

### Abrir enlace externo

```powerfx
// Abrir link de LinkedIn, NDA, KYC...
Launch(ThisItem.gnl_Linkedin, {}, LaunchTarget.New)
```
