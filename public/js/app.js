// ============ STATE ============
let currentUser = null;
let currentView = 'dashboard';
let previousView = 'search';
const adminTableData = {};
let dashboardMap = null;

// ============ COUNTRY COORDINATES (ISO 3166-1 alpha-3) ============
const COUNTRY_COORDS = {
  ANG: [-11.20, 17.87],   // Angola
  ARE: [24.00,  54.00],   // UAE
  ARG: [-38.42, -63.62],  // Argentina
  AUS: [-25.27, 133.78],  // Australia
  BEL: [50.50,   4.47],   // Belgium
  BGD: [23.68,  90.36],   // Bangladesh
  BRA: [-14.24, -51.93],  // Brazil
  CHL: [-35.68, -71.54],  // Chile
  CHN: [35.86,  104.20],  // China
  COL: [4.57,   -74.30],  // Colombia
  DEU: [51.17,   10.45],  // Germany
  DNK: [56.26,    9.50],  // Denmark
  EGY: [26.82,   30.80],  // Egypt
  ESP: [40.46,   -3.75],  // Spain
  FIN: [61.92,   25.75],  // Finland
  FRA: [46.60,    1.89],  // France
  GBR: [52.36,   -1.17],  // United Kingdom
  GRC: [39.07,   21.82],  // Greece
  IDN: [-0.79,  113.92],  // Indonesia
  IND: [20.59,   78.96],  // India
  ITA: [41.87,   12.57],  // Italy
  JPN: [36.20,  138.25],  // Japan
  KOR: [36.00,  127.77],  // South Korea
  KWT: [29.31,   47.48],  // Kuwait
  MEX: [23.63, -102.55],  // Mexico
  MOZ: [-18.67,  35.53],  // Mozambique
  MRT: [20.96,  -10.94],  // Mauritania
  MYS: [4.21,   108.96],  // Malaysia
  NGA: [9.08,     8.68],  // Nigeria
  NLD: [52.13,    5.29],  // Netherlands
  NOR: [60.47,    8.47],  // Norway
  OMN: [21.47,   55.98],  // Oman
  PAK: [30.38,   69.35],  // Pakistan
  PER: [-9.19,  -75.02],  // Peru
  PHL: [12.88,  121.77],  // Philippines
  PNG: [-6.31,  143.96],  // Papua New Guinea
  POL: [51.92,   19.15],  // Poland
  PRT: [39.40,   -8.22],  // Portugal
  QAT: [25.35,   51.18],  // Qatar
  RUS: [61.52,  105.32],  // Russia
  SGP: [1.35,   103.82],  // Singapore
  SWE: [60.13,   18.64],  // Sweden
  THA: [15.87,  100.99],  // Thailand
  TTO: [10.69,  -61.22],  // Trinidad and Tobago
  TUR: [38.96,   35.24],  // Turkey
  TWN: [23.70,  120.96],  // Taiwan
  TZA: [-6.37,   34.89],  // Tanzania
  USA: [37.09,  -95.71],  // United States
  VNM: [14.06,  108.28],  // Vietnam
  // LNG (LNG-Territory) omitido: territorio virtual sin coordenadas geográficas
};

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
  document.getElementById('userRole').textContent = currentUser.rol === 'admin' ? 'Administrador' : 'Usuario';
  document.getElementById('userAvatar').textContent = currentUser.nombre[0];

  // Show/hide admin-only menu items
  const navUsuarios = document.getElementById('navUsuarios');
  if (navUsuarios) navUsuarios.style.display = currentUser.rol === 'admin' ? '' : 'none';

  switchView('dashboard');
}

// ============ NAVIGATION ============
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    switchView(view);
  });
});

