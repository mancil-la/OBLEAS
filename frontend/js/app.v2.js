// En Netlify (prod y netlify dev) la API vive en /api gracias a netlify.toml
const API_URL = '/api';

// Estado global
let productos = [];
let trabajadores = [];
let productosVenta = [];
let totalVenta = 0;
let usuarioActual = null;

// Estado UI de ventas (POS)
let ventaBusqueda = '';
let ventaCategoria = 'Todas';

function getAutoPrintEnabled() {
  const checkbox = qs('auto-print');
  if (checkbox) {
    return checkbox.checked;
  }
  const raw = localStorage.getItem('autoPrint');
  return raw === null ? true : raw === 'true';
}

function wireAutoPrintSetting() {
  const checkbox = qs('auto-print');
  if (!checkbox) return;
  const raw = localStorage.getItem('autoPrint');
  if (raw !== null) checkbox.checked = raw === 'true';
  checkbox.addEventListener('change', () => {
    localStorage.setItem('autoPrint', checkbox.checked ? 'true' : 'false');
  });
}

// -------------------- Helpers --------------------

async function fetchJson(url, options = {}) {
  const token = localStorage.getItem('token');

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  // Si la sesión expiró, manda al login
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
    return null;
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message = (data && data.error) ? data.error : `Error HTTP ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

function formatMoney(value) {
  const num = Number(value || 0);
  return `$${num.toFixed(2)}`;
}

function qs(id) {
  return document.getElementById(id);
}

function normalizeText(value) {
  const s = String(value || '').toLowerCase();
  // Quitar acentos sin usar unicode property escapes
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// -------------------- Auth --------------------

document.addEventListener('DOMContentLoaded', () => {
  boot();
});

async function boot() {
  try {
    usuarioActual = await fetchJson(`${API_URL}/auth/me`, { method: 'GET' });
    if (!usuarioActual) return;

    configurarNavegacion();
    configurarUI();

    await inicializarDatos();

    // Mostrar dashboard por defecto
    mostrarSeccion('dashboard');
  } catch (e) {
    console.error('Error boot:', e);
    window.location.href = 'login.html';
  }
}

function configurarUI() {
  // Header user info
  const fechaEl = qs('fecha-actual');
  if (fechaEl) {
    const rol = usuarioActual.rol === 'admin' ? 'Administrador' : 'Trabajador';
    const fecha = new Date();
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    fechaEl.innerHTML = `
      <div style="text-align:right;">
        <div><strong>${usuarioActual.nombre}</strong> (${rol})</div>
        <div style="font-size:0.85rem;margin-top:0.25rem;color:#64748b;">${fecha.toLocaleDateString('es-ES', opciones)}</div>
      </div>
    `;
  }

  // Menú por rol
  if (usuarioActual.rol !== 'admin') {
    document.querySelectorAll('.menu-item').forEach((item) => {
      const section = item.dataset.section;
      if (section === 'productos' || section === 'trabajadores' || section === 'reportes' || section === 'asignar-stock') {
        item.style.display = 'none';
      }
    });

    // También ocultar filtros por trabajador en historial
    const filtroTrabajador = qs('filtro-trabajador');
    if (filtroTrabajador) {
      filtroTrabajador.parentElement && (filtroTrabajador.parentElement.style.display = 'none');
    }
  }

  // Estado inicial de lista de venta
  actualizarListaVenta();
  wireAutoPrintSetting();
}

async function cerrarSesion() {
  try {
    await fetchJson(`${API_URL}/auth/logout`, { method: 'POST' });
  } catch (e) {
    // igual redirigimos
  }
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  window.location.href = 'login.html';
}

// Exponer para onclick en HTML
window.cerrarSesion = cerrarSesion;

// -------------------- Navegación --------------------

function configurarNavegacion() {
  const menuItems = document.querySelectorAll('.menu-item');

  menuItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = item.dataset.section;

      // Evitar que un trabajador llegue a pantallas admin
      if (usuarioActual.rol !== 'admin' && (sectionId === 'productos' || sectionId === 'trabajadores' || sectionId === 'reportes')) {
        mostrarSeccion('dashboard');
        return;
      }

      menuItems.forEach((mi) => mi.classList.remove('active'));
      item.classList.add('active');

      mostrarSeccion(sectionId);
    });
  });
}

function mostrarSeccion(sectionId) {
  document.querySelectorAll('.content-section').forEach((section) => {
    section.classList.remove('active');
  });

  const section = document.getElementById(sectionId);
  if (section) section.classList.add('active');

  const titulos = {
    dashboard: 'Dashboard',
    ventas: 'Nueva Venta',
    productos: 'Inventario de Productos',
    historial: 'Historial de Ventas',
    trabajadores: 'Gestión de Trabajadores',
    reportes: 'Reportes',
    'asignar-stock': 'Asignar Inventario a Trabajadores'
  };

  const title = qs('page-title');
  if (title) title.textContent = titulos[sectionId] || '';

  // Cargar datos según sección
  switch (sectionId) {
    case 'dashboard':
      cargarDashboard();
      break;
    case 'ventas':
      cargarSelectTrabajadores();
      renderVentaPOS();

      // Si el usuario es trabajador, cargar su inventario automáticamente
      if (usuarioActual.rol === 'trabajador') {
        const workerSelect = qs('trabajador-select');
        if (workerSelect) {
          workerSelect.value = usuarioActual.id;
          // Disparar el evento change para cargar los productos
          workerSelect.dispatchEvent(new Event('change'));
        }
      }

      actualizarListaVenta();
      break;
    case 'productos':
      cargarTablaProductos();
      break;
    case 'historial':
      if (usuarioActual.rol !== 'admin') {
        // Fuerza que el filtro sea el propio (aunque backend ya lo limita)
        const ft = qs('filtro-trabajador');
        if (ft) {
          ft.value = String(usuarioActual.id);
          ft.disabled = true;
        }
      }
      cargarTablaVentas();
      cargarFiltroTrabajadores();
      break;
    case 'trabajadores':
      cargarTablaTrabajadores();
      break;
    case 'asignar-stock':
      cargarSelectTrabajadoresAsignar();
      break;
  }
}

// -------------------- Helpers Fecha --------------------

function formatDateTime(dbDate) {
  if (!dbDate) return '';
  // SQLite CURRENT_TIMESTAMP devuelve YYYY-MM-DD HH:MM:SS en UTC.
  // Agregamos 'Z' para que el constructor de Date sepa que es UTC y lo pase a local.
  const dateStr = dbDate.includes(' ') ? dbDate.replace(' ', 'T') + 'Z' : dbDate;
  const d = new Date(dateStr);
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

// -------------------- Datos iniciales --------------------

async function inicializarDatos() {
  await cargarProductos();
  await cargarTrabajadores();
}

// -------------------- Dashboard --------------------

async function cargarDashboard() {
  try {
    const data = await fetchJson(`${API_URL}/reportes/resumen`, { method: 'GET' });
    if (!data) return;

    qs('stat-productos').textContent = data.total_productos || 0;
    qs('stat-trabajadores').textContent = data.trabajadores_activos || 0;
    qs('stat-ventas-hoy').textContent = data.ventas_hoy || 0;
    qs('stat-total-hoy').textContent = formatMoney(data.total_hoy || 0);

    // Gráficos simples con divs
    if (usuarioActual.rol === 'admin') {
      await cargarGraficoVentasTrabajador();
    } else {
      const cont = qs('ventas-trabajador-chart');
      if (cont) cont.innerHTML = '<p class="text-center text-light">Disponible solo para admin</p>';
    }

    await cargarGraficoProductosVendidos();
  } catch (e) {
    console.error('Dashboard:', e);
  }
}

async function cargarGraficoVentasTrabajador() {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const data = await fetchJson(`${API_URL}/reportes/ventas-por-trabajador?fecha_inicio=${hoy}&fecha_fin=${hoy}`, { method: 'GET' });
    if (!data) return;

    const container = qs('ventas-trabajador-chart');
    if (!container) return;

    if (data.length === 0 || data.every(i => i.total_vendido === 0)) {
      container.innerHTML = '<p class="text-center text-light">No hay ventas registradas hoy</p>';
      return;
    }

    // Calcular el máximo para la escala de las barras
    const maxVendido = Math.max(...data.map(i => i.total_vendido), 1);

    container.innerHTML = '<div class="chart-container"></div>';
    const chartBody = container.querySelector('.chart-container');

    data.forEach((item) => {
      const porcentaje = (item.total_vendido / maxVendido) * 100;
      const isAdmin = trabajadores.find(t => t.id === item.id)?.rol === 'admin';

      const row = document.createElement('div');
      row.className = 'chart-row';
      row.innerHTML = `
        <div class="chart-info">
          <span>${item.nombre} ${isAdmin ? '<small>(Admin)</small>' : ''}</span>
          <span>${formatMoney(item.total_vendido)} (${item.total_ventas})</span>
        </div>
        <div class="chart-bar-bg">
          <div class="chart-bar-fill ${isAdmin ? 'admin' : ''}" style="width: 0%"></div>
        </div>
      `;
      chartBody.appendChild(row);

      // Trigger animation
      setTimeout(() => {
        const fill = row.querySelector('.chart-bar-fill');
        if (fill) fill.style.width = `${porcentaje}%`;
      }, 100);
    });
  } catch (e) {
    console.error('Grafico ventas trabajador:', e);
  }
}

async function cargarGraficoProductosVendidos() {
  try {
    const data = await fetchJson(`${API_URL}/reportes/productos-mas-vendidos`, { method: 'GET' });
    if (!data) return;

    const container = qs('productos-vendidos-chart');
    if (!container) return;

    container.innerHTML = '';
    data.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'reporte-item';
      div.innerHTML = `
        <h4>${item.nombre}</h4>
        <p>Cantidad: ${item.cantidad_vendida} | Total: ${formatMoney(item.total_vendido)}</p>
      `;
      container.appendChild(div);
    });
  } catch (e) {
    console.error('Grafico productos vendidos:', e);
  }
}

// -------------------- Productos --------------------

async function cargarProductos() {
  try {
    const data = await fetchJson(`${API_URL}/productos`, { method: 'GET' });
    if (!data) return [];
    productos = data;
    // Si estamos en la pantalla de ventas, refrescar catálogo (stock puede cambiar)
    renderVentaPOS(true);
    return productos;
  } catch (e) {
    console.error('Productos:', e);
    productos = [];
    return [];
  }
}

async function cargarTablaProductos() {
  await cargarProductos();

  const tbody = qs('productos-tabla');
  if (!tbody) return;

  if (!productos.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay productos registrados</td></tr>';
    return;
  }

  tbody.innerHTML = productos
    .map((p) => `
      <tr>
        <td>${p.id}</td>
        <td>${p.nombre}</td>
        <td>${p.categoria}</td>
        <td>${formatMoney(p.precio)}</td>
        <td>${p.stock}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="editarProducto(${p.id})"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-secondary" onclick="ajustarStockProducto(${p.id}, 'add')" title="Agregar stock"><i class="fas fa-plus"></i></button>
          <button class="btn btn-sm btn-secondary" onclick="ajustarStockProducto(${p.id}, 'sub')" title="Quitar stock"><i class="fas fa-minus"></i></button>
          <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${p.id})"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `)
    .join('');
}

