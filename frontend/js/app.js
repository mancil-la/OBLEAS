// API Base URL - se detecta automáticamente en producción
const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';

// Estado global
let productos = [];
let trabajadores = [];
let productosVenta = [];
let totalVenta = 0;
let usuarioActual = null;

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacion();
});

async function verificarAutenticacion() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            // No autenticado, redirigir al login
            window.location.href = 'login.html';
            return;
        }
        
        usuarioActual = await response.json();
        console.log('Usuario autenticado:', usuarioActual);
        
        // Inicializar aplicación
        inicializarApp();
        configurarNavegacion();
        cargarFechaActual();
        mostrarInfoUsuario();
        configurarMenuSegunRol();
    } catch (error) {
        console.error('Error verificando autenticación:', error);
        window.location.href = 'login.html';
    }
}

function mostrarInfoUsuario() {
    const fechaDiv = document.getElementById('fecha-actual');
    const rol = usuarioActual.rol === 'admin' ? 'Administrador' : 'Trabajador';
    const fecha = new Date();
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    fechaDiv.innerHTML = `
        <div style="text-align: right;">
            <div><strong>${usuarioActual.nombre}</strong> (${rol})</div>
            <div style="font-size: 0.85rem; margin-top: 0.25rem; color: #64748b;">${fecha.toLocaleDateString('es-ES', opciones)}</div>
        </div>
    `;
}

function configurarMenuSegunRol() {
    if (usuarioActual.rol !== 'admin') {
        // Ocultar opciones de administrador
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            const section = item.dataset.section;
            // Los trabajadores no pueden ver: inventario, trabajadores, reportes globales
            if (section === 'productos' || section === 'trabajadores' || section === 'reportes') {
                item.style.display = 'none';
            }
        });
    }
}

async function cerrarSesion() {
    try {
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error cerrando sesión:', error);
        window.location.href = 'login.html';
    }
}

async function inicializarApp() {
    await cargarProductos();
    await cargarTrabajadores();
    await cargarDashboard();
}

function configurarNavegacion() {
    const menuItems = document.querySelectorAll('.menu-item');
    
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Actualizar clase activa
            menuItems.forEach(mi => mi.classList.remove('active'));
            item.classList.add('active');
            
            // Mostrar sección correspondiente
            const sectionId = item.dataset.section;
            mostrarSeccion(sectionId);
        });
    });
}

function mostrarSeccion(sectionId) {
    // Ocultar todas las secciones
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Mostrar sección seleccionada
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
    }
    
    // Actualizar título
    const titulos = {
        'dashboard': 'Dashboard',
        'ventas': 'Nueva Venta',
        'productos': 'Inventario de Productos',
        'historial': 'Historial de Ventas',
        'trabajadores': 'Gestión de Trabajadores',
        'reportes': 'Reportes'
    };
    document.getElementById('page-title').textContent = titulos[sectionId] || '';
    
    // Cargar datos según la sección
    switch(sectionId) {
        case 'dashboard':
            cargarDashboard();
            break;
        case 'ventas':
            cargarSelectTrabajadores();
            cargarSelectProductos();
            break;
        case 'productos':
            cargarTablaProductos();
            break;
        case 'historial':
            cargarTablaVentas();
            cargarFiltroTrabajadores();
            break;
        case 'trabajadores':
            cargarTablaTrabajadores();
            break;
    }
}

function cargarFechaActual() {
    // Esta función ya no se usa porque se integró en mostrarInfoUsuario()
}

// ==================== DASHBOARD ====================