function switchView(view, skipAutoLoad) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const viewEl = document.getElementById(`view-${view}`);
  if (viewEl) viewEl.classList.remove('hidden');

  const navEl = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (navEl) navEl.classList.add('active');

  // Load data
  if (view === 'dashboard') loadDashboard();
  else if (view === 'search') {
    if (!skipAutoLoad) { loadSearch(''); document.getElementById('searchInput').value = ''; }
  }
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
      <div class="stat-card" style="cursor:pointer" onclick="switchView('admin-entidades')">
        <div class="stat-icon blue"><i class="fas fa-building"></i></div>
        <div><div class="stat-number">${stats.totalEntidades}</div><div class="stat-label">Entidades</div></div>
      </div>
      <div class="stat-card" style="cursor:pointer" onclick="switchView('admin-contactos')">
        <div class="stat-icon green"><i class="fas fa-address-book"></i></div>
        <div><div class="stat-number">${stats.totalContactos}</div><div class="stat-label">Contactos</div></div>
      </div>
      <div class="stat-card" style="cursor:pointer" onclick="switchView('admin-oportunidades')">
        <div class="stat-icon orange"><i class="fas fa-handshake"></i></div>
        <div><div class="stat-number">${stats.totalOportunidades}</div><div class="stat-label">Oportunidades</div></div>
      </div>
      <div class="stat-card" style="cursor:pointer" onclick="switchView('admin-documentos')">
        <div class="stat-icon red"><i class="fas fa-file-alt"></i></div>
        <div><div class="stat-number">${stats.totalDocumentos}</div><div class="stat-label">Documentos</div></div>
      </div>
      <div class="stat-card" style="cursor:pointer" onclick="switchView('admin-paises')">
        <div class="stat-icon purple"><i class="fas fa-globe"></i></div>
        <div><div class="stat-number">${stats.totalPaises}</div><div class="stat-label">Pa&iacute;ses</div></div>
      </div>
    `;

    const colors = ['#0078D4', '#107C10', '#FFB900', '#D13438', '#5C2D91', '#008272', '#005A9E'];
    const chartsGrid = document.getElementById('chartsGrid');
    chartsGrid.innerHTML = `
      <div class="panel">
        <div class="panel-header"><h3>Entidades por Regi&oacute;n</h3></div>
        <div class="panel-body">${renderBarChart(stats.entidadesPorRegion, 'Region', 'total', colors, 'admin-entidades', 'Region')}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Entidades por Tipo</h3></div>
        <div class="panel-body">${renderBarChart(stats.entidadesPorTipo, 'Tipo', 'total', colors, 'admin-entidades', 'Tipo')}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Oportunidades por Timing</h3></div>
        <div class="panel-body">${renderBarChart(stats.oportunidadesPorTiming, 'Timing', 'total', colors, 'admin-oportunidades', 'Timing')}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Contactos por Probabilidad</h3></div>
        <div class="panel-body">${renderBarChart(stats.probabilidadContactos, 'ProbabilidadExito', 'total', colors, 'admin-contactos', 'ProbabilidadExito')}</div>
      </div>
    `;

    initDashboardMap(stats.entidadesPorPais);
  } catch (e) {
    toast(e.message, 'error');
  }
}

function initDashboardMap(data) {
  if (!data || data.length === 0) return;

  // Remove old map instance if re-loading
  if (dashboardMap) {
    dashboardMap.remove();
    dashboardMap = null;
  }

  dashboardMap = L.map('dashboardMap', { scrollWheelZoom: true }).setView([20, 0], 2);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(dashboardMap);

  const maxCount = Math.max(...data.map(d => d.numEntidades));
  const bounds = [];

  data.forEach(d => {
    const coords = COUNTRY_COORDS[d.CodigoPaisNormalizado];
    if (!coords) return;

    const radius = Math.max(6, Math.min(20, (d.numEntidades / maxCount) * 20));
    const marker = L.circleMarker(coords, {
      radius: radius,
      fillColor: '#0078D4',
      color: '#005A9E',
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.6,
    }).addTo(dashboardMap);

    marker.bindTooltip(`${d.Nombre}: ${d.numEntidades}`, { direction: 'top', offset: [0, -radius] });

    const popupContent = `
      <div class="map-popup">
        <div class="map-popup-title">${esc(d.Nombre)}</div>
        <div class="map-popup-region">${esc(d.Region || 'Sin regi\u00f3n')}</div>
        <div class="map-popup-count">${d.numEntidades} entidad${d.numEntidades !== 1 ? 'es' : ''}</div>
        <button class="map-popup-link" onclick="searchByCountry('${esc(d.Nombre)}')">
          <i class="fas fa-search"></i> Ver Entidades
        </button>
      </div>`;
    marker.bindPopup(popupContent);

    bounds.push(coords);
  });

  if (bounds.length > 0) {
    dashboardMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 5 });
  }

  // Fix Leaflet rendering when container was hidden
  setTimeout(() => { dashboardMap.invalidateSize(); }, 200);
}

function searchByCountry(countryName) {
  switchView('search', true);
  const input = document.getElementById('searchInput');
  input.value = countryName;
  loadSearch(countryName);
}

function renderBarChart(data, labelKey, valueKey, colors, targetView, filterField) {
  if (!data || data.length === 0) return '<p style="color:#888;">Sin datos</p>';
  const max = Math.max(...data.map(d => d[valueKey]));
  return data.map((d, i) => {
    const label = d[labelKey] || 'N/A';
    const clickAttr = targetView ? `onclick="navigateWithFilter('${targetView}', '${filterField}', '${esc(label)}')" style="cursor:pointer"` : '';
    return `
    <div class="chart-bar" ${clickAttr}>
      <div class="chart-bar-label">${label}</div>
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="width:${(d[valueKey] / max * 100)}%;background:${colors[i % colors.length]}">
          ${d[valueKey]}
        </div>
      </div>
    </div>`;
  }).join('');
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
        <button class="tab" onclick="showTab(this, 'tabPais')"><i class="fas fa-globe"></i> Pa&iacute;s</button>
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

      <div class="tab-content" id="tabPais">
        ${detail.pais ? `
        <div class="detail-grid" style="margin-top:8px;">
          <div class="detail-item">
            <div class="label">C&oacute;digo Pa&iacute;s</div>
            <div class="value"><span class="badge badge-blue">${esc(detail.pais.CodigoPaisNormalizado)}</span></div>
          </div>
          <div class="detail-item">
            <div class="label">Nombre</div>
            <div class="value"><strong>${esc(detail.pais.Nombre)}</strong></div>
          </div>
          <div class="detail-item">
            <div class="label">Regi&oacute;n</div>
            <div class="value">${esc(detail.pais.Region)}</div>
          </div>
          <div class="detail-item">
            <div class="label">Referencia &Iacute;ndice</div>
            <div class="value">${esc(detail.pais.ReferenciaIndice)}</div>
          </div>
          <div class="detail-item">
            <div class="label">Ficha Pa&iacute;s</div>
            <div class="value">${detail.pais.LinkFichaPais
              ? `<a href="${esc(detail.pais.LinkFichaPais)}" target="_blank" title="Descargar ficha del pa&iacute;s" style="display:inline-flex;align-items:center;gap:6px;"><i class="fas fa-file-download" style="font-size:1.2em;color:#0078D4;"></i> Descargar</a>`
              : '<span style="color:#aaa;">Sin enlace</span>'
            }</div>
          </div>
          <div class="detail-item">
            <div class="label">Persona Referencia Oportunidades</div>
            <div class="value">${esc(detail.pais.PersonaReferenciaOportun)}</div>
          </div>
          <div class="detail-item" style="grid-column:1/-1;">
            <div class="label">Comentarios</div>
            <div class="value">${esc(detail.pais.Comentarios)}</div>
          </div>
        </div>
        ` : '<div style="padding:30px;text-align:center;color:#888;"><i class="fas fa-globe" style="font-size:2em;margin-bottom:8px;display:block;"></i>No hay pa&iacute;s asociado a esta entidad.</div>'}
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
    selectPais: true,
  },
  contactos: {
    endpoint: 'contactos',
    pk: 'id',
    columns: ['CodigoContacto', 'CodigoEntidad', 'Nombre', 'Cargo', 'Email', 'Telefono1', 'Telefono2', 'Via', 'FechaUltimoContacto', 'DemorarContactoAfecha', 'ProbabilidadExito', 'Linkedin', 'Comentarios'],
    labels: { CodigoContacto: 'Codigo', CodigoEntidad: 'Entidad', Nombre: 'Nombre', Cargo: 'Cargo', Email: 'Email', Telefono1: 'Telefono 1', Telefono2: 'Telefono 2', Via: 'Via', FechaUltimoContacto: 'Ultimo Contacto', DemorarContactoAfecha: 'Demorar a', ProbabilidadExito: 'Probabilidad', Linkedin: 'LinkedIn', Comentarios: 'Comentarios' },
    displayCols: ['CodigoContacto', 'CodigoEntidad', 'Nombre', 'Cargo', 'Email', 'ProbabilidadExito', 'Linkedin'],
    urlFields: ['Linkedin'],
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
    linkPairs: { 'KYC_S_N': 'KYC_link', 'NDA_S_N': 'NDALink', 'MSPASN': 'LinkMSPA' },
    codeField: 'CodigoDocumento',
    requiresEntity: true,
  },
  paises: {
    endpoint: 'paises',
    pk: 'CodigoPaisNormalizado',
    columns: ['CodigoPaisNormalizado', 'Nombre', 'Region', 'ReferenciaIndice', 'LinkFichaPais', 'PersonaReferenciaOportun', 'Comentarios'],
    labels: { CodigoPaisNormalizado: 'Codigo', Nombre: 'Nombre', Region: 'Region', ReferenciaIndice: 'Ref. Indice', LinkFichaPais: 'Link Ficha', PersonaReferenciaOportun: 'Persona Ref.', Comentarios: 'Comentarios' },
    displayCols: ['CodigoPaisNormalizado', 'Nombre', 'Region', 'ReferenciaIndice', 'LinkFichaPais', 'PersonaReferenciaOportun'],
    urlFields: ['LinkFichaPais'],
    autoCode: true,
  },
  usuarios: {
    endpoint: 'usuarios',
    pk: 'id',
    columns: ['username', 'password', 'nombre', 'rol'],
    labels: { username: 'Usuario', password: 'Contraseña', nombre: 'Nombre', rol: 'Rol' },
    displayCols: ['username', 'nombre', 'rol'],
  },
};

let pendingFilter = null;

function renderCellValue(col, value, row, schema) {
  const v = value == null ? '' : String(value);

  // URL-only fields → render as icon link
  if (schema.urlFields && schema.urlFields.includes(col)) {
    if (!v) return '-';
    const href = v.startsWith('http') ? v : 'https://' + v;
    if (col === 'Linkedin') {
      return `<a href="${esc(href)}" target="_blank" rel="noopener" title="${esc(v)}" style="color:#0077b5;font-size:17px;"><i class="fab fa-linkedin"></i></a>`;
    }
    return `<a href="${esc(href)}" target="_blank" rel="noopener" title="${esc(v)}" style="color:var(--primary);font-size:15px;"><i class="fas fa-external-link-alt"></i></a>`;
  }

  // linkPairs → append icon to the cell value if the paired link exists
  if (schema.linkPairs && schema.linkPairs[col]) {
    const linkVal = row[schema.linkPairs[col]];
    const cellText = v || '-';
    if (!linkVal) return esc(cellText);
    return `${esc(cellText)} <a href="${esc(linkVal)}" target="_blank" rel="noopener" title="Abrir documento" style="color:var(--primary);margin-left:4px;"><i class="fas fa-external-link-alt"></i></a>`;
  }

  return esc(v);
}

function navigateWithFilter(view, field, value) {
  pendingFilter = { field, value };
  switchView(view);
}

async function loadAdminTable(tableName) {
  const schema = tableSchemas[tableName];
  if (!schema) return;

  try {
    let url = `/api/${schema.endpoint}`;
    let activeFilter = null;
    if (pendingFilter) {
      activeFilter = pendingFilter;
      url += `?${encodeURIComponent(pendingFilter.field)}=${encodeURIComponent(pendingFilter.value)}`;
      pendingFilter = null;
    }
    const data = await api(url);
    adminTableData[tableName] = data;

    // Clear filter input
    const filterInput = document.getElementById(`filter-${tableName}`);
    if (filterInput) filterInput.value = '';

    const container = document.getElementById(`table${capitalize(tableName)}`);
    if (!container) return;

    const filterBanner = activeFilter
      ? `<div style="margin-bottom:12px;padding:8px 16px;background:#e8f0fe;border-radius:6px;display:flex;align-items:center;justify-content:space-between;">
          <span><i class="fas fa-filter" style="color:#0078D4;margin-right:8px;"></i> Filtro: <strong>${esc(activeFilter.field)}</strong> = <strong>${esc(activeFilter.value)}</strong> (${data.length} resultados)</span>
          <button class="btn btn-sm" onclick="loadAdminTable('${tableName}')" style="background:#fff;border:1px solid #ccc;cursor:pointer;"><i class="fas fa-times"></i> Quitar filtro</button>
        </div>`
      : '';

    container.innerHTML = filterBanner + renderAdminTableRows(tableName, data);
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderAdminTableRows(tableName, data) {
  const schema = tableSchemas[tableName];
  return `
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
            ${schema.displayCols.map(c => `<td>${renderCellValue(c, row[c], row, schema)}</td>`).join('')}
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
}