async function ajustarStockProducto(productoId, mode) {
  const producto = productos.find((p) => p.id === productoId);
  if (!producto) {
    alert('Producto no encontrado');
    return;
  }

  const label = mode === 'sub' ? 'quitar' : 'agregar';
  const raw = prompt(`¿Cuántas unidades deseas ${label} al stock de "${producto.nombre}"?`, '1');
  if (raw === null) return;

  const qty = Number(raw);
  if (!qty || Number.isNaN(qty) || qty <= 0) {
    alert('Cantidad inválida');
    return;
  }

  const delta = mode === 'sub' ? -Math.abs(qty) : Math.abs(qty);

  try {
    await fetchJson(`${API_URL}/productos/${productoId}/ajustar-stock`, {
      method: 'POST',
      body: JSON.stringify({ delta })
    });

    await cargarProductos();
    await cargarTablaProductos();
    cargarSelectProductos();
  } catch (e) {
    alert(e.message || 'Error al ajustar stock');
  }
}

function mostrarModalProducto(id = null) {
  const modal = qs('modal-producto');
  const titulo = qs('modal-titulo');

  if (!modal || !titulo) return;

  if (id) {
    titulo.textContent = 'Editar Producto';
    const producto = productos.find((p) => p.id === id);
    if (producto) {
      qs('producto-id').value = producto.id;
      qs('producto-nombre').value = producto.nombre;
      qs('producto-categoria').value = producto.categoria;
      qs('producto-precio').value = producto.precio;
      qs('producto-stock').value = producto.stock;
    }
  } else {
    titulo.textContent = 'Nuevo Producto';
    qs('producto-id').value = '';
    qs('producto-nombre').value = '';
    qs('producto-categoria').value = 'Obleas';
    qs('producto-precio').value = '';
    qs('producto-stock').value = '';
  }

  modal.classList.add('active');
}

