const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json());
app.use(session({
  secret: 'obleas-secreto-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// Inicializar base de datos
db.initDatabase();

// ==================== MIDDLEWARE DE AUTENTICACIÓN ====================

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  // Validar que el usuario siga activo
  db.getWorkerSessionInfo(req.session.userId, (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!user || user.activo !== 1) {
      req.session.destroy(() => {
        return res.status(401).json({ error: 'Usuario inactivo o no existe' });
      });
      return;
    }

    // Refrescar datos de sesión por si cambiaron
    req.session.userName = user.nombre;
    req.session.userRole = user.rol;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.userRole !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Solo administradores' });
  }
  next();
}

// ==================== RUTAS DE AUTENTICACIÓN ====================

// Login
app.post('/api/auth/login', async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  db.loginUser(usuario, password, (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    // Crear sesión
    req.session.userId = user.id;
    req.session.userName = user.nombre;
    req.session.userRole = user.rol;

    res.json({
      id: user.id,
      nombre: user.nombre,
      rol: user.rol
    });
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error al cerrar sesión' });
    }
    res.json({ message: 'Sesión cerrada exitosamente' });
  });
});

// Verificar sesión
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    id: req.session.userId,
    nombre: req.session.userName,
    rol: req.session.userRole
  });
});

// ==================== RUTAS DE PRODUCTOS ====================

// Obtener todos los productos
app.get('/api/productos', requireAuth, (req, res) => {
  db.getAllProducts((err, productos) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(productos);
  });
});

// Obtener un producto por ID
app.get('/api/productos/:id', requireAuth, (req, res) => {
  db.getProductById(req.params.id, (err, producto) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!producto) {
      res.status(404).json({ error: 'Producto no encontrado' });
      return;
    }
    res.json(producto);
  });
});

// Crear nuevo producto
app.post('/api/productos', requireAdmin, (req, res) => {
  const { nombre, categoria, precio, stock } = req.body;

  if (!nombre || !precio) {
    res.status(400).json({ error: 'Nombre y precio son requeridos' });
    return;
  }

  db.createProduct({ nombre, categoria, precio, stock }, (err, id) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(201).json({ id, message: 'Producto creado exitosamente' });
  });
});

// Actualizar producto
app.put('/api/productos/:id', requireAdmin, (req, res) => {
  const { nombre, categoria, precio, stock } = req.body;

  db.updateProduct(req.params.id, { nombre, categoria, precio, stock }, (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Producto actualizado exitosamente' });
  });
});

// Ajustar stock (sumar/restar)
app.post('/api/productos/:id/ajustar-stock', requireAdmin, (req, res) => {
  const { delta } = req.body;
  const deltaNum = Number(delta);

  if (Number.isNaN(deltaNum) || !Number.isFinite(deltaNum) || deltaNum === 0) {
    return res.status(400).json({ error: 'Delta inválido' });
  }

  db.adjustStock(req.params.id, deltaNum, (err, newStock) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json({ message: 'Stock actualizado', stock: newStock });
  });
});

// Eliminar producto
app.delete('/api/productos/:id', requireAdmin, (req, res) => {
  db.deleteProduct(req.params.id, (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Producto eliminado exitosamente' });
  });
});

// ==================== RUTAS DE TRABAJADORES ====================

// Obtener todos los trabajadores
app.get('/api/trabajadores', requireAdmin, (req, res) => {
  db.getAllWorkers((err, trabajadores) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(trabajadores);
  });
});

// Obtener trabajador por ID
app.get('/api/trabajadores/:id', requireAuth, (req, res) => {
  db.getWorkerById(req.params.id, (err, trabajador) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!trabajador) {
      res.status(404).json({ error: 'Trabajador no encontrado' });
      return;
    }
    res.json(trabajador);
  });
});

// Actualizar trabajador
app.put('/api/trabajadores/:id', requireAdmin, (req, res) => {
  const { nombre, usuario, password, rol, telefono, activo } = req.body;

  db.updateWorker(req.params.id, { nombre, usuario, password, rol, telefono, activo }, (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Trabajador actualizado exitosamente' });
  });
});

// Crear trabajador
app.post('/api/trabajadores', requireAdmin, (req, res) => {
  const { nombre, usuario, password, rol, telefono, activo } = req.body;

  db.createWorker({ nombre, usuario, password, rol, telefono, activo }, (err, id) => {
    if (err) {
      // SQLite unique constraint
      if (err.message && err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'El usuario ya existe' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id, message: 'Trabajador creado exitosamente' });
  });
});

// Desactivar (eliminar) trabajador
app.delete('/api/trabajadores/:id', requireAdmin, (req, res) => {
  db.deactivateWorker(req.params.id, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Trabajador desactivado exitosamente' });
  });
});

// ==================== RUTAS DE VENTAS ====================

// Obtener todas las ventas
app.get('/api/ventas', requireAuth, (req, res) => {
  const { trabajador_id, fecha_inicio, fecha_fin } = req.query;

  // Si no es admin, solo puede ver sus propias ventas
  const filtroTrabajador = req.session.userRole === 'admin' ? trabajador_id : req.session.userId;

  db.getAllSales({ trabajador_id: filtroTrabajador, fecha_inicio, fecha_fin }, (err, ventas) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(ventas);
  });
});

// Obtener venta por ID con detalles
app.get('/api/ventas/:id', requireAuth, (req, res) => {
  db.getSaleById(req.params.id, (err, venta) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!venta) {
      res.status(404).json({ error: 'Venta no encontrada' });
      return;
    }

    db.getSaleDetails(req.params.id, (err, detalles) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      venta.detalles = detalles;
      res.json(venta);
    });
  });
});

// Crear nueva venta
app.post('/api/ventas', requireAuth, (req, res) => {
  const { trabajador_id, productos } = req.body;

  // Si no es admin, solo puede crear ventas para sí mismo
  const trabajadorFinal = req.session.userRole === 'admin' ? trabajador_id : req.session.userId;

  if (!trabajadorFinal || !productos || productos.length === 0) {
    res.status(400).json({ error: 'Trabajador y productos son requeridos' });
    return;
  }

  db.createSale({ trabajador_id: trabajadorFinal, productos }, (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(201).json(result);
  });
});

// ==================== RUTAS DE REPORTES ====================

// Resumen de ventas por trabajador
app.get('/api/reportes/ventas-por-trabajador', requireAdmin, (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;

  db.getSalesByWorker({ fecha_inicio, fecha_fin }, (err, reporte) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(reporte);
  });
});

// Productos más vendidos
app.get('/api/reportes/productos-mas-vendidos', requireAuth, (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;

  db.getTopProducts({ fecha_inicio, fecha_fin }, (err, productos) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(productos);
  });
});

// Resumen general
app.get('/api/reportes/resumen', requireAuth, (req, res) => {
  const userId = req.session.userRole === 'admin' ? null : req.session.userId;

  db.getDashboardSummary(userId, (err, resumen) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(resumen);
  });
});

// ==================== SERVIDOR ====================

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📦 Sistema de Gestión de Inventario - Obleas y Botanas`);
});
