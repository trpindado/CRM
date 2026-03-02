# 05 — Agente IA con Copilot Studio

> Sustituye la integración directa con OpenAI del CRM actual.
> Copilot Studio permite crear un agente con acceso nativo a Dataverse, sin necesidad de gestionar API keys.

---

## Arquitectura del agente

```
Power Apps (scrAsistenteIA)
    │
    │  [Componente de chat embebido o iframe]
    ▼
Copilot Studio — Agente "CRM GNL Assistant"
    │
    ├── Knowledge Sources
    │     └── Dataverse (gnl_Entidad, gnl_Contacto, gnl_Oportunidad, gnl_Documento, gnl_Pais)
    │
    ├── Topics (intenciones)
    │     ├── ConsultarEntidad
    │     ├── ConsultarOportunidades
    │     ├── ConsultarNDAs
    │     ├── ConsultarContactos
    │     ├── ResumenDashboard
    │     └── PreguntaGeneral (fallback a GPT)
    │
    ├── Actions (Power Automate flows)
    │     ├── ObtenerEntidadesPorPais
    │     ├── ObtenerOportunidadesPorTiming
    │     ├── ObtenerNDAsProximos
    │     └── ObtenerContactosSeguimiento
    │
    └── Generative AI (GPT-4o en backend de Microsoft)
          └── Con contexto de los datos de Dataverse
```

---

## Paso 1 — Crear el agente en Copilot Studio

1. Ir a **copilotstudio.microsoft.com**
2. **Crear** → **Nuevo agente**
3. Nombre: `CRM GNL Assistant`
4. Descripción: `Asistente especializado del CRM de Gas Natural Licuado. Proporciona información sobre entidades, oportunidades, contactos y documentos.`
5. Idioma principal: **Español**
6. **Instrucciones del sistema (System Prompt):**

```
Eres el asistente del CRM GNL (Gas Natural Licuado) de Naturgy.
Respondes en español, de forma concisa y estructurada.
Tienes acceso a la base de datos del CRM con información sobre:
- Entidades (empresas): distribuidores, productores, traders de GNL a nivel mundial
- Contactos: personas de contacto en cada entidad
- Oportunidades: pipeline comercial con timings y volúmenes
- Documentos: estado de NDAs, KYC y MSPAs
- Países: geografía y referencias de mercado

Cuando respondas:
- Usa **negrita** para destacar nombres, cifras y fechas clave
- Estructura la respuesta con listas cuando haya múltiples items
- Si no tienes datos suficientes, dilo claramente y sugiere cómo obtenerlos
- No inventes datos — consulta siempre las acciones disponibles
```

---

## Paso 2 — Conectar Dataverse como Knowledge Source

1. En el agente → **Conocimiento** → **Añadir conocimiento**
2. Seleccionar **Dataverse**
3. Añadir las siguientes tablas:
   - `gnl_Entidad` — columnas indexadas: Compania, CodigoEntidad, Region, Tipo
   - `gnl_Oportunidad` — columnas indexadas: Contraparte, Timing, Periodo
   - `gnl_Contacto` — columnas indexadas: Nombre, Email, Cargo
   - `gnl_Pais` — columnas indexadas: Nombre, CodigoPaisNormalizado
   - `gnl_Documento` — columnas indexadas: NDA, FechaExpiracionNDA

> Copilot Studio generará automáticamente respuestas usando GPT con estos datos como contexto.

---

## Paso 3 — Crear Topics (intenciones)

### Topic: ConsultarEntidadesPorPais

**Frases de activación:**
- "entidades en [país]"
- "empresas de [país]"
- "qué entidades hay en [país]"
- "muéstrame las empresas de [país]"

**Flujo del topic:**

```
[Trigger] → Extraer entidad "País" con NLP
          → [Condición] ¿Se identificó país?
              SÍ → Llamar Action: ObtenerEntidadesPorPais(pais)
                 → Mostrar respuesta formateada
              NO → Preguntar: "¿De qué país quieres ver las entidades?"
                 → Volver al inicio del topic
```

**Respuesta adaptativa:**
```
Se encontraron **{ConteoEntidades}** entidades en **{NombrePais}**:

{Tabla con Compania, Tipo, CodigoEntidad}

¿Quieres ver las oportunidades o contactos de alguna de estas entidades?
```

---

### Topic: ConsultarNDAs

**Frases de activación:**
- "NDAs próximos a vencer"
- "NDAs expirados"
- "documentos NDA"
- "vencimientos NDA"
- "estado de los NDAs"

**Flujo:**
```
[Trigger] → Llamar Action: ObtenerNDAsProximos(dias=30)
          → Mostrar lista de NDAs con días restantes
          → Ofrecer: "¿Quieres ver también los KYC o MSPAs?"
```