async function cargarDashboard() {
    try {
        const response = await fetch(`${API_URL}/reportes/resumen`, {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }
        
        const data = await response.json();
        
        document.getElementById('stat-productos').textContent = data.total_productos || 0;
        document.getElementById('stat-trabajadores').textContent = data.trabajadores_activos || 0;
        document.getElementById('stat-ventas-hoy').textContent = data.ventas_hoy || 0;
        document.getElementById('stat-total-hoy').textContent = `$${(data.total_hoy || 0).toFixed(2)}`;
        
        // Solo admin puede ver gráficos comparativos
        if (usuarioActual.rol === 'admin') {, {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }
        
            await cargarGraficoVentasTrabajador();
        }
        await cargarGraficoProductosVendidos();
    } catch (error) {
        console.error('Error cargando dashboard:', error);
    }
}

async function cargarGraficoVentasTrabajador() {
    try {
        const response = await fetch(`${API_URL}/reportes/ventas-por-trabajador`);
        const data = await response.json();
        
        const container = document.getElementById('ventas-trabajador-chart');, {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }
        
        container.innerHTML = '';
        
        data.forEach(item => {
            const bar = document.createElement('div');
            bar.className = 'reporte-item';
            bar.innerHTML = `
                <h4>${item.nombre}</h4>
                <p>Ventas: ${item.total_ventas} | Total: $${item.total_vendido.toFixed(2)}</p>
            `;
            container.appendChild(bar);
        });
    } catch (error) {
        console.error('Error cargando gráfico de ventas:', error);
    }
}

async function cargarGraficoProductosVendidos() {
    try {
        const response = await fetch(`${API_URL}/reportes/productos-mas-vendidos`);
        const data = await response.json();
        
        const container = document.getElementById('productos-vendidos-chart');
        container.innerHTML = '';
        
        data.forEach(item => {
            const bar = document.createElement('div');
            bar.className = 'reporte-item';
            bar.innerHTML = `
                <h4>${item.nombre}</h4>
                <p>Cantidad: ${item.cantidad_vendida} | Total: $${item.total_vendido.toFixed(2)}</p>
            `;
            container.appendChild(bar);
        });
    } catch (error) {
        console.error('Error cargando productos vendidos:', error);
    }
}

// ==================== PRODUCTOS ====================

async function cargarProductos() {
    try {
        const response = await fetch(`${API_URL}/productos`, {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.href = 'login.html';
            return [];
        }
        
        productos = await response.json();
        return productos;
    } catch (error) {
        console.error('Error cargando productos:', error);
        return [];
    }
}

async function cargarTablaProductos() {
    await cargarProductos();
    const tbody = document.getElementById('productos-tabla');
    
    if (productos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay productos registrados</td></tr>';
        return;
    }
    
    tbody.innerHTML = productos.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${p.nombre}</td>
            <td>${p.categoria}</td>
            <td>$${p.precio.toFixed(2)}</td>
            <td>${p.stock}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editarProducto(${p.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${p.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function mostrarModalProducto(id = null) {
    const modal = document.getElementById('modal-producto');
    const titulo = document.getElementById('modal-titulo');
    
    if (id) {
        titulo.textContent = 'Editar Producto';
        const producto = productos.find(p => p.id === id);
        if (producto) {
            document.getElementById('producto-id').value = producto.id;
            document.getElementById('producto-nombre').value = producto.nombre;
            document.getElementById('producto-categoria').value = producto.categoria;
            document.getElementById('producto-precio').value = producto.precio;
            document.getElementById('producto-stock').value = producto.stock;
        }
    } else {
        titulo.textContent = 'Nuevo Producto';
        document.getElementById('producto-id').value = '';
        document.getElementById('producto-nombre').value = '';
        document.getElementById('producto-categoria').value = 'Obleas';
        document.getElementById('producto-precio').value = '';
        document.getElementById('producto-stock').value = '';
    }
    
    modal.classList.add('active');
}

function cerrarModalProducto() {
    document.getElementById('modal-producto').classList.remove('active');
}

async function guardarProducto() {
    const id = document.getElementById('producto-id').value;
    const nombre = document.getElementById('producto-nombre').value;
    const categoria = document.getElementById('producto-categoria').value;
    const precio = parseFloat(document.getElementById('producto-precio').value);
    const stock = parseInt(document.getElementById('producto-stock').value);
    
    if (!nombre || !precio || isNaN(stock)) {
        alert('Por favor complete todos los campos correctamente');
        return;
    }
    
    try {
        const url = id ? `${API_URL}/productos/${id}` : `${API_URL}/productos`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, categoria, precio, stock })
        });
        credentials: 'include',
            
        if (response.ok) {
            alert(`Producto ${id ? 'actualizado' : 'creado'} exitosamente`);
            cerrarModalProducto();
            await cargarTablaProductos();
        } else {
            alert('Error al guardar el producto');
        }
    } catch (error) {
        console.error('Error guardando producto:', error);
        alert('Error al guardar el producto');
    }
}

function editarProducto(id) {
    mostrarModalProducto(id);
}

async function eliminarProducto(id) {
    if (!confirm('¿Está seguro de eliminar este producto?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/productos/${id}`, {
            method: 'DELETE'
        });,
            credentials: 'include'
        
        if (response.ok) {
            alert('Producto eliminado exitosamente');
            await cargarTablaProductos();
        } else {
            alert('Error al eliminar el producto');
        }
    } catch (error) {
        console.error('Error eliminando producto:', error);
        alert('Error al eliminar el producto');
    }
}, {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.href = 'login.html';
            return [];
        }
        
        if (response.status === 403) {
            // No tiene permisos, usar datos limitados
            trabajadores = [usuarioActual];
            return trabajadores;
        }
        

// ==================== TRABAJADORES ====================

async function cargarTrabajadores() {
    try {
        const response = await fetch(`${API_URL}/trabajadores`);
        trabajadores = await response.json();
        return trabajadores;
    } catch (error) {
        console.error('Error cargando trabajadores:', error);
        return [];
    }
}

async function cargarTablaTrabajadores() {
    await cargarTrabajadores();
    const tbody = document.getElementById('trabajadores-tabla');
    
    tbody.innerHTML = trabajadores.map(t => `
        <tr>
            <td>${t.id}</td>
            <td>${t.nombre}</td>
            <td>${t.telefono || '-'}</td>
            <td>
                <span class="badge ${t.activo ? 'badge-success' : 'badge-danger'}">
                    ${t.activo ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editarTrabajador(${t.id})">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function editarTrabajador(id) {
    const modal = document.getElementById('modal-trabajador');
    const trabajador = trabajadores.find(t => t.id === id);
    
    if (trabajador) {
        document.getElementById('trabajador-id').value = trabajador.id;
        document.getElementById('trabajador-nombre').value = trabajador.nombre;
        document.getElementById('trabajador-telefono').value = trabajador.telefono || '';
        document.getElementById('trabajador-activo').value = trabajador.activo;
        modal.classList.add('active');
    }
}

function cerrarModalTrabajador() {
    document.getElementById('modal-trabajador').classList.remove('active');
}

async function guardarTrabajador() {
    const id = document.getElementById('trabajador-id').value;
    const nombre = document.getElementById('trabajador-nombre').value;
    const telefono = document.getElementById('trabajador-telefono').value;
    const activo = parseInt(document.getElementById('trabajador-activo').value);
    
    if (!nombre) {
        alert('Por favor ingrese el nombre del trabajador');
    
    // Si es trabajador, preseleccionar y deshabilitar
    if (usuarioActual.rol === 'trabajador') {
        select.innerHTML = `<option value="${usuarioActual.id}" selected>${usuarioActual.nombre}</option>`;
        select.disabled = true;
    } else {
        // Admin puede seleccionar cualquier trabajador
        select.innerHTML = '<option value="">Seleccionar trabajador...</option>' +
            trabajadores.filter(t => t.activo).map(t => 
                `<option value="${t.id}">${t.nombre}</option>`
            ).join('');
        select.disabled = false;
    }
        const response = await fetch(`${API_URL}/trabajadores/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, telefono, activo })
        });
        
        if (response.ok) {
            alert('Trabajador actualizado exitosamente');
            cerrarModalTrabajador();
            await cargarTablaTrabajadores();
        } else {
            alert('Error al actualizar el trabajador');
        }
    } catch (error) {
        console.error('Error actualizando trabajador:', error);
        alert('Error al actualizar el trabajador');
    }
}