function cerrarModalProducto() {
  const modal = qs('modal-producto');
  if (modal) modal.classList.remove('active');
}

async function guardarProducto() {
  const id = qs('producto-id').value;
  const nombre = qs('producto-nombre').value.trim();
  const categoria = qs('producto-categoria').value;
  const precio = Number(qs('producto-precio').value);
  const stock = Number(qs('producto-stock').value);

  if (!nombre || Number.isNaN(precio) || Number.isNaN(stock)) {
    alert('Por favor complete todos los campos correctamente');
    return;
  }

  try {
    const url = id ? `${API_URL}/productos/${id}` : `${API_URL}/productos`;
    const method = id ? 'PUT' : 'POST';

    await fetchJson(url, {
      method,
      body: JSON.stringify({ nombre, categoria, precio, stock })
    });

    alert(`Producto ${id ? 'actualizado' : 'creado'} exitosamente`);
    cerrarModalProducto();
    await cargarTablaProductos();
  } catch (e) {
    alert(e.message || 'Error al guardar el producto');
  }
}

function editarProducto(id) {
  mostrarModalProducto(id);
}

async function eliminarProducto(id) {
  if (!confirm('¿Está seguro de eliminar este producto?')) return;
  try {
    await fetchJson(`${API_URL}/productos/${id}`, { method: 'DELETE' });
    alert('Producto eliminado exitosamente');
    await cargarTablaProductos();
  } catch (e) {
    alert(e.message || 'Error al eliminar el producto');
  }
}

// Exponer
window.mostrarModalProducto = mostrarModalProducto;
window.cerrarModalProducto = cerrarModalProducto;
window.guardarProducto = guardarProducto;
window.editarProducto = editarProducto;
window.eliminarProducto = eliminarProducto;
window.ajustarStockProducto = ajustarStockProducto;

// -------------------- Trabajadores --------------------

async function cargarTrabajadores() {
  // Admin: puede traer todos. Trabajador: el backend devuelve 403 si intenta listar.
  try {
    const data = await fetchJson(`${API_URL}/trabajadores`, { method: 'GET' });
    if (!data) return [];
    trabajadores = data;
    return trabajadores;
  } catch (e) {
    if (e && e.status === 403) {
      trabajadores = [usuarioActual];
      return trabajadores;
    }
    console.error('Trabajadores:', e);
    trabajadores = [usuarioActual];
    return trabajadores;
  }
}

async function cargarTablaTrabajadores() {
  await cargarTrabajadores();

  const tbody = qs('trabajadores-tabla');
  if (!tbody) return;

  tbody.innerHTML = trabajadores
    .map((t) => `
      <tr>
        <td>${t.id}</td>
        <td>${t.nombre}</td>
        <td>${t.usuario || '-'}</td>
        <td>${t.rol || 'trabajador'}</td>
        <td>${t.telefono || '-'}</td>
        <td>
          <span class="badge ${t.activo ? 'badge-success' : 'badge-danger'}">${t.activo ? 'Activo' : 'Inactivo'}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="mostrarModalTrabajador(${t.id})" title="Editar"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-danger" onclick="eliminarTrabajador(${t.id})" title="Desactivar"><i class="fas fa-user-slash"></i></button>
        </td>
      </tr>
    `)
    .join('');
}

