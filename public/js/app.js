// ============ STATE ============
let currentUser = null;
let currentView = 'dashboard';
let previousView = 'search';

// ============ API HELPERS ============
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error de servidor');
  return data;
}

function toast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-check-circle';
  el.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ============ AUTH ============
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUser').value;
  const password = document.getElementById('loginPass').value;
  try {
    const { user } = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    currentUser = user;
    showApp();
  } catch (err) {
    const errEl = document.getElementById('loginError');
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

async function checkSession() {
  try {
    const { user } = await api('/api/me');
    if (user) {
      currentUser = user;
      showApp();
    }
  } catch (e) {}
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  currentUser = null;
  document.getElementById('appPage').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
}

function showApp() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('appPage').classList.remove('hidden');

  document.getElementById('userName').textContent = currentUser.nombre;
  document.getElementById('userRole').textContent = 'Usuario';
  document.getElementById('userAvatar').textContent = currentUser.nombre[0];

  switchView('dashboard');
}

// ============ NAVIGATION ============
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    switchView(view);
  });
});

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const viewEl = document.getElementById(`view-${view}`);
  if (viewEl) viewEl.classList.remove('hidden');

  const navEl = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (navEl) navEl.classList.add('active');

  // Load data
  if (view === 'dashboard') loadDashboard();
  else if (view === 'search') { loadSearch(''); document.getElementById('searchInput').value = ''; }
  else if (view.startsWith('admin-')) loadAdminTable(view.replace('admin-', ''));
}

function goBack() {
  switchView(previousView);
}