// ==================== VENTAS ====================

function cargarSelectTrabajadores() {
    const select = document.getElementById('trabajador-select');
    select.innerHTML = '<option value="">Seleccionar trabajador...</option>' +
        trabajadores.filter(t => t.activo).map(t => 
            `<option value="${t.id}">${t.nombre}</option>`
        ).join('');
}

function cargarSelectProductos() {
    const select = document.getElementById('producto-select');
    select.innerHTML = '<option value="">Seleccionar producto...</option>' +
        productos.filter(p => p.stock > 0).map(p => 
            `<option value="${p.id}">${p.nombre} - $${p.precio.toFixed(2)} (Stock: ${p.stock})</option>`
        ).join('');
}

function agregarProductoVenta() {
    const productoId = parseInt(document.getElementById('producto-select').value);
    const cantidad = parseInt(document.getElementById('cantidad-input').value);
    
    if (!productoId || !cantidad || cantidad <= 0) {
        alert('Por favor seleccione un producto y cantidad válida');
        return;
    }
    
    const producto = productos.find(p => p.id === productoId);
    
    if (!producto) {
        alert('Producto no encontrado');
        return;
    }
    
    if (cantidad > producto.stock) {
        alert(`Stock insuficiente. Disponible: ${producto.stock}`);
        return;
    }
    
    // Verificar si el producto ya está en la lista
    const existente = productosVenta.find(p => p.id === productoId);
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
            precio: producto.precio,
            cantidad: cantidad
        });
    }
    
    actualizarListaVenta();
    
    // Limpiar selección
    document.getElementById('producto-select').value = '';
    document.getElementById('cantidad-input').value = '1';
}