function filterAdminTable(tableName) {
  const schema = tableSchemas[tableName];
  if (!schema) return;
  const allData = adminTableData[tableName];
  if (!allData) return;

  const filterInput = document.getElementById(`filter-${tableName}`);
  const query = (filterInput ? filterInput.value : '').toLowerCase().trim();

  const filtered = query === '' ? allData : allData.filter(row =>
    schema.displayCols.some(col => String(row[col] || '').toLowerCase().includes(query))
  );

  const container = document.getElementById(`table${capitalize(tableName)}`);
  if (!container) return;
  container.innerHTML = renderAdminTableRows(tableName, filtered);
}

function exportCSV(tableName) {
  const schema = tableSchemas[tableName];
  if (!schema) return;
  const allData = adminTableData[tableName];
  if (!allData) return;

  const filterInput = document.getElementById(`filter-${tableName}`);
  const query = (filterInput ? filterInput.value : '').toLowerCase().trim();

  const data = query === '' ? allData : allData.filter(row =>
    schema.displayCols.some(col => String(row[col] || '').toLowerCase().includes(query))
  );

  const headers = schema.displayCols.map(c => schema.labels[c] || c);
  const csvRows = [headers.join(',')];
  data.forEach(row => {
    const values = schema.displayCols.map(c => {
      const val = String(row[c] == null ? '' : row[c]).replace(/"/g, '""');
      return `"${val}"`;
    });
    csvRows.push(values.join(','));
  });

  const csvContent = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tableName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
  if (schema.selectPais) populatePaisDropdown(null);
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
    if (schema.selectPais) populatePaisDropdown(record.CodigoPaisNormalizado);
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

    if (col === 'CodigoPaisNormalizado' && schema.selectPais) {
      return `
        <div class="form-group">
          <label>${schema.labels[col] || col}</label>
          <select class="form-control" name="${col}" id="paisDropdown">
            <option value="">-- Seleccionar país --</option>
          </select>
        </div>`;
    }

    // autoCode: PK auto-calculated from Nombre (create mode only)
    if (schema.autoCode && col === schema.pk && !data[col]) {
      return `
        <div class="form-group">
          <label>${schema.labels[col] || col}</label>
          <input type="text" class="form-control" name="${col}" id="autoCodeField" value="" readonly placeholder="Se calculará del nombre" style="background:#f0f0f0;font-weight:600;letter-spacing:1px;">
        </div>`;
    }
    if (schema.autoCode && col === 'Nombre' && !data[col]) {
      return `
        <div class="form-group">
          <label>${schema.labels[col] || col}</label>
          <input type="text" class="form-control" name="${col}" value="" oninput="calcAutoCode(this.value)" placeholder="Nombre del país">
        </div>`;
    }

    const inputType = 'text';
    const placeholder = col === 'password' && !data[col] ? 'Dejar vacío para no cambiar' : '';
    return `
      <div class="form-group">
        <label>${schema.labels[col] || col}</label>
        <input type="${inputType}" class="form-control" name="${col}" value="${esc(data[col] || '')}" placeholder="${placeholder}" ${isPk ? 'readonly' : ''}>
      </div>`;
  }).join('')}</div>`;
}

const PAIS_ISO3 = {
  'afganistan':'AFG','albania':'ALB','alemania':'DEU','andorra':'AND','angola':'AGO',
  'antigua y barbuda':'ATG','arabia saudita':'SAU','arabia saudi':'SAU','argelia':'DZA',
  'argentina':'ARG','armenia':'ARM','australia':'AUS','austria':'AUT','azerbaiyan':'AZE',
  'bahamas':'BHS','bahrein':'BHR','barein':'BHR','bangladesh':'BGD','banglades':'BGD',
  'barbados':'BRB','belgica':'BEL','belice':'BLZ','benin':'BEN','bielorrusia':'BLR',
  'birmania':'MMR','myanmar':'MMR','bolivia':'BOL','bosnia y herzegovina':'BIH',
  'botsuana':'BWA','brasil':'BRA','brunei':'BRN','bulgaria':'BGR','burkina faso':'BFA',
  'burundi':'BDI','butan':'BTN','bhutan':'BTN','cabo verde':'CPV','camboya':'KHM',
  'camerun':'CMR','canada':'CAN','catar':'QAT','qatar':'QAT','chad':'TCD','chile':'CHL',
  'china':'CHN','chipre':'CYP','colombia':'COL','comoras':'COM','corea del norte':'PRK',
  'corea del sur':'KOR','costa rica':'CRI','croacia':'HRV','cuba':'CUB',
  'dinamarca':'DNK','ecuador':'ECU','egipto':'EGY','el salvador':'SLV',
  'emiratos arabes unidos':'ARE','eritrea':'ERI','eslovaquia':'SVK','eslovenia':'SVN',
  'espana':'ESP','españa':'ESP','estados unidos':'USA','estonia':'EST','etiopia':'ETH',
  'filipinas':'PHL','finlandia':'FIN','fiyi':'FJI','francia':'FRA','gabon':'GAB',
  'gambia':'GMB','georgia':'GEO','ghana':'GHA','grecia':'GRC','guatemala':'GTM',
  'guinea':'GIN','guinea ecuatorial':'GNQ','guinea-bissau':'GNB','guyana':'GUY',
  'haiti':'HTI','honduras':'HND','hong kong':'HKG','hungria':'HUN','india':'IND',
  'indonesia':'IDN','iran':'IRN','iraq':'IRQ','irak':'IRQ','irlanda':'IRL',
  'islandia':'ISL','israel':'ISR','italia':'ITA','jamaica':'JAM','japon':'JPN',
  'japon':'JPN','jordania':'JOR','kazajistan':'KAZ','kazajstan':'KAZ','kenia':'KEN',
  'kirguistan':'KGZ','kiribati':'KIR','kuwait':'KWT','laos':'LAO','letonia':'LVA',
  'libano':'LBN','liberia':'LBR','libia':'LBY','liechtenstein':'LIE','lituania':'LTU',
  'luxemburgo':'LUX','macao':'MAC','madagascar':'MDG','malasia':'MYS','malaui':'MWI',
  'malawi':'MWI','maldivas':'MDV','mali':'MLI','malta':'MLT','marruecos':'MAR',
  'mauricio':'MUS','mauritania':'MRT','mexico':'MEX','mexico':'MEX','micronesia':'FSM',
  'moldavia':'MDA','monaco':'MCO','mongolia':'MNG','montenegro':'MNE',
  'mozambique':'MOZ','namibia':'NAM','nepal':'NPL','nicaragua':'NIC','niger':'NER',
  'nigeria':'NGA','noruega':'NOR','nueva zelanda':'NZL','oman':'OMN','paises bajos':'NLD',
  'paises bajos':'NLD','pakistan':'PAK','palestina':'PSE','panama':'PAN',
  'papua nueva guinea':'PNG','paraguay':'PRY','peru':'PER','polonia':'POL',
  'portugal':'PRT','reino unido':'GBR','republica checa':'CZE','republica dominicana':'DOM',
  'ruanda':'RWA','rumania':'ROU','rusia':'RUS','senegal':'SEN','serbia':'SRB',
  'sierra leona':'SLE','singapur':'SGP','siria':'SYR','somalia':'SOM',
  'sri lanka':'LKA','sudafrica':'ZAF','sudan':'SDN','sudan del sur':'SSD',
  'suecia':'SWE','suiza':'CHE','tailandia':'THA','taiwan':'TWN','tanzania':'TZA',
  'tayikistan':'TJK','timor oriental':'TLS','togo':'TGO','trinidad y tobago':'TTO',
  'tunez':'TUN','turkmenistan':'TKM','turquia':'TUR','ucrania':'UKR','uganda':'UGA',
  'uruguay':'URY','uzbekistan':'UZB','vanuatu':'VUT','venezuela':'VEN','vietnam':'VNM',
  'yemen':'YEM','yibuti':'DJI','zambia':'ZMB','zimbabue':'ZWE',
};

function calcAutoCode(nombre) {
  const field = document.getElementById('autoCodeField');
  if (!field) return;
  const key = nombre.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  field.value = PAIS_ISO3[key] || '';
  field.placeholder = PAIS_ISO3[key] ? '' : 'País no reconocido — revisa el nombre';
  field.style.color = PAIS_ISO3[key] ? '' : '#c0392b';
}

async function populateEntityDropdown(selectedValue) {
  try {
    const entidades = await api('/api/entidades-list');
    const select = document.getElementById('entityDropdown');
    if (!select) return;
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

async function populatePaisDropdown(selectedValue) {
  try {
    const paises = await api('/api/paises-list');
    const select = document.getElementById('paisDropdown');
    if (!select) return;
    select.innerHTML = '<option value="">-- Seleccionar país --</option>';
    paises.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.CodigoPaisNormalizado;
      opt.textContent = `${p.CodigoPaisNormalizado} - ${p.Nombre}`;
      if (p.CodigoPaisNormalizado === selectedValue) opt.selected = true;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error('Error loading paises list:', e);
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
let aiUseOpenAI = false;
let aiOpenAIAvailable = false;

async function checkAiStatus() {
  try {
    const data = await api('/api/ai/status');
    aiOpenAIAvailable = !!data.openaiAvailable;
  } catch (e) {
    aiOpenAIAvailable = false;
  }

  const toggle = document.getElementById('aiToggle');
  const wrapper = document.getElementById('aiToggleWrapper');
  if (aiOpenAIAvailable) {
    toggle.disabled = false;
    wrapper.title = 'Activar OpenAI GPT-4o-mini';
    // Restore saved preference
    const saved = localStorage.getItem('aiUseOpenAI');
    if (saved === 'true') {
      toggle.checked = true;
      aiUseOpenAI = true;
      updateAiModeLabel();
    }
  } else {
    toggle.disabled = true;
    wrapper.title = 'Configura OPENAI_API_KEY en .env para activar la IA';
  }
}

function onAiToggleChange() {
  const toggle = document.getElementById('aiToggle');
  aiUseOpenAI = toggle.checked;
  localStorage.setItem('aiUseOpenAI', aiUseOpenAI);
  updateAiModeLabel();
}

function updateAiModeLabel() {
  const label = document.getElementById('aiModeLabel');
  if (label) {
    label.textContent = aiUseOpenAI ? 'Modo: OpenAI ✦' : 'Modo: Básico';
    label.className = 'ai-mode-label' + (aiUseOpenAI ? ' ai-mode-openai' : '');
  }
}

function toggleAiChat() {
  aiChatOpen = !aiChatOpen;
  const panel = document.getElementById('aiChatPanel');
  const fab = document.getElementById('aiChatFab');

  if (aiChatOpen) {
    panel.classList.add('active');
    fab.classList.add('active');
    if (aiFirstOpen) {
      aiFirstOpen = false;
      checkAiStatus().then(() => {
        const welcomeBasic = '¡Hola! Soy el Asistente IA del CRM GNL. Consulto datos reales de la base de datos.\n\nPuedes preguntarme sobre:\n- **Nombre de un país** (ej: "India")\n- **"NDA"** o **"documentos"**\n- **"Oportunidades"** o **"pipeline"**\n- **"Próximos pasos"** o **"acciones"**\n- **"Contactos"** o **"seguimiento"**\n- **"Resumen"** o **"dashboard"**';
        const welcomeAI = '¡Hola! Estoy conectado a **OpenAI GPT-4o-mini** y consulto datos reales de la BD.\n\nPuedes hacerme cualquier pregunta sobre el CRM en lenguaje natural.';
        addAiMessage('bot', aiUseOpenAI ? welcomeAI : welcomeBasic);
      });
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

function addAiMessage(type, text, mode) {
  const container = document.getElementById('aiChatMessages');
  const msg = document.createElement('div');
  msg.className = `ai-msg ${type}`;
  if (type === 'bot') {
    let html = formatAiText(text);
    if (mode === 'openai') {
      html = '<span class="ai-badge-openai">✦ IA</span>' + html;
    }
    msg.innerHTML = html;
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
      body: JSON.stringify({ message: text, useAI: aiUseOpenAI }),
    });
    typing.remove();
    addAiMessage('bot', data.response, data.mode);
  } catch (e) {
    typing.remove();
    addAiMessage('bot', 'Error al procesar la consulta: ' + e.message);
  }
}

// ============ MY PROFILE (password change) ============
async function openMyProfileModal() {
  try {
    const profile = await api('/api/mi-perfil');
    document.getElementById('modalTitle').textContent = 'Mi Contraseña';
    document.getElementById('modalBody').innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <label>Usuario</label>
          <input type="text" class="form-control" value="${esc(profile.username)}" readonly style="background:#f0f0f0;">
        </div>
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" class="form-control" value="${esc(profile.nombre)}" readonly style="background:#f0f0f0;">
        </div>
        <div class="form-group">
          <label>Contraseña actual</label>
          <input type="text" class="form-control" value="${esc(profile.password)}" readonly style="background:#f0f0f0;">
        </div>
        <div class="form-group">
          <label>Nueva contraseña</label>
          <input type="text" class="form-control" name="newPassword" placeholder="Escribir nueva contraseña">
        </div>
      </div>
    `;
    document.getElementById('modalSave').onclick = async () => {
      const newPass = document.querySelector('#modalBody input[name="newPassword"]').value.trim();
      if (!newPass) { toast('Escribe una nueva contraseña', 'error'); return; }
      try {
        await api('/api/mi-perfil', { method: 'PUT', body: JSON.stringify({ password: newPass }) });
        toast('Contraseña actualizada correctamente');
        closeModal();
      } catch (e) {
        toast(e.message, 'error');
      }
    };
    document.getElementById('modalOverlay').classList.add('active');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ============ PRESENTATION ============
let presentationActive = false;
let currentSlide = 1;
const totalSlides = 8;

function initPresentation() {
  presentationActive = true;
  currentSlide = 1;
  const container = document.getElementById('presentationContainer');
  container.classList.add('active');
  updateSlide();
  document.body.style.overflow = 'hidden';
}

function changeSlide(dir) {
  currentSlide += dir;
  if (currentSlide < 1) currentSlide = 1;
  if (currentSlide > totalSlides) currentSlide = totalSlides;
  updateSlide();
}

function updateSlide() {
  const slides = document.querySelectorAll('#presentationContainer .slide');
  slides.forEach(s => s.classList.remove('active'));
  const target = document.querySelector(`#presentationContainer .slide[data-slide="${currentSlide}"]`);
  if (target) target.classList.add('active');
  document.getElementById('presCounter').textContent = `${currentSlide} / ${totalSlides}`;
}

function exitPresentation() {
  presentationActive = false;
  document.getElementById('presentationContainer').classList.remove('active');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
  if (!presentationActive) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { changeSlide(1); e.preventDefault(); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { changeSlide(-1); e.preventDefault(); }
  else if (e.key === 'Escape') { exitPresentation(); e.preventDefault(); }
});

// ============ INIT ============
checkSession();