// ============ DASHBOARD ============
async function loadDashboard() {
  try {
    const stats = await api('/api/dashboard');
    const grid = document.getElementById('statsGrid');
    grid.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon blue"><i class="fas fa-building"></i></div>
        <div><div class="stat-number">${stats.totalEntidades}</div><div class="stat-label">Entidades</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><i class="fas fa-address-book"></i></div>
        <div><div class="stat-number">${stats.totalContactos}</div><div class="stat-label">Contactos</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange"><i class="fas fa-handshake"></i></div>
        <div><div class="stat-number">${stats.totalOportunidades}</div><div class="stat-label">Oportunidades</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red"><i class="fas fa-file-alt"></i></div>
        <div><div class="stat-number">${stats.totalDocumentos}</div><div class="stat-label">Documentos</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple"><i class="fas fa-globe"></i></div>
        <div><div class="stat-number">${stats.totalPaises}</div><div class="stat-label">Pa&iacute;ses</div></div>
      </div>
    `;

    const colors = ['#0078D4', '#107C10', '#FFB900', '#D13438', '#5C2D91', '#008272', '#005A9E'];
    const chartsGrid = document.getElementById('chartsGrid');
    chartsGrid.innerHTML = `
      <div class="panel">
        <div class="panel-header"><h3>Entidades por Regi&oacute;n</h3></div>
        <div class="panel-body">${renderBarChart(stats.entidadesPorRegion, 'Region', 'total', colors)}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Entidades por Tipo</h3></div>
        <div class="panel-body">${renderBarChart(stats.entidadesPorTipo, 'Tipo', 'total', colors)}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Oportunidades por Timing</h3></div>
        <div class="panel-body">${renderBarChart(stats.oportunidadesPorTiming, 'Timing', 'total', colors)}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Contactos por Probabilidad</h3></div>
        <div class="panel-body">${renderBarChart(stats.probabilidadContactos, 'ProbabilidadExito', 'total', colors)}</div>
      </div>
    `;
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderBarChart(data, labelKey, valueKey, colors) {
  if (!data || data.length === 0) return '<p style="color:#888;">Sin datos</p>';
  const max = Math.max(...data.map(d => d[valueKey]));
  return data.map((d, i) => `
    <div class="chart-bar">
      <div class="chart-bar-label">${d[labelKey] || 'N/A'}</div>
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="width:${(d[valueKey] / max * 100)}%;background:${colors[i % colors.length]}">
          ${d[valueKey]}
        </div>
      </div>
    </div>
  `).join('');
}

// ============ SEARCH ============
let searchTimer = null;
document.getElementById('searchInput').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadSearch(e.target.value), 300);
});

async function loadSearch(query) {
  try {
    const results = await api(`/api/search?q=${encodeURIComponent(query)}`);
    const tbody = document.querySelector('#searchResults tbody');
    if (results.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#888;">No se encontraron resultados. Escribe en el buscador para filtrar.</td></tr>';
      return;
    }
    tbody.innerHTML = results.map(r => `
      <tr>
        <td><span class="badge badge-blue">${esc(r.CodigoEntidad)}</span></td>
        <td><strong>${esc(r.Compania)}</strong></td>
        <td>${esc(r.Region)}</td>
        <td><span class="badge badge-${r.Tipo === 'Matriz' ? 'purple' : 'gray'}">${esc(r.Tipo)}</span></td>
        <td>${esc(r.PaisNombre || r.CodigoPaisNormalizado)}</td>
        <td style="text-align:center">${r.numContactos}</td>
        <td style="text-align:center">${r.numOportunidades}</td>
        <td><button class="btn btn-sm btn-primary" onclick="viewEntity('${esc(r.CodigoEntidad)}')"><i class="fas fa-eye"></i> Ver</button></td>
      </tr>
    `).join('');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ============ ENTITY DETAIL ============
async function viewEntity(codigo) {
  previousView = currentView;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-entity-detail').classList.remove('hidden');

  try {
    const detail = await api(`/api/entidades/${codigo}/detail`);
    const e = detail.entidad;
    const probColors = { 'Muy Alta': 'green', 'Alta': 'blue', 'Media': 'orange', 'Baja': 'red' };

    document.getElementById('entityDetailContent').innerHTML = `
      <div class="entity-header">
        <div class="entity-icon">${e.Compania[0]}</div>
        <div class="entity-title">
          <h2>${esc(e.Compania)}</h2>
          <div class="entity-code">${esc(e.CodigoEntidad)} &middot; ${esc(e.PaisNombre || '')} &middot; <span class="badge badge-${e.Tipo === 'Matriz' ? 'purple' : 'gray'}">${esc(e.Tipo)}</span></div>
        </div>
        <button class="btn btn-primary" onclick="toggleEntityEdit('${esc(e.CodigoEntidad)}')" id="btnEditEntity" style="margin-left:auto;"><i class="fas fa-edit"></i> Editar</button>
      </div>

      <div id="entityDetailFields" data-codigo="${esc(e.CodigoEntidad)}">
        <div class="detail-grid">
          <div class="detail-item"><div class="label">Regi&oacute;n</div><div class="value">${esc(e.Region)}</div></div>
          <div class="detail-item"><div class="label">Pa&iacute;s</div><div class="value">${esc(e.PaisNombre || e.CodigoPaisNormalizado)}</div></div>
          <div class="detail-item"><div class="label">Fiscal Code</div><div class="value">${esc(e.FiscalCode)}</div></div>
          <div class="detail-item"><div class="label">LEI</div><div class="value">${esc(e.LEI)}</div></div>
          <div class="detail-item"><div class="label">Ticker</div><div class="value">${esc(e.Ticker)}</div></div>
          <div class="detail-item"><div class="label">DUNS</div><div class="value">${esc(e.DunsNumber)}</div></div>
          <div class="detail-item"><div class="label">Direcci&oacute;n</div><div class="value">${esc(e.Direccion)}</div></div>
          <div class="detail-item"><div class="label">Comentarios</div><div class="value">${esc(e.Comentarios)}</div></div>
        </div>
      </div>

      <div class="tabs">
        <button class="tab active" onclick="showTab(this, 'tabContactos')"><i class="fas fa-address-book"></i> Contactos (${detail.contactos.length})</button>
        <button class="tab" onclick="showTab(this, 'tabOportunidades')"><i class="fas fa-handshake"></i> Oportunidades (${detail.oportunidades.length})</button>
        <button class="tab" onclick="showTab(this, 'tabDocumentos')"><i class="fas fa-file-alt"></i> Documentos (${detail.documentos.length})</button>
      </div>

      <div class="tab-content active" id="tabContactos">
        <div style="margin-bottom:10px;"><button class="btn btn-sm btn-success" onclick="openCreateModalForEntity('contactos','${esc(e.CodigoEntidad)}')"><i class="fas fa-plus"></i> Nuevo Contacto</button></div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Codigo</th><th>Nombre</th><th>Cargo</th><th>Email</th><th>Tel&eacute;fono</th><th>V&iacute;a</th><th>&Uacute;ltimo Contacto</th><th>Probabilidad</th><th>LinkedIn</th><th>Acciones</th></tr></thead>
            <tbody>
              ${detail.contactos.map(c => `
                <tr>
                  <td><span class="badge badge-blue">${esc(c.CodigoContacto)}</span></td>
                  <td><strong>${esc(c.Nombre)}</strong></td>
                  <td>${esc(c.Cargo)}</td>
                  <td><a href="mailto:${esc(c.Email)}">${esc(c.Email)}</a></td>
                  <td>${esc(c.Telefono1)}</td>
                  <td>${esc(c.Via)}</td>
                  <td>${esc(c.FechaUltimoContacto)}</td>
                  <td><span class="badge badge-${probColors[c.ProbabilidadExito] || 'gray'}">${esc(c.ProbabilidadExito)}</span></td>
                  <td>${c.Linkedin ? `<a href="https://${esc(c.Linkedin)}" target="_blank"><i class="fab fa-linkedin"></i></a>` : '-'}</td>
                  <td class="actions">
                    <button class="btn btn-sm btn-primary" onclick="openEditModalForEntity('contactos','${c.id}','${esc(e.CodigoEntidad)}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteAndReload('contactos','${c.id}','${esc(e.CodigoEntidad)}')"><i class="fas fa-trash"></i></button>
                  </td>
                </tr>
              `).join('')}
              ${detail.contactos.length === 0 ? '<tr><td colspan="10" style="text-align:center;color:#888;padding:20px;">Sin contactos</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>

      <div class="tab-content" id="tabOportunidades">
        <div style="margin-bottom:10px;"><button class="btn btn-sm btn-success" onclick="openCreateModalForEntity('oportunidades','${esc(e.CodigoEntidad)}')"><i class="fas fa-plus"></i> Nueva Oportunidad</button></div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Codigo</th><th>Contraparte</th><th>Owner</th><th>Entrega</th><th>Periodo</th><th>Volumen</th><th>Precio</th><th>Timing</th><th>Origen</th><th>Pr&oacute;x. Pasos NTGY</th><th>Acciones</th></tr></thead>
            <tbody>
              ${detail.oportunidades.map(o => `
                <tr>
                  <td><span class="badge badge-blue">${esc(o.CodigoOportunidad)}</span></td>
                  <td><strong>${esc(o.Contraparte)}</strong></td>
                  <td>${esc(o.OwnerAccount)}</td>
                  <td><span class="badge badge-blue">${esc(o.Entrega)}</span></td>
                  <td>${esc(o.Periodo)}</td>
                  <td>${esc(o.Volumen)}</td>
                  <td><strong>${esc(o.Precio)}</strong></td>
                  <td><span class="badge badge-${o.Timing === 'Inmediato' ? 'green' : 'orange'}">${esc(o.Timing)}</span></td>
                  <td>${esc(o.Origen)}</td>
                  <td>${esc(o.ProximosPasosNTGY)}</td>
                  <td class="actions">
                    <button class="btn btn-sm btn-primary" onclick="openEditModalForEntity('oportunidades','${o.id}','${esc(e.CodigoEntidad)}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteAndReload('oportunidades','${o.id}','${esc(e.CodigoEntidad)}')"><i class="fas fa-trash"></i></button>
                  </td>
                </tr>
              `).join('')}
              ${detail.oportunidades.length === 0 ? '<tr><td colspan="11" style="text-align:center;color:#888;padding:20px;">Sin oportunidades</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>

      <div class="tab-content" id="tabDocumentos">
        <div style="margin-bottom:10px;"><button class="btn btn-sm btn-success" onclick="openCreateModalForEntity('documentos','${esc(e.CodigoEntidad)}')"><i class="fas fa-plus"></i> Nuevo Documento</button></div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Codigo</th><th>KYC</th><th>Link KYC</th><th>NDA</th><th>Expiraci&oacute;n NDA</th><th>Link NDA</th><th>MSPA</th><th>Link MSPA</th><th>Comentarios</th><th>Acciones</th></tr></thead>
            <tbody>
              ${detail.documentos.map(d => `
                <tr>
                  <td><span class="badge badge-blue">${esc(d.CodigoDocumento)}</span></td>
                  <td><span class="badge badge-${d.KYC_S_N === 'S\u00ed' ? 'green' : 'red'}">${esc(d.KYC_S_N)}</span></td>
                  <td>${d.KYC_link ? `<a href="${esc(d.KYC_link)}" target="_blank"><i class="fas fa-external-link-alt"></i> Ver</a>` : '-'}</td>
                  <td><span class="badge badge-${d.NDA_S_N === 'S\u00ed' ? 'green' : 'red'}">${esc(d.NDA_S_N)}</span></td>
                  <td>${esc(d.FechaExpiracionNDA || '-')}</td>
                  <td>${d.NDALink ? `<a href="${esc(d.NDALink)}" target="_blank"><i class="fas fa-external-link-alt"></i> Ver</a>` : '-'}</td>
                  <td><span class="badge badge-${d.MSPASN === 'S\u00ed' ? 'green' : 'red'}">${esc(d.MSPASN)}</span></td>
                  <td>${d.LinkMSPA ? `<a href="${esc(d.LinkMSPA)}" target="_blank"><i class="fas fa-external-link-alt"></i> Ver</a>` : '-'}</td>
                  <td>${esc(d.Comentarios)}</td>
                  <td class="actions">
                    <button class="btn btn-sm btn-primary" onclick="openEditModalForEntity('documentos','${d.id}','${esc(e.CodigoEntidad)}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteAndReload('documentos','${d.id}','${esc(e.CodigoEntidad)}')"><i class="fas fa-trash"></i></button>
                  </td>
                </tr>
              `).join('')}
              ${detail.documentos.length === 0 ? '<tr><td colspan="10" style="text-align:center;color:#888;padding:20px;">Sin documentos</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (e) {
    toast(e.message, 'error');
  }
}

// Toggle entity edit mode
async function toggleEntityEdit(codigo) {
  const container = document.getElementById('entityDetailFields');
  const btn = document.getElementById('btnEditEntity');

  if (container.classList.contains('editing')) {
    // Cancel edit - reload view
    viewEntity(codigo);
    return;
  }

  try {
    const entity = await api(`/api/entidades/${codigo}`);
    const editableFields = [
      { key: 'Compania', label: 'Compania' },
      { key: 'Region', label: 'Region' },
      { key: 'Tipo', label: 'Tipo' },
      { key: 'CodigoPaisNormalizado', label: 'Codigo Pais' },
      { key: 'FiscalCode', label: 'Fiscal Code' },
      { key: 'LEI', label: 'LEI' },
      { key: 'Ticker', label: 'Ticker' },
      { key: 'DunsNumber', label: 'DUNS' },
      { key: 'Direccion', label: 'Direccion' },
      { key: 'Comentarios', label: 'Comentarios' },
    ];

    container.classList.add('editing');
    container.innerHTML = `
      <div class="detail-grid entity-edit-mode">
        ${editableFields.map(f => `
          <div class="detail-item">
            <div class="label">${f.label}</div>
            <input type="text" class="form-control" name="${f.key}" value="${esc(entity[f.key] || '')}">
          </div>
        `).join('')}
      </div>
      <div style="margin-top:12px;display:flex;gap:10px;">
        <button class="btn btn-success" onclick="saveEntityEdit('${esc(codigo)}')"><i class="fas fa-save"></i> Guardar</button>
        <button class="btn btn-outline" onclick="viewEntity('${esc(codigo)}')"><i class="fas fa-times"></i> Cancelar</button>
      </div>
    `;
    btn.innerHTML = '<i class="fas fa-times"></i> Cancelar';
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function saveEntityEdit(codigo) {
  const container = document.getElementById('entityDetailFields');
  const data = {};
  container.querySelectorAll('input').forEach(input => {
    data[input.name] = input.value || null;
  });

  try {
    await api(`/api/entidades/${codigo}`, { method: 'PUT', body: JSON.stringify(data) });
    toast('Entidad actualizada correctamente');
    viewEntity(codigo);
  } catch (e) {
    toast(e.message, 'error');
  }
}

// Open create modal with entity pre-filled and locked
function openCreateModalForEntity(tableName, codigoEntidad) {
  const schema = tableSchemas[tableName];
  if (!schema) return;

  document.getElementById('modalTitle').textContent = `Nuevo registro - ${capitalize(tableName)}`;
  document.getElementById('modalBody').innerHTML = buildForm(schema, { CodigoEntidad: codigoEntidad }, { lockEntity: true });
  document.getElementById('modalSave').onclick = () => saveRecord(tableName, null, () => viewEntity(codigoEntidad));
  document.getElementById('modalOverlay').classList.add('active');
  // Populate dropdown but it will be disabled/locked
  populateEntityDropdown(codigoEntidad);
}

// Open edit modal from entity detail
async function openEditModalForEntity(tableName, id, codigoEntidad) {
  const schema = tableSchemas[tableName];
  if (!schema) return;

  try {
    const record = await api(`/api/${schema.endpoint}/${id}`);
    document.getElementById('modalTitle').textContent = `Editar - ${capitalize(tableName)}`;
    document.getElementById('modalBody').innerHTML = buildForm(schema, record);
    document.getElementById('modalSave').onclick = () => saveRecord(tableName, id, () => viewEntity(codigoEntidad));
    document.getElementById('modalOverlay').classList.add('active');
    if (schema.requiresEntity) populateEntityDropdown(record.CodigoEntidad);
  } catch (e) {
    toast(e.message, 'error');
  }
}

// Delete sub-record and reload entity detail
async function deleteAndReload(tableName, id, codigoEntidad) {
  if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) return;
  const schema = tableSchemas[tableName];
  try {
    await api(`/api/${schema.endpoint}/${id}`, { method: 'DELETE' });
    toast('Registro eliminado');
    viewEntity(codigoEntidad);
  } catch (e) {
    toast(e.message, 'error');
  }
}

function showTab(tabBtn, contentId) {
  tabBtn.closest('.tabs').querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tabBtn.classList.add('active');
  const parent = tabBtn.closest('.view') || document.getElementById('view-entity-detail');
  parent.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  document.getElementById(contentId).classList.add('active');
}

// ============ ADMIN TABLES ============
const tableSchemas = {
  entidades: {
    endpoint: 'entidades',
    pk: 'CodigoEntidad',
    columns: ['CodigoEntidad', 'Compania', 'Region', 'Tipo', 'CodigoPaisNormalizado', 'FiscalCode', 'LEI', 'Ticker', 'DunsNumber', 'Direccion', 'Comentarios'],
    labels: { CodigoEntidad: 'Codigo', Compania: 'Compania', Region: 'Region', Tipo: 'Tipo', CodigoPaisNormalizado: 'Pais', FiscalCode: 'Fiscal Code', LEI: 'LEI', Ticker: 'Ticker', DunsNumber: 'DUNS', Direccion: 'Direccion', Comentarios: 'Comentarios' },
    displayCols: ['CodigoEntidad', 'Compania', 'Region', 'Tipo', 'CodigoPaisNormalizado'],
  },
  contactos: {
    endpoint: 'contactos',
    pk: 'id',
    columns: ['CodigoContacto', 'CodigoEntidad', 'Nombre', 'Cargo', 'Email', 'Telefono1', 'Telefono2', 'Via', 'FechaUltimoContacto', 'DemorarContactoAfecha', 'ProbabilidadExito', 'Linkedin', 'Comentarios'],
    labels: { CodigoContacto: 'Codigo', CodigoEntidad: 'Entidad', Nombre: 'Nombre', Cargo: 'Cargo', Email: 'Email', Telefono1: 'Telefono 1', Telefono2: 'Telefono 2', Via: 'Via', FechaUltimoContacto: 'Ultimo Contacto', DemorarContactoAfecha: 'Demorar a', ProbabilidadExito: 'Probabilidad', Linkedin: 'LinkedIn', Comentarios: 'Comentarios' },
    displayCols: ['CodigoContacto', 'CodigoEntidad', 'Nombre', 'Cargo', 'Email', 'ProbabilidadExito'],
    codeField: 'CodigoContacto',
    requiresEntity: true,
  },
  oportunidades: {
    endpoint: 'oportunidades',
    pk: 'id',
    columns: ['CodigoOportunidad', 'CodigoEntidad', 'Contraparte', 'OwnerAccount', 'Entrega', 'Periodo', 'Volumen', 'Precio', 'SpecsContrapartePCS', 'ProximosPasosNTGY', 'ProximosPasosContraparte', 'Timing', 'Origen', 'Comentarios'],
    labels: { CodigoOportunidad: 'Codigo', CodigoEntidad: 'Entidad', Contraparte: 'Contraparte', OwnerAccount: 'Owner', Entrega: 'Entrega', Periodo: 'Periodo', Volumen: 'Volumen', Precio: 'Precio', SpecsContrapartePCS: 'Specs PCS', ProximosPasosNTGY: 'Prox. NTGY', ProximosPasosContraparte: 'Prox. Contraparte', Timing: 'Timing', Origen: 'Origen', Comentarios: 'Comentarios' },
    displayCols: ['CodigoOportunidad', 'CodigoEntidad', 'Contraparte', 'OwnerAccount', 'Entrega', 'Volumen', 'Precio', 'Timing'],
    codeField: 'CodigoOportunidad',
    requiresEntity: true,
  },
  documentos: {
    endpoint: 'documentos',
    pk: 'id',
    columns: ['CodigoDocumento', 'CodigoEntidad', 'KYC_S_N', 'KYC_link', 'NDA_S_N', 'FechaExpiracionNDA', 'NDALink', 'MSPASN', 'LinkMSPA', 'Comentarios'],
    labels: { CodigoDocumento: 'Codigo', CodigoEntidad: 'Entidad', KYC_S_N: 'KYC', KYC_link: 'Link KYC', NDA_S_N: 'NDA', FechaExpiracionNDA: 'Exp. NDA', NDALink: 'Link NDA', MSPASN: 'MSPA', LinkMSPA: 'Link MSPA', Comentarios: 'Comentarios' },
    displayCols: ['CodigoDocumento', 'CodigoEntidad', 'KYC_S_N', 'NDA_S_N', 'MSPASN', 'Comentarios'],
    codeField: 'CodigoDocumento',
    requiresEntity: true,
  },
  paises: {
    endpoint: 'paises',
    pk: 'CodigoPaisNormalizado',
    columns: ['CodigoPaisNormalizado', 'Nombre', 'Region', 'ReferenciaIndice', 'LinkFichaPais', 'PersonaReferenciaOportun', 'Comentarios'],
    labels: { CodigoPaisNormalizado: 'Codigo', Nombre: 'Nombre', Region: 'Region', ReferenciaIndice: 'Ref. Indice', LinkFichaPais: 'Link Ficha', PersonaReferenciaOportun: 'Persona Ref.', Comentarios: 'Comentarios' },
    displayCols: ['CodigoPaisNormalizado', 'Nombre', 'Region', 'ReferenciaIndice', 'PersonaReferenciaOportun'],
  },
  usuarios: {
    endpoint: 'usuarios',
    pk: 'id',
    columns: ['username', 'nombre', 'rol'],
    labels: { username: 'Usuario', nombre: 'Nombre', rol: 'Rol' },
    displayCols: ['username', 'nombre', 'rol'],
  },
};

async function loadAdminTable(tableName) {
  const schema = tableSchemas[tableName];
  if (!schema) return;

  try {
    const data = await api(`/api/${schema.endpoint}`);
    const container = document.getElementById(`table${capitalize(tableName)}`);
    if (!container) return;

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            ${schema.displayCols.map(c => `<th>${schema.labels[c] || c}</th>`).join('')}
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${schema.displayCols.map(c => `<td>${esc(row[c])}</td>`).join('')}
              <td class="actions">
                <button class="btn btn-sm btn-primary" onclick="openEditModal('${tableName}', '${esc(row[schema.pk])}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteRecord('${tableName}', '${esc(row[schema.pk])}')"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
          `).join('')}
          ${data.length === 0 ? `<tr><td colspan="${schema.displayCols.length + 1}" style="text-align:center;color:#888;padding:30px;">No hay registros</td></tr>` : ''}
        </tbody>
      </table>
    `;
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ============ CRUD MODALS ============
function openCreateModal(tableName) {
  const schema = tableSchemas[tableName];
  if (!schema) return;

  document.getElementById('modalTitle').textContent = `Nuevo registro - ${capitalize(tableName)}`;
  document.getElementById('modalBody').innerHTML = buildForm(schema, {});
  document.getElementById('modalSave').onclick = () => saveRecord(tableName, null);
  document.getElementById('modalOverlay').classList.add('active');
  if (schema.requiresEntity) populateEntityDropdown(null);
}

async function openEditModal(tableName, id) {
  const schema = tableSchemas[tableName];
  if (!schema) return;

  try {
    const record = await api(`/api/${schema.endpoint}/${id}`);
    document.getElementById('modalTitle').textContent = `Editar - ${capitalize(tableName)}`;
    document.getElementById('modalBody').innerHTML = buildForm(schema, record);
    document.getElementById('modalSave').onclick = () => saveRecord(tableName, id);
    document.getElementById('modalOverlay').classList.add('active');
    if (schema.requiresEntity) populateEntityDropdown(record.CodigoEntidad);
  } catch (e) {
    toast(e.message, 'error');
  }
}

function buildForm(schema, data, options = {}) {
  const cols = schema.columns.filter(c => c !== 'id');
  return `<div class="form-row">${cols.map(col => {
    const isCodeField = schema.codeField && col === schema.codeField;
    const isPk = schema.pk === col && data[col];
    const isEntityField = col === 'CodigoEntidad' && schema.requiresEntity;
    const isLockedEntity = isEntityField && options.lockEntity;

    if (isCodeField) {
      return `
        <div class="form-group">
          <label>${schema.labels[col] || col}</label>
          <input type="text" class="form-control" name="${col}" value="${esc(data[col] || '')}" readonly placeholder="Auto-generado" style="background:#f0f0f0;">
        </div>`;
    }

    if (isEntityField) {
      return `
        <div class="form-group">
          <label>${schema.labels[col] || col}</label>
          <select class="form-control" name="${col}" id="entityDropdown" ${isLockedEntity ? 'disabled' : ''}>
            <option value="">-- Seleccionar entidad --</option>
          </select>
          ${isLockedEntity ? `<input type="hidden" name="${col}" value="${esc(data[col] || '')}">` : ''}
        </div>`;
    }

    return `
      <div class="form-group">
        <label>${schema.labels[col] || col}</label>
        <input type="text" class="form-control" name="${col}" value="${esc(data[col] || '')}" ${isPk ? 'readonly' : ''}>
      </div>`;
  }).join('')}</div>`;
}

async function populateEntityDropdown(selectedValue) {
  try {
    const entidades = await api('/api/entidades-list');
    const select = document.getElementById('entityDropdown');
    if (!select) return;
    // Keep the first placeholder option
    select.innerHTML = '<option value="">-- Seleccionar entidad --</option>';
    entidades.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.CodigoEntidad;
      opt.textContent = `${e.CodigoEntidad} - ${e.Compania}`;
      if (e.CodigoEntidad === selectedValue) opt.selected = true;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error('Error loading entidades list:', e);
  }
}

async function saveRecord(tableName, id, callback) {
  const schema = tableSchemas[tableName];
  const form = document.getElementById('modalBody');
  const data = {};

  form.querySelectorAll('input, select, textarea').forEach(input => {
    if (input.name) {
      // For disabled select with hidden input, skip the disabled select
      if (input.tagName === 'SELECT' && input.disabled) return;
      data[input.name] = input.value || null;
    }
  });

  // Remove auto-generated code field if empty (server will generate)
  if (schema.codeField && (!data[schema.codeField] || data[schema.codeField].trim() === '')) {
    delete data[schema.codeField];
  }

  try {
    if (id) {
      await api(`/api/${schema.endpoint}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      toast('Registro actualizado correctamente');
    } else {
      await api(`/api/${schema.endpoint}`, { method: 'POST', body: JSON.stringify(data) });
      toast('Registro creado correctamente');
    }
    closeModal();
    if (callback) {
      callback();
    } else {
      loadAdminTable(tableName);
    }
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function deleteRecord(tableName, id) {
  if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) return;
  const schema = tableSchemas[tableName];
  try {
    await api(`/api/${schema.endpoint}/${id}`, { method: 'DELETE' });
    toast('Registro eliminado');
    loadAdminTable(tableName);
  } catch (e) {
    toast(e.message, 'error');
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

// Close modal on overlay click
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

// ============ USER MANAGEMENT ============
function openUserModal() {
  document.getElementById('modalTitle').textContent = 'Nuevo Usuario';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label>Usuario</label>
        <input type="text" class="form-control" name="username" required>
      </div>
      <div class="form-group">
        <label>Contrase&ntilde;a</label>
        <input type="password" class="form-control" name="password" required>
      </div>
      <div class="form-group">
        <label>Nombre</label>
        <input type="text" class="form-control" name="nombre" required>
      </div>
      <input type="hidden" name="rol" value="user">
    </div>
  `;
  document.getElementById('modalSave').onclick = async () => {
    const form = document.getElementById('modalBody');
    const data = {};
    form.querySelectorAll('input, select').forEach(i => data[i.name] = i.value);
    try {
      await api('/api/usuarios', { method: 'POST', body: JSON.stringify(data) });
      toast('Usuario creado');
      closeModal();
      loadAdminTable('usuarios');
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  document.getElementById('modalOverlay').classList.add('active');
}

// ============ IMPORT ============
async function importExcel(input) {
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    toast('Importando datos...', 'warning');
    const res = await fetch('/api/import', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    const resultsDiv = document.getElementById('importResults');
    resultsDiv.classList.remove('hidden');
    resultsDiv.innerHTML = `
      <div class="panel" style="margin-top:16px;">
        <div class="panel-header"><h3>Resultado de la importaci&oacute;n</h3></div>
        <div class="panel-body">
          ${Object.entries(data.results).map(([table, r]) => `
            <div style="margin-bottom:12px;">
              <strong>${table}</strong>:
              <span class="badge badge-green">${r.inserted} insertados</span>
              <span class="badge badge-blue">${r.updated} actualizados</span>
              ${r.errors.length > 0 ? `<span class="badge badge-red">${r.errors.length} errores</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
    toast('Importaci\u00f3n completada con \u00e9xito');
  } catch (e) {
    toast('Error en la importaci\u00f3n: ' + e.message, 'error');
  }

  input.value = '';
}

// ============ UTILITIES ============
function esc(val) {
  if (val == null) return '';
  return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============ AI CHAT ============
let aiChatOpen = false;
let aiFirstOpen = true;

function toggleAiChat() {
  aiChatOpen = !aiChatOpen;
  const panel = document.getElementById('aiChatPanel');
  const fab = document.getElementById('aiChatFab');

  if (aiChatOpen) {
    panel.classList.add('active');
    fab.classList.add('active');
    if (aiFirstOpen) {
      aiFirstOpen = false;
      addAiMessage('bot', '¡Hola! Soy el Asistente IA del CRM GNL. Consulto datos reales de la base de datos.\n\nPuedes preguntarme sobre:\n- **Nombre de un país** (ej: "India")\n- **"NDA"** o **"documentos"**\n- **"Oportunidades"** o **"pipeline"**\n- **"Próximos pasos"** o **"acciones"**\n- **"Contactos"** o **"seguimiento"**\n- **"Resumen"** o **"dashboard"**');
    }
    document.getElementById('aiChatInput').focus();
  } else {
    panel.classList.remove('active');
    fab.classList.remove('active');
  }
}

function formatAiText(text) {
  // Convert **bold** to <strong>
  let html = esc(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Convert newlines to <br>
  html = html.replace(/\n/g, '<br>');
  return html;
}

function addAiMessage(type, text) {
  const container = document.getElementById('aiChatMessages');
  const msg = document.createElement('div');
  msg.className = `ai-msg ${type}`;
  if (type === 'bot') {
    msg.innerHTML = formatAiText(text);
  } else {
    msg.textContent = text;
  }
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

async function sendAiMessage() {
  const input = document.getElementById('aiChatInput');
  const text = input.value.trim();
  if (!text) return;

  addAiMessage('user', text);
  input.value = '';

  // Show typing indicator
  const container = document.getElementById('aiChatMessages');
  const typing = document.createElement('div');
  typing.className = 'ai-typing';
  typing.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;

  try {
    const data = await api('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message: text }),
    });
    typing.remove();
    addAiMessage('bot', data.response);
  } catch (e) {
    typing.remove();
    addAiMessage('bot', 'Error al procesar la consulta: ' + e.message);
  }
}

// ============ INIT ============
checkSession();