function actualizarListaVenta() {
    const lista = document.getElementById('productos-venta-lista');
    
    if (productosVenta.length === 0) {
        lista.innerHTML = '<p class="text-center text-light">No hay productos agregados</p>';
        totalVenta = 0;
    } else {
        lista.innerHTML = productosVenta.map((p, index) => {
            const subtotal = p.precio * p.cantidad;
            return `
                <div class="producto-venta-item">
                    <div class="producto-venta-info">
                        <h4>${p.nombre}</h4>
                        <p>${p.cantidad} x $${p.precio.toFixed(2)} = $${subtotal.toFixed(2)}</p>
                    </div>
                    <button class="btn btn-sm btn-danger" onclick="eliminarProductoVenta(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');
        
        totalVenta = productosVenta.reduce((sum, p) => sum + (p.precio * p.cantidad), 0);
    }
    
    document.getElementById('total-venta').textContent = totalVenta.toFixed(2);
}

function eliminarProductoVenta(index) {
    productosVenta.splice(index, 1);
    actualizarListaVenta();
}

async function completarVenta() {
    // Para trabajadores, el ID viene del select (que está pre-seleccionado)
    // Para admin, debe seleccionar
    const trabajadorId = parseInt(document.getElementById('trabajador-select').value);
    
    if (!trabajadorId) {
        alert('Por favor seleccione un trabajador');
        return;
    }
    
    if (productosVenta.length === 0) {
        alert('Por favor agregue al menos un producto');
        return;
    }
    
    console.log('Completando venta para trabajador:', trabajadorId, 'Productos:', productosVenta);
    
    try {
        const response = await fetch(`${API_URL}/ventas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                trabajador_id: trabajadorId,
                productos: productosVenta
            })
        });
        
        console.log('Respuesta del servidor:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            alert('Venta registrada exitosamente');
            
            // Mostrar ticket
            await mostrarTicket(result.id);
            
            // Limpiar formulario
            cancelarVenta();
            
            // Recargar productos para actualizar stock
            await cargarProductos();
            cargarSelectProductos();
        } else {
            const error = await response.json();
            alert('Error al registrar la venta: ' + error.error);
        }
    } catch (error) {
        console.error('Error completando venta:', error);
        alert('Error al completar la venta');
    }
}

function cancelarVenta() {, {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }
        
    productosVenta = [];
    totalVenta = 0;
    document.getElementById('trabajador-select').value = '';
    document.getElementById('producto-select').value = '';
    document.getElementById('cantidad-input').value = '1';
    actualizarListaVenta();
}

// ==================== HISTORIAL ====================