function mostrarModalTrabajador(id = null) {
  const modal = qs('modal-trabajador');
  const titulo = qs('modal-trabajador-titulo');
  if (!modal || !titulo) return;

  const isEdit = id !== null && id !== undefined;
  const trabajador = isEdit ? trabajadores.find((t) => t.id === id) : null;

  if (isEdit && !trabajador) {
    alert('Trabajador no encontrado');
    return;
  }

  titulo.textContent = isEdit ? 'Editar Trabajador' : 'Nuevo Trabajador';

  qs('trabajador-id').value = isEdit ? trabajador.id : '';
  qs('trabajador-nombre').value = isEdit ? (trabajador.nombre || '') : '';
  qs('trabajador-usuario').value = isEdit ? (trabajador.usuario || '') : '';
  qs('trabajador-password').value = '';
  qs('trabajador-rol').value = isEdit ? (trabajador.rol || 'trabajador') : 'trabajador';
  qs('trabajador-telefono').value = isEdit ? (trabajador.telefono || '') : '';
  qs('trabajador-activo').value = isEdit ? (trabajador.activo ? 1 : 0) : 1;

  modal.classList.add('active');
}

function cerrarModalTrabajador() {
  const modal = qs('modal-trabajador');
  if (modal) modal.classList.remove('active');
}