---

### Topic: ResumenDashboard

**Frases de activación:**
- "resumen del CRM"
- "dame un resumen"
- "dashboard"
- "estadísticas generales"
- "cuántas entidades hay"

**Respuesta:**
```
**Resumen CRM GNL** — {Fecha actual}

📊 **Totales:**
- Entidades: **{N}** en **{NPaises}** países
- Contactos: **{N}**
- Oportunidades activas: **{N}**
- NDAs vigentes: **{N}**

⚡ **Oportunidades por timing:**
- Corto plazo: **{N}**
- Medio plazo: **{N}**
- Largo plazo: **{N}**

⚠️ **Alertas:**
- NDAs próximos a vencer (30 días): **{N}**
- Contactos con seguimiento pendiente: **{N}**
```

---

## Paso 4 — Crear Actions (Power Automate Flows)

### Action: ObtenerEntidadesPorPais

**Trigger:** Copilot Studio (HTTP request)
**Input:** `pais` (texto)
**Pasos del flow:**

```
1. List rows (Dataverse)
   Tabla: gnl_Entidad
   Filtro: gnl_PaisId/gnl_Nombre eq '{pais}' or
           gnl_PaisId/gnl_CodigoPaisNormalizado eq '{pais}'
   Select: gnl_Compania, gnl_CodigoEntidad, gnl_Tipo, gnl_Region

2. Compose — Formatear resultado:
   "Entidades en {pais}: {count}"
   + tabla markdown con los resultados

3. Respond to Copilot
   Output: texto formateado
```

---

### Action: ObtenerNDAsProximos

**Input:** `dias` (número, default 30)
**Pasos del flow:**

```
1. Get current date (Expression: utcNow())

2. List rows (Dataverse)
   Tabla: gnl_Documento
   Filtro: gnl_NDA eq 100 and
           gnl_FechaExpiracionNDA le {hoy + dias días} and
           gnl_FechaExpiracionNDA ge {hoy}
   Expand: gnl_EntidadId($select=gnl_Compania,gnl_CodigoEntidad)
   Order by: gnl_FechaExpiracionNDA asc

3. Apply to each resultado:
   Calcular días restantes: dateDifference(gnl_FechaExpiracionNDA, hoy)

4. Compose respuesta markdown

5. Respond to Copilot
```

---

### Action: ObtenerContactosSeguimiento

**Input:** `dias` (número, default 7)
**Pasos:**

```
1. List rows (Dataverse)
   Tabla: gnl_Contacto
   Filtro: gnl_DemorarContactoAfecha ge {hoy} and
           gnl_DemorarContactoAfecha le {hoy + dias}
   Order by: gnl_DemorarContactoAfecha asc
   Expand: gnl_EntidadId($select=gnl_Compania)

2. Respond to Copilot con lista formateada
```

---

## Paso 5 — Integrar el agente en Power Apps

### Opción A: Componente nativo (recomendada si disponible en tu tenant)

```powerfx
// En scrAsistenteIA, añadir el control:
// Insertar → Chatbot → seleccionar "CRM GNL Assistant"
// El control gestiona automáticamente el contexto de usuario (AAD)
```

### Opción B: WebView con URL del agente

```powerfx
// Control WebBrowser apuntando al canal "Custom Website" del agente
webCopilot.Url: "https://copilotstudio.microsoft.com/environments/{envId}/bots/{botId}/webchat"
webCopilot.Width: 400
webCopilot.Height: Parent.Height - 100
```

### Opción C: Power Automate desde botón Send

```powerfx
// Botón enviar mensaje al agente via flow
btnEnviarMensajeIA.OnSelect:
Set(varRespuestaIA, "...");
Set(varCargandoIA, true);
Set(varRespuestaIA,
    PAFlow_ConsultarAgente.Run(txtMensajeIA.Text).respuesta
);
Set(varCargandoIA, false)
```

---

## Paso 6 — Publicar y compartir el agente

1. **Copilot Studio** → el agente → **Publicar**
2. Canales disponibles:
   - **Teams** (recomendado para adopción rápida)
   - **Power Apps** (embebido en la app)
   - **Sitio web personalizado** (iframe en intranet)
3. Compartir con los usuarios del CRM mediante grupos de seguridad AAD

---

## Permisos necesarios

| Recurso | Permiso |
|---|---|
| Copilot Studio | Licencia Copilot Studio o Microsoft 365 Copilot |
| Power Automate flows | Acceso a Dataverse (incluido en la licencia) |
| Dataverse | Read sobre todas las tablas gnl_* |
| Azure AD | Sin permisos adicionales — usa la sesión del usuario |