async function cargarTablaVentas(filtros = {}) {
    try {
        let url = `${API_URL}/ventas?`;
        if (filtros.trabajador_id) url += `trabajador_id=${filtros.trabajador_id}&`;
        if (filtros.fecha_inicio) url += `fecha_inicio=${filtros.fecha_inicio}&`;
        if (filtros.fecha_fin) url += `fecha_fin=${filtros.fecha_fin}&`;
        
        const response = await fetch(url);
        const ventas = await response.json();
        
        const tbody = document.getElementById('ventas-tabla');
        
        if (ventas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay ventas registradas</td></tr>';
            return;
        }
        
        tbody.innerHTML = ventas.map(v => {
            const fecha = new Date(v.fecha).toLocaleString('es-ES');
            return `
                <tr>
                    <td>${v.id}</td>
                    <td>${v.trabajador_nombre}</td>
                    <td>$${v.total.toFixed(2)}</td>
                    <td>${fecha}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="verDetalleVenta(${v.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');, {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }
        
    } catch (error) {
        console.error('Error cargando ventas:', error);
    }
}

function cargarFiltroTrabajadores() {
    const select = document.getElementById('filtro-trabajador');
    select.innerHTML = '<option value="">Todos los trabajadores</option>' +
        trabajadores.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
}

function filtrarVentas() {
    const filtros = {
        trabajador_id: document.getElementById('filtro-trabajador').value,
        fecha_inicio: document.getElementById('filtro-fecha-inicio').value,
        fecha_fin: document.getElementById('filtro-fecha-fin').value
    };
    
    cargarTablaVentas(filtros);
}

async function verDetalleVenta(id) {
    await mostrarTicket(id);
}

// ==================== TICKET ====================

async function mostrarTicket(ventaId) {
    try {
        const response = await fetch(`${API_URL}/ventas/${ventaId}`);
        const venta = await response.json();
        
        const fecha = new Date(venta.fecha).toLocaleString('es-ES');
        
        let ticketHTML = `
            <div class="ticket-header">
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
        
        venta.detalles.forEach(d => {
            ticketHTML += `
                <div class="ticket-producto">
                    <div>
                        <div>${d.producto_nombre}</div>
                        <div>${d.cantidad} x $${d.precio_unitario.toFixed(2)}</div>
                    </div>
                    <div>$${d.subtotal.toFixed(2)}</div>
                </div>
            `;
        });
        
        ticketHTML += `
            </div>
            <div class="ticket-total">
                <p>TOTAL: $${venta.total.toFixed(2)}</p>
            </div>
            <div class="ticket-footer">
                <p>¡Gracias por su compra!</p>
                <p>Visite: www.obleasybotanas.com</p>
            </div>
        `;
        
        document.getElementById('ticket-contenido').innerHTML = ticketHTML;
        document.getElementById('modal-ticket').classList.add('active');
    } catch (error) {
        console.error('Error mostrando ticket:', error);
        alert('Error al mostrar el ticket');
    }
}

function cerrarModalTicket() {
    document.getElementById('modal-ticket').classList.remove('active');
}

function imprimirTicket() {
    const contenido = document.getElementById('ticket-contenido').innerHTML;
    const ventana = window.open('', '', 'width=400,height=600');
    ventana.document.write(`
        <html>
        <head>
            <title>Ticket de Venta</title>
            <style>
                body { font-family: 'Courier New', monospace; padding: 20px; }
                .ticket-header { text-align: center; margin-bottom: 20px; }
                .ticket-info { margin-bottom: 20px; }
                .ticket-productos { border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 10px 0; }
                .ticket-producto { display: flex; justify-content: space-between; margin-bottom: 10px; }
                .ticket-total { font-weight: bold; font-size: 1.2em; text-align: right; margin-top: 10px; }
                .ticket-footer { text-align: center; margin-top: 20px; border-top: 2px dashed #000; padding-top: 10px; }
            </style>, {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }
        
        </head>
        <body>
            ${contenido}
        </body>
        </html>
    `);
    ventana.document.close();
    ventana.print();
}

// ==================== REPORTES ====================

async function generarReporteTrabajadores() {
    const fechaInicio = document.getElementById('reporte-fecha-inicio').value;
    const fechaFin = document.getElementById('reporte-fecha-fin').value;
    
    try {
        let url = `${API_URL}/reportes/ventas-por-trabajador?`;
        if (fechaInicio) url += `fecha_inicio=${fechaInicio}&`;
        if (fechaFin) url += `fecha_fin=${fechaFin}&`;
        
        const response = await fetch(url);
        const data = await response.json();
        , {
            credentials: 'include'
        });
        
        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }
        
        const container = document.getElementById('reporte-trabajadores-resultado');
        
        if (data.length === 0) {
            container.innerHTML = '<p class="text-center">No hay datos para mostrar</p>';
            return;
        }
        
        container.innerHTML = data.map(t => `
            <div class="reporte-item">
                <h4>${t.nombre}</h4>
                <p>Total Ventas: ${t.total_ventas}</p>
                <p>Total Vendido: $${t.total_vendido.toFixed(2)}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error generando reporte:', error);
        alert('Error al generar el reporte');
    }
}

async function generarReporteProductos() {
    const fechaInicio = document.getElementById('productos-fecha-inicio').value;
    const fechaFin = document.getElementById('productos-fecha-fin').value;
    
    try {
        let url = `${API_URL}/reportes/productos-mas-vendidos?`;
        if (fechaInicio) url += `fecha_inicio=${fechaInicio}&`;
        if (fechaFin) url += `fecha_fin=${fechaFin}&`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        const container = document.getElementById('reporte-productos-resultado');
        
        if (data.length === 0) {
            container.innerHTML = '<p class="text-center">No hay datos para mostrar</p>';
            return;
        }
        
        container.innerHTML = data.map(p => `
            <div class="reporte-item">
                <h4>${p.nombre}</h4>
                <p>Categoría: ${p.categoria}</p>
                <p>Cantidad Vendida: ${p.cantidad_vendida}</p>
                <p>Total Vendido: $${p.total_vendido.toFixed(2)}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error generando reporte:', error);
        alert('Error al generar el reporte');
    }
}