async function guardarTrabajador() {
  const id = qs('trabajador-id').value;
  const nombre = qs('trabajador-nombre').value.trim();
  const usuario = qs('trabajador-usuario').value.trim();
  const password = qs('trabajador-password').value;
  const rol = qs('trabajador-rol').value;
  const telefono = qs('trabajador-telefono').value.trim();
  const activo = Number(qs('trabajador-activo').value);

  if (!nombre) {
    alert('Por favor ingrese el nombre del trabajador');
    return;
  }

  if (!usuario) {
    alert('Por favor ingrese el usuario (login)');
    return;
  }

  try {
    if (!id) {
      if (!password) {
        alert('Para crear un trabajador se requiere contraseña');
        return;
      }

      await fetchJson(`${API_URL}/trabajadores`, {
        method: 'POST',
        body: JSON.stringify({ nombre, usuario, password, rol, telefono, activo })
      });
      alert('Trabajador creado exitosamente');
    } else {
      const payload = { nombre, usuario, rol, telefono, activo };
      if (password) payload.password = password;

      await fetchJson(`${API_URL}/trabajadores/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      alert('Trabajador actualizado exitosamente');
    }

    cerrarModalTrabajador();
    await cargarTablaTrabajadores();
  } catch (e) {
    alert(e.message || 'Error al guardar el trabajador');
  }
}

async function eliminarTrabajador(id) {
  if (!confirm('¿Seguro que deseas desactivar este trabajador? (Ya no podrá iniciar sesión)')) return;

  try {
    await fetchJson(`${API_URL}/trabajadores/${id}`, { method: 'DELETE' });
    alert('Trabajador desactivado');
    await cargarTablaTrabajadores();
  } catch (e) {
    alert(e.message || 'Error al desactivar el trabajador');
  }
}

window.mostrarModalTrabajador = mostrarModalTrabajador;
window.cerrarModalTrabajador = cerrarModalTrabajador;
window.guardarTrabajador = guardarTrabajador;
window.eliminarTrabajador = eliminarTrabajador;

// -------------------- Ventas --------------------

let ventaPOSWired = false;

function setupVentaPOSHandlers() {
  if (ventaPOSWired) return;
  ventaPOSWired = true;

  const buscar = qs('venta-buscar');
  if (buscar) {
    buscar.addEventListener('input', () => {
      ventaBusqueda = buscar.value || '';
      renderVentaCatalogo();
    });
  }

  const workerSelect = qs('trabajador-select');
  if (workerSelect) {
    workerSelect.addEventListener('change', async () => {
      const tid = workerSelect.value;
      if (tid) {
        const worker = trabajadores.find(t => String(t.id) === String(tid));
        const isAdmin = worker && worker.rol === 'admin';

        try {
          let data;
          if (isAdmin) {
            // Cargar productos del stock GLOBAL
            data = await fetchJson(`${API_URL}/productos`);
          } else {
            // Cargar productos asignados a ESTE trabajador
            data = await fetchJson(`${API_URL}/inventario/trabajador/${tid}`);
          }

          // Transformamos para que renderVentaCatalogo lo use igual que 'productos'
          productos = data.map(i => ({
            id: i.producto_id || i.id, // i.producto_id para inv_trabajador, i.id para productos global
            nombre: i.nombre,
            categoria: i.categoria,
            precio: i.precio,
            stock: i.stock
          }));
          renderVentaPOS(true);
        } catch (e) {
          console.error('Error cargando inventario:', e);
          productos = [];
          renderVentaPOS(true);
        }
      } else {
        productos = [];
        renderVentaPOS(true);
      }
    });
  }
}

function getCartQty(productId) {
  const item = productosVenta.find((p) => p.id === Number(productId));
  return item ? Number(item.cantidad || 0) : 0;
}

function getCategoriasProductos() {
  const set = new Set();
  (productos || []).forEach((p) => {
    const c = (p.categoria || '').trim();
    if (c) set.add(c);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
}

function renderVentaCategorias() {
  const cont = qs('venta-categorias');
  if (!cont) return;

  const cats = ['Todas', ...getCategoriasProductos()];
  cont.innerHTML = cats
    .map((c) => {
      const active = c === ventaCategoria ? 'active' : '';
      return `<button type="button" class="venta-cat-btn ${active}" data-cat="${encodeURIComponent(c)}">${c}</button>`;
    })
    .join('');

  cont.querySelectorAll('button[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = decodeURIComponent(btn.getAttribute('data-cat') || 'Todas');
      ventaCategoria = cat;
      renderVentaCategorias();
      renderVentaCatalogo();
    });
  });
}

function renderVentaCatalogo() {
  const grid = qs('venta-productos-grid');
  if (!grid) return;

  const q = normalizeText(ventaBusqueda);
  const words = q.split(' ').filter(w => w.length > 0);

  const filtered = (productos || [])
    .filter((p) => {
      if (ventaCategoria !== 'Todas' && String(p.categoria || '') !== ventaCategoria) return false;
      if (words.length === 0) return true;

      const hay = normalizeText(`${p.nombre || ''} ${p.categoria || ''}`);
      // Debe contener TODAS las palabras buscadas (búsqueda fragmentada)
      return words.every(word => hay.includes(word));
    })
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));

  if (!filtered.length) {
    grid.innerHTML = '<div class="text-center text-light">Sin resultados</div>';
    return;
  }

  grid.innerHTML = filtered
    .map((p) => {
      const stock = Number(p.stock || 0);
      const disabled = stock <= 0 ? 'disabled' : '';
      const stockTxt = stock > 0 ? `Stock: ${stock}` : 'Sin stock';
      const inCart = getCartQty(p.id);
      const canSub = inCart > 0;
      const canAdd = stock > 0 && inCart < stock;
      return `
        <div class="venta-producto-card">
          <div class="venta-producto-top">
            <div class="venta-producto-nombre">${p.nombre}</div>
            ${inCart > 0 ? `<div class="venta-badge" title="En carrito">${inCart}</div>` : ''}
          </div>
          <div class="venta-producto-meta">
            <div>${formatMoney(p.precio)}</div>
            <div class="venta-stock">${stockTxt}</div>
          </div>
          <div class="venta-producto-actions">
            <button class="venta-step-btn" ${canSub ? '' : 'disabled'} onclick="quitarProductoVentaRapido(${p.id})">-</button>
            <button class="venta-add-btn" ${canAdd ? '' : 'disabled'} onclick="agregarProductoVentaRapido(${p.id})">+ Agregar</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderVentaPOS(_force = false) {
  // Solo si existe el nuevo UI
  if (!qs('venta-productos-grid')) return;
  setupVentaPOSHandlers();
  renderVentaCategorias();
  renderVentaCatalogo();

  // UX: enfocar búsqueda para trabajador
  if (usuarioActual && usuarioActual.rol === 'trabajador') {
    const buscar = qs('venta-buscar');
    if (buscar) setTimeout(() => buscar.focus(), 50);
  }
}

function agregarProductoVentaPorId(productoId, cantidad) {
  const qty = Number(cantidad || 1);
  if (!productoId || !Number.isFinite(qty) || qty <= 0) return;

  const producto = productos.find((p) => p.id === Number(productoId));
  if (!producto) {
    alert('Producto no encontrado');
    return;
  }

  const stock = Number(producto.stock || 0);
  const existente = productosVenta.find((p) => p.id === Number(productoId));
  const enCarrito = existente ? existente.cantidad : 0;
  const nuevaCantidad = enCarrito + qty;
  if (nuevaCantidad > stock) {
    alert(`Stock insuficiente. Disponible: ${stock}`);
    return;
  }

  if (existente) {
    existente.cantidad = nuevaCantidad;
  } else {
    productosVenta.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: Number(producto.precio),
      cantidad: qty
    });
  }

  actualizarListaVenta();
}

function agregarProductoVentaRapido(productoId) {
  agregarProductoVentaPorId(productoId, 1);
}

function quitarProductoVentaRapido(productoId) {
  const idx = productosVenta.findIndex((p) => p.id === Number(productoId));
  if (idx === -1) return;
  cambiarCantidadVenta(idx, -1);
}

function cambiarCantidadVenta(index, delta) {
  const item = productosVenta[index];
  if (!item) return;
  const producto = productos.find((p) => p.id === item.id);
  const stock = producto ? Number(producto.stock || 0) : Infinity;

  const nueva = Number(item.cantidad || 0) + Number(delta || 0);
  if (nueva <= 0) {
    eliminarProductoVenta(index);
    return;
  }
  if (nueva > stock) {
    alert(`Stock insuficiente. Disponible: ${stock}`);
    return;
  }
  item.cantidad = nueva;
  actualizarListaVenta();
}

function setCantidadVenta(index, value) {
  const item = productosVenta[index];
  if (!item) return;
  const nueva = Number(value);
  if (!Number.isFinite(nueva) || nueva <= 0) {
    actualizarListaVenta();
    return;
  }
  const producto = productos.find((p) => p.id === item.id);
  const stock = producto ? Number(producto.stock || 0) : Infinity;
  if (nueva > stock) {
    alert(`Stock insuficiente. Disponible: ${stock}`);
    actualizarListaVenta();
    return;
  }
  item.cantidad = Math.trunc(nueva);
  actualizarListaVenta();
}

function cargarSelectTrabajadores() {
  const select = qs('trabajador-select');
  if (!select) return;

  if (usuarioActual.rol === 'trabajador') {
    select.innerHTML = `<option value="${usuarioActual.id}" selected>${usuarioActual.nombre}</option>`;
    select.disabled = true;
  } else {
    // Admin: necesita lista
    select.disabled = false;
    const activos = trabajadores.filter((t) => t.activo);
    select.innerHTML = '<option value="">Seleccionar trabajador...</option>' + activos.map((t) => `<option value="${t.id}">${t.nombre}</option>`).join('');
  }
}

function cargarSelectProductos() {
  const select = qs('producto-select');
  if (!select) return;

  const disponibles = productos.filter((p) => Number(p.stock) > 0);
  select.innerHTML = '<option value="">Seleccionar producto...</option>' + disponibles.map((p) => `<option value="${p.id}">${p.nombre} - ${formatMoney(p.precio)} (Stock: ${p.stock})</option>`).join('');
}

function agregarProductoVenta() {
  // Soporte legado (si aún existe el select)
  const ps = qs('producto-select');
  const ci = qs('cantidad-input');
  if (!ps || !ci) return;

  const productoId = Number(ps.value);
  const cantidad = Number(ci.value);

  if (!productoId || !cantidad || cantidad <= 0) {
    alert('Por favor seleccione un producto y cantidad válida');
    return;
  }

  const producto = productos.find((p) => p.id === productoId);
  if (!producto) {
    alert('Producto no encontrado');
    return;
  }

  if (cantidad > producto.stock) {
    alert(`Stock insuficiente. Disponible: ${producto.stock}`);
    return;
  }

  const existente = productosVenta.find((p) => p.id === productoId);
  if (existente) {
    const nuevaCantidad = existente.cantidad + cantidad;
    if (nuevaCantidad > producto.stock) {
      alert(`Stock insuficiente. Ya tiene ${existente.cantidad} en el carrito. Disponible: ${producto.stock}`);
      return;
    }
    existente.cantidad = nuevaCantidad;
  } else {
    productosVenta.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: Number(producto.precio),
      cantidad
    });
  }

  actualizarListaVenta();
  ps.value = '';
  ci.value = '1';
}

function eliminarProductoVenta(index) {
  productosVenta.splice(index, 1);
  actualizarListaVenta();
}

function actualizarListaVenta() {
  const lista = qs('productos-venta-lista');
  if (!lista) return;

  if (!productosVenta.length) {
    lista.innerHTML = '<p class="text-center text-light">No hay productos agregados</p>';
    totalVenta = 0;
  } else {
    lista.innerHTML = productosVenta.map((p, index) => {
      const subtotal = p.precio * p.cantidad;
      return `
        <div class="producto-venta-item">
          <div class="producto-venta-info">
            <h4>${p.nombre}</h4>
            <p>${formatMoney(p.precio)} c/u</p>
          </div>
          <div class="venta-qty">
            <button type="button" onclick="cambiarCantidadVenta(${index}, -1)">-</button>
            <input type="number" min="1" value="${p.cantidad}" onchange="setCantidadVenta(${index}, this.value)">
            <button type="button" onclick="cambiarCantidadVenta(${index}, 1)">+</button>
          </div>
          <div class="venta-subtotal">${formatMoney(subtotal)}</div>
          <button class="btn btn-sm btn-danger" onclick="eliminarProductoVenta(${index})" title="Quitar"><i class="fas fa-trash"></i></button>
        </div>
      `;
    }).join('');

    totalVenta = productosVenta.reduce((sum, p) => sum + (p.precio * p.cantidad), 0);
  }

  const totalEl = qs('total-venta');
  if (totalEl) totalEl.textContent = totalVenta.toFixed(2);
}

async function completarVenta() {
  const trabajadorId = Number(qs('trabajador-select').value);

  if (!trabajadorId) {
    alert('Por favor seleccione un trabajador');
    return;
  }

  if (!productosVenta.length) {
    alert('Por favor agregue al menos un producto');
    return;
  }

  try {
    const payload = {
      trabajador_id: trabajadorId,
      productos: productosVenta.map((p) => ({ id: p.id, precio: p.precio, cantidad: p.cantidad }))
    };

    const result = await fetchJson(`${API_URL}/ventas`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    // Modificación para impresión directa:
    // 1. No mostrar alert
    // 2. Renderizar ticket y mandar imprimir
    await mostrarTicket(result.id, true);

    // 3. Limpiar venta inmediatamente
    cancelarVenta();

    await cargarProductos();
    cargarSelectProductos();
  } catch (e) {
    alert(e.message || 'Error al completar la venta');
  }
}

function cancelarVenta() {
  productosVenta = [];
  totalVenta = 0;
  const ts = qs('trabajador-select');
  if (ts && usuarioActual.rol !== 'trabajador') ts.value = '';
  const ps = qs('producto-select');
  if (ps) ps.value = '';
  const ci = qs('cantidad-input');
  if (ci) ci.value = '1';

  const buscar = qs('venta-buscar');
  if (buscar) buscar.value = '';
  ventaBusqueda = '';
  // No tocamos la categoría, se queda como estaba

  actualizarListaVenta();
}

window.agregarProductoVenta = agregarProductoVenta;
window.agregarProductoVentaRapido = agregarProductoVentaRapido;
window.quitarProductoVentaRapido = quitarProductoVentaRapido;
window.cambiarCantidadVenta = cambiarCantidadVenta;
window.setCantidadVenta = setCantidadVenta;
window.eliminarProductoVenta = eliminarProductoVenta;
window.completarVenta = completarVenta;
window.cancelarVenta = cancelarVenta;

// -------------------- Historial --------------------

async function cargarTablaVentas(filtros = {}) {
  try {
    let url = `${API_URL}/ventas?`;
    if (filtros.trabajador_id) url += `trabajador_id=${encodeURIComponent(filtros.trabajador_id)}&`;
    if (filtros.fecha_inicio) url += `fecha_inicio=${encodeURIComponent(filtros.fecha_inicio)}&`;
    if (filtros.fecha_fin) url += `fecha_fin=${encodeURIComponent(filtros.fecha_fin)}&`;

    const ventas = await fetchJson(url, { method: 'GET' });
    if (!ventas) return;

    const tbody = qs('ventas-tabla');
    if (!tbody) return;

    if (!ventas.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay ventas registradas</td></tr>';
      return;
    }

    tbody.innerHTML = ventas.map((v) => {
      const fecha = formatDateTime(v.fecha);
      return `
        <tr>
          <td>${v.id}</td>
          <td>${v.trabajador_nombre}</td>
          <td>${formatMoney(v.total)}</td>
          <td>${fecha}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="verDetalleVenta(${v.id})"><i class="fas fa-eye"></i></button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    console.error('Historial:', e);
  }
}

function cargarFiltroTrabajadores() {
  const select = qs('filtro-trabajador');
  if (!select) return;

  if (usuarioActual.rol !== 'admin') {
    select.innerHTML = `<option value="${usuarioActual.id}">${usuarioActual.nombre}</option>`;
    select.disabled = true;
    return;
  }

  select.disabled = false;
  select.innerHTML = '<option value="">Todos los trabajadores</option>' + trabajadores.map((t) => `<option value="${t.id}">${t.nombre}</option>`).join('');
}

function filtrarVentas() {
  const filtros = {
    trabajador_id: qs('filtro-trabajador') ? qs('filtro-trabajador').value : '',
    fecha_inicio: qs('filtro-fecha-inicio') ? qs('filtro-fecha-inicio').value : '',
    fecha_fin: qs('filtro-fecha-fin') ? qs('filtro-fecha-fin').value : ''
  };
  cargarTablaVentas(filtros);
}

async function verDetalleVenta(id) {
  await mostrarTicket(id);
}

window.filtrarVentas = filtrarVentas;
window.verDetalleVenta = verDetalleVenta;

// -------------------- Ticket --------------------

async function mostrarTicket(ventaId, autoPrint = false) {
  try {
    const venta = await fetchJson(`${API_URL}/ventas/${ventaId}`, { method: 'GET' });
    if (!venta) return;

    const fecha = formatDateTime(venta.fecha);

    let ticketHTML = `
      <div class="ticket-paper">
        <div class="ticket-header">
          <img src="/assets/logo.png" alt="Logo" class="ticket-logo">
          <h2>Obleas & Botanas</h2>
          <p>Sistema de Ventas</p>
        </div>
        <div class="ticket-info">
          <p><strong>Ticket #:</strong> ${venta.id}</p>
          <p><strong>Trabajador:</strong> ${venta.trabajador_nombre}</p>
          <p><strong>Fecha:</strong> ${fecha}</p>
        </div>
        <div class="ticket-productos">
    `;

    (venta.detalles || []).forEach((d) => {
      ticketHTML += `
        <div class="ticket-producto">
          <div>
            <div>${d.producto_nombre}</div>
            <div>${d.cantidad} x ${formatMoney(d.precio_unitario)}</div>
          </div>
          <div>${formatMoney(d.subtotal)}</div>
        </div>
      `;
    });

    ticketHTML += `
        </div>
        <div class="ticket-total"><p>TOTAL: ${formatMoney(venta.total)}</p></div>
        <div class="ticket-footer"><p>¡Gracias por su compra!</p></div>
      </div>
    `;

    const cont = qs('ticket-contenido');
    if (cont) cont.innerHTML = ticketHTML;

    const modal = qs('modal-ticket');

    if (autoPrint) {
      // IMPRESIÓN AUTOMÁTICA VIA IFRAME (Estrategia más compatible)
      imprimirViaIframe(ticketHTML);
    } else {
      // MOSTRAR MODAL (Solo si no es auto-print, ej. desde historial)
      if (modal) modal.classList.add('active');
    }
  } catch (e) {
    console.error(e);
    alert(e.message || 'Error al mostrar el ticket');
  }
}

// Función para imprimir usando el iframe oculto (Solución definitiva para Android/PC)
function imprimirViaIframe(html) {
  const iframe = document.getElementById('iframe-impresion');
  if (!iframe) {
    window.print(); // Fallback si no existe el iframe
    return;
  }

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <html>
      <head>
        <style>
          @page { size: 58mm auto; margin: 0; }
          body { 
            margin: 0; 
            padding: 0; 
            width: 58mm; 
            font-family: monospace;
            background: #fff;
            color: #000;
          }
          #ticket-contenido { 
            width: 58mm; 
            padding: 2mm; 
            box-sizing: border-box;
          }
          .ticket-header { text-align: center; margin-bottom: 5px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
          .ticket-logo { width: 140px; height: auto; display: block; margin: 0 auto 5px; }
          .ticket-header h2 { font-size: 15px; margin: 4px 0; text-transform: uppercase; }
          .ticket-header p { font-size: 11px; margin: 0; }
          .ticket-info { margin: 5px 0; font-size: 11px; }
          .ticket-info p { margin: 2px 0; }
          .ticket-productos { margin: 5px 0; padding: 5px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
          .ticket-producto { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; font-weight: bold; }
          .ticket-producto > div:first-child { flex: 1; padding-right: 5px; }
          .ticket-total { font-weight: 900; font-size: 16px; text-align: right; margin-top: 6px; border-top: 1px solid #000; padding-top: 4px; }
          .ticket-footer { text-align: center; margin-top: 10px; font-size: 11px; padding-bottom: 20mm; }
        </style>
      </head>
      <body>
        <div id="ticket-contenido">
          ${html}
        </div>
        <script>
          // Esperar a que las imágenes carguen antes de imprimir
          window.onload = function() {
            window.print();
          };
        <\/script>
      </body>
    </html>
  `);
  doc.close();
}

function cerrarModalTicket() {
  const modal = qs('modal-ticket');
  if (modal) modal.classList.remove('active');
}

function imprimirTicket() {
  const html = qs('ticket-contenido') ? qs('ticket-contenido').innerHTML : '';
  imprimirViaIframe(html);
}

window.mostrarTicket = mostrarTicket;
window.cerrarModalTicket = cerrarModalTicket;
window.imprimirTicket = imprimirTicket;

// -------------------- Reportes (admin) --------------------

async function generarReporteTrabajadores() {
  try {
    const fechaInicio = qs('reporte-fecha-inicio').value;
    const fechaFin = qs('reporte-fecha-fin').value;

    let url = `${API_URL}/reportes/ventas-por-trabajador?`;
    if (fechaInicio) url += `fecha_inicio=${encodeURIComponent(fechaInicio)}&`;
    if (fechaFin) url += `fecha_fin=${encodeURIComponent(fechaFin)}&`;

    const data = await fetchJson(url, { method: 'GET' });
    if (!data) return;

    const container = qs('reporte-trabajadores-resultado');
    if (!container) return;

    if (!data.length) {
      container.innerHTML = '<p class="text-center">No hay datos para mostrar</p>';
      return;
    }

    container.innerHTML = data.map((t) => `
      <div class="reporte-item">
        <h4>${t.nombre}</h4>
        <p>Total Ventas: ${t.total_ventas}</p>
        <p>Total Vendido: ${formatMoney(t.total_vendido)}</p>
      </div>
  `).join('');
  } catch (e) {
    alert(e.message || 'Error al generar el reporte');
  }
}

async function generarReporteProductos() {
  try {
    const fechaInicio = qs('productos-fecha-inicio').value;
    const fechaFin = qs('productos-fecha-fin').value;

    let url = `${API_URL}/reportes/productos-mas-vendidos?`;
    if (fechaInicio) url += `fecha_inicio=${encodeURIComponent(fechaInicio)}&`;
    if (fechaFin) url += `fecha_fin=${encodeURIComponent(fechaFin)}&`;

    const data = await fetchJson(url, { method: 'GET' });
    if (!data) return;

    const container = qs('reporte-productos-resultado');
    if (!container) return;

    if (!data.length) {
      container.innerHTML = '<p class="text-center">No hay datos para mostrar</p>';
      return;
    }

    container.innerHTML = data.map((p) => `
      <div class="reporte-item">
        <h4>${p.nombre}</h4>
        <p>Categoría: ${p.categoria}</p>
        <p>Cantidad Vendida: ${p.cantidad_vendida}</p>
        <p>Total Vendido: ${formatMoney(p.total_vendido)}</p>
      </div>
  `).join('');
  } catch (e) {
    alert(e.message || 'Error al generar el reporte');
  }
}

window.generarReporteTrabajadores = generarReporteTrabajadores;
window.generarReporteProductos = generarReporteProductos;

// -------------------- Gestión de Inventario (Admin) --------------------

function cargarSelectTrabajadoresAsignar() {
  const select = qs('asignar-trabajador-select');
  if (!select) return;

  select.innerHTML = '<option value="">Seleccionar trabajador...</option>' +
    trabajadores.filter(t => t.rol !== 'admin').map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
}

async function cargarTablaAsignaciones() {
  const tid = qs('asignar-trabajador-select').value;
  const tbody = qs('asignaciones-tabla');
  if (!tbody) return;

  if (!tid) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Seleccione un trabajador para ver su inventario</td></tr>';
    return;
  }

  try {
    const data = await fetchJson(`${API_URL}/inventario/trabajador/${tid}`);
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center">El trabajador no tiene productos asignados</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(i => `
      <tr>
        <td>${i.nombre}</td>
        <td>${i.categoria}</td>
        <td><strong>${i.stock}</strong></td>
        <td>${formatDateTime(i.fecha_actualizacion)}</td>
      </tr>
    `).join('');
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error al cargar datos</td></tr>';
  }
}

async function mostrarModalAsignar() {
  const tid = qs('asignar-trabajador-select').value;
  const modal = qs('modal-asignar');
  if (!modal) return;

  const selectT = qs('modal-asignar-trabajador');
  const selectP = qs('modal-asignar-producto');

  // Cargar trabajadores en el modal
  selectT.innerHTML = '<option value="">Seleccionar...</option>' +
    trabajadores.filter(t => t.rol !== 'admin').map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');

  if (tid) selectT.value = tid;

  // Cargar productos globales disponibles
  const prodsGlobales = await fetchJson(`${API_URL}/productos`);
  selectP.innerHTML = '<option value="">Seleccionar producto...</option>' +
    prodsGlobales.map(p => `<option value="${p.id}">${p.nombre} (Stock: ${p.stock})</option>`).join('');

  modal.classList.add('active');
}

function cerrarModalAsignar() {
  qs('modal-asignar').classList.remove('active');
}

async function guardarAsignacion() {
  const trabajador_id = qs('modal-asignar-trabajador').value;
  const producto_id = qs('modal-asignar-producto').value;
  const cantidad = Number(qs('modal-asignar-cantidad').value);

  if (!trabajador_id || !producto_id || cantidad <= 0) {
    alert('Por favor complete todos los datos correctamente');
    return;
  }

  try {
    await fetchJson(`${API_URL}/inventario/asignar`, {
      method: 'POST',
      body: JSON.stringify({ trabajador_id, producto_id, cantidad })
    });

    alert('Inventario asignado correctamente');
    cerrarModalAsignar();
    cargarTablaAsignaciones();
  } catch (e) {
    alert(e.message || 'Error al asignar inventario');
  }
}

window.cargarTablaAsignaciones = cargarTablaAsignaciones;
window.mostrarModalAsignar = mostrarModalAsignar;
window.cerrarModalAsignar = cerrarModalAsignar;
window.guardarAsignacion = guardarAsignacion;
