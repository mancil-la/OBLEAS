const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../database/inventario.db');
const db = new sqlite3.Database(dbPath);

// Inicializar base de datos
function initDatabase() {
  db.serialize(() => {
    // Tabla de productos
    db.run(`
      CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        categoria TEXT DEFAULT 'General',
        precio REAL NOT NULL,
        stock INTEGER DEFAULT 0,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de trabajadores
    db.run(`
      CREATE TABLE IF NOT EXISTS trabajadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        usuario TEXT UNIQUE,
        password TEXT,
        rol TEXT DEFAULT 'trabajador',
        telefono TEXT,
        activo INTEGER DEFAULT 1,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de ventas
    db.run(`
      CREATE TABLE IF NOT EXISTS ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trabajador_id INTEGER NOT NULL,
        total REAL NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id)
      )
    `);

    // Tabla de detalle de ventas
    db.run(`
      CREATE TABLE IF NOT EXISTS detalle_ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        cantidad INTEGER NOT NULL,
        precio_unitario REAL NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (venta_id) REFERENCES ventas(id),
        FOREIGN KEY (producto_id) REFERENCES productos(id)
      )
    `);

    // Insertar trabajadores iniciales si no existen
    db.get('SELECT COUNT(*) as count FROM trabajadores', (err, row) => {
      if (!err && row.count === 0) {
        const defaultPassword = bcrypt.hashSync('123456', 10);
        const stmt = db.prepare('INSERT INTO trabajadores (nombre, usuario, password, rol, telefono, activo) VALUES (?, ?, ?, ?, ?, ?)');

        // Admin
        stmt.run('Administrador', 'admin', defaultPassword, 'admin', '', 1);

        // Trabajadores
        stmt.run('Trabajador 1', 'trabajador1', defaultPassword, 'trabajador', '', 1);
        stmt.run('Trabajador 2', 'trabajador2', defaultPassword, 'trabajador', '', 1);
        stmt.run('Trabajador 3', 'trabajador3', defaultPassword, 'trabajador', '', 1);

        stmt.finalize();
        console.log('✅ Trabajadores iniciales creados');
        console.log('📝 Usuarios por defecto:');
        console.log('   Admin: usuario=admin, password=123456');
        console.log('   Trabajadores: usuario=trabajador1/2/3, password=123456');
      }
    });

    // Insertar productos reales si no existen
    db.get('SELECT COUNT(*) as count FROM productos', (err, row) => {
      if (!err && row.count === 0) {
        const stmt = db.prepare('INSERT INTO productos (nombre, categoria, precio, stock) VALUES (?, ?, ?, ?)');

        // Productos de $30.00
        stmt.run('Obleas', 'Obleas', 30.00, 50);
        stmt.run('Semillas Cristalizadas', 'Semillas', 30.00, 30);
        stmt.run('Semillas Horneadas', 'Semillas', 30.00, 30);
        stmt.run('Ciruelas con Nuez', 'Frutos Secos', 30.00, 25);
        stmt.run('Galletas de Amaranto', 'Galletas', 30.00, 40);
        stmt.run('Doraditas de Nata', 'Galletas', 30.00, 35);
        stmt.run('Verdura Deshidratada', 'Verduras', 30.00, 20);

        // Gomitas $20.00
        stmt.run('Gomitas de Guayaba', 'Gomitas', 20.00, 50);
        stmt.run('Gomitas de Maracuyá', 'Gomitas', 20.00, 50);
        stmt.run('Gomitas de Lichi', 'Gomitas', 20.00, 45);
        stmt.run('Gomitas de Guanábana', 'Gomitas', 20.00, 45);
        stmt.run('Gomitas de Mango', 'Gomitas', 20.00, 50);

        // Dulces $20.00
        stmt.run('Bombón con Nuez', 'Dulces', 20.00, 40);
        stmt.run('Pasas con Chocolate', 'Dulces', 20.00, 35);
        stmt.run('Huesitos de Chocolate', 'Dulces', 20.00, 40);

        // Alegrías $20.00
        stmt.run('Alegrías de Miel', 'Alegrías', 20.00, 45);
        stmt.run('Alegrías de Chocolate', 'Alegrías', 20.00, 45);
        stmt.run('Alegrías Choco Menta', 'Alegrías', 20.00, 40);

        // Botanas $20.00
        stmt.run('Choco Hojuela', 'Botanas', 20.00, 35);
        stmt.run('Enjambres', 'Botanas', 20.00, 30);
        stmt.run('Muéganos', 'Botanas', 20.00, 30);

        // Churros $20.00
        stmt.run('Churros de Sal', 'Churros', 20.00, 40);
        stmt.run('Churros de Chipotle', 'Churros', 20.00, 40);
        stmt.run('Churros de Tajín', 'Churros', 20.00, 40);

        // Cacahuates $20.00
        stmt.run('Hot Nuts', 'Cacahuates', 20.00, 50);
        stmt.run('Cacahuates Queso', 'Cacahuates', 20.00, 50);
        stmt.run('Cacahuates Español con Ajo', 'Cacahuates', 20.00, 45);
        stmt.run('Abas', 'Cacahuates', 20.00, 40);
        stmt.run('Botanero', 'Cacahuates', 20.00, 50);
        stmt.run('Papatinas', 'Cacahuates', 20.00, 45);

        stmt.finalize();
        console.log('✅ Productos del catálogo creados (37 productos)');
      }
    });

    console.log('✅ Base de datos inicializada');
  });
}

// ==================== FUNCIONES DE PRODUCTOS ====================

function getAllProducts(callback) {
  db.all('SELECT * FROM productos ORDER BY nombre', callback);
}

function getProductById(id, callback) {
  db.get('SELECT * FROM productos WHERE id = ?', [id], callback);
}

function createProduct(producto, callback) {
  const { nombre, categoria, precio, stock } = producto;
  db.run(
    'INSERT INTO productos (nombre, categoria, precio, stock) VALUES (?, ?, ?, ?)',
    [nombre, categoria || 'General', precio, stock || 0],
    function (err) {
      callback(err, this.lastID);
    }
  );
}

function updateProduct(id, producto, callback) {
  const { nombre, categoria, precio, stock } = producto;
  db.run(
    `UPDATE productos SET 
      nombre = COALESCE(?, nombre),
      categoria = COALESCE(?, categoria),
      precio = COALESCE(?, precio),
      stock = COALESCE(?, stock),
      fecha_actualizacion = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [nombre, categoria, precio, stock, id],
    callback
  );
}

function deleteProduct(id, callback) {
  db.run('DELETE FROM productos WHERE id = ?', [id], callback);
}

function updateStock(productoId, cantidad, callback) {
  db.run(
    'UPDATE productos SET stock = stock - ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?',
    [cantidad, productoId],
    callback
  );
}

function adjustStock(productoId, delta, callback) {
  const deltaNum = Number(delta);
  if (Number.isNaN(deltaNum) || !Number.isFinite(deltaNum)) {
    callback(new Error('Delta inválido'));
    return;
  }

  db.get('SELECT stock FROM productos WHERE id = ?', [productoId], (err, row) => {
    if (err) return callback(err);
    if (!row) return callback(new Error('Producto no encontrado'));

    const currentStock = Number(row.stock || 0);
    const newStock = currentStock + deltaNum;

    if (newStock < 0) {
      return callback(new Error('Stock insuficiente para realizar el ajuste'));
    }

    db.run(
      'UPDATE productos SET stock = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?',
      [newStock, productoId],
      (err2) => callback(err2, newStock)
    );
  });
}

// ==================== FUNCIONES DE TRABAJADORES ====================

function loginUser(usuario, password, callback) {
  db.get(
    'SELECT * FROM trabajadores WHERE usuario = ? AND activo = 1',
    [usuario],
    (err, user) => {
      if (err) return callback(err);
      if (!user) return callback(null, null);

      // Verificar contraseña
      const isValid = bcrypt.compareSync(password, user.password);
      if (!isValid) return callback(null, null);

      callback(null, user);
    }
  );
}

function getAllWorkers(callback) {
  db.all(
    'SELECT id, nombre, usuario, rol, telefono, activo, fecha_creacion FROM trabajadores ORDER BY nombre',
    callback
  );
}

function getWorkerById(id, callback) {
  db.get(
    'SELECT id, nombre, usuario, rol, telefono, activo, fecha_creacion FROM trabajadores WHERE id = ?',
    [id],
    callback
  );
}

function getWorkerSessionInfo(id, callback) {
  db.get(
    'SELECT id, nombre, rol, activo FROM trabajadores WHERE id = ?',
    [id],
    callback
  );
}

function createWorker(trabajador, callback) {
  const { nombre, usuario, password, rol, telefono, activo } = trabajador;

  if (!nombre || !usuario || !password) {
    callback(new Error('Nombre, usuario y contraseña son requeridos'));
    return;
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO trabajadores (nombre, usuario, password, rol, telefono, activo) VALUES (?, ?, ?, ?, ?, ?)',
    [
      nombre,
      usuario,
      hashedPassword,
      rol || 'trabajador',
      telefono || '',
      typeof activo === 'number' ? activo : 1
    ],
    function (err) {
      callback(err, this.lastID);
    }
  );
}

function deactivateWorker(id, callback) {
  db.run('UPDATE trabajadores SET activo = 0 WHERE id = ?', [id], callback);
}

function updateWorker(id, trabajador, callback) {
  const { nombre, usuario, password, telefono, activo } = trabajador;

  // Si hay nueva contraseña, encriptarla
  const hashedPassword = password ? bcrypt.hashSync(password, 10) : undefined;

  db.run(
    `UPDATE trabajadores SET 
      nombre = COALESCE(?, nombre),
      usuario = COALESCE(?, usuario),
      password = COALESCE(?, password),
      telefono = COALESCE(?, telefono),
      activo = COALESCE(?, activo)
    WHERE id = ?`,
    [nombre, usuario, hashedPassword, telefono, activo, id],
    callback
  );
}

// ==================== FUNCIONES DE VENTAS ====================

function getAllSales(filters, callback) {
  let query = `
    SELECT v.*, t.nombre as trabajador_nombre
    FROM ventas v
    JOIN trabajadores t ON v.trabajador_id = t.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.trabajador_id) {
    query += ' AND v.trabajador_id = ?';
    params.push(filters.trabajador_id);
  }

  if (filters.fecha_inicio) {
    query += ' AND DATE(v.fecha) >= DATE(?)';
    params.push(filters.fecha_inicio);
  }

  if (filters.fecha_fin) {
    query += ' AND DATE(v.fecha) <= DATE(?)';
    params.push(filters.fecha_fin);
  }

  query += ' ORDER BY v.fecha DESC';

  db.all(query, params, callback);
}

function getSaleById(id, callback) {
  db.get(
    `SELECT v.*, t.nombre as trabajador_nombre
     FROM ventas v
     JOIN trabajadores t ON v.trabajador_id = t.id
     WHERE v.id = ?`,
    [id],
    callback
  );
}

function getSaleDetails(ventaId, callback) {
  db.all(
    `SELECT dv.*, p.nombre as producto_nombre
     FROM detalle_ventas dv
     JOIN productos p ON dv.producto_id = p.id
     WHERE dv.venta_id = ?`,
    [ventaId],
    callback
  );
}

function createSale(venta, callback) {
  const { trabajador_id, productos } = venta;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Calcular total
    let total = 0;
    productos.forEach(p => {
      total += p.precio * p.cantidad;
    });

    // Insertar venta
    db.run(
      'INSERT INTO ventas (trabajador_id, total) VALUES (?, ?)',
      [trabajador_id, total],
      function (err) {
        if (err) {
          db.run('ROLLBACK');
          callback(err);
          return;
        }

        const ventaId = this.lastID;
        let completed = 0;
        let hasError = false;

        // Insertar detalles y actualizar stock
        productos.forEach(producto => {
          if (hasError) return;

          const subtotal = producto.precio * producto.cantidad;

          db.run(
            'INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
            [ventaId, producto.id, producto.cantidad, producto.precio, subtotal],
            (err) => {
              if (err) {
                hasError = true;
                db.run('ROLLBACK');
                callback(err);
                return;
              }

              // Actualizar stock
              updateStock(producto.id, producto.cantidad, (err) => {
                if (err) {
                  hasError = true;
                  db.run('ROLLBACK');
                  callback(err);
                  return;
                }

                completed++;
                if (completed === productos.length && !hasError) {
                  db.run('COMMIT');
                  callback(null, { id: ventaId, total, message: 'Venta registrada exitosamente' });
                }
              });
            }
          );
        });
      }
    );
  });
}

// ==================== FUNCIONES DE REPORTES ====================

function getSalesByWorker(filters, callback) {
  let query = `
    SELECT 
      t.id,
      t.nombre,
      COUNT(v.id) as total_ventas,
      COALESCE(SUM(v.total), 0) as total_vendido
    FROM trabajadores t
    LEFT JOIN ventas v ON t.id = v.trabajador_id
  `;
  const params = [];

  if (filters.fecha_inicio || filters.fecha_fin) {
    query += ' WHERE 1=1';

    if (filters.fecha_inicio) {
      query += ' AND DATE(v.fecha) >= DATE(?)';
      params.push(filters.fecha_inicio);
    }

    if (filters.fecha_fin) {
      query += ' AND DATE(v.fecha) <= DATE(?)';
      params.push(filters.fecha_fin);
    }
  }

  query += ' GROUP BY t.id, t.nombre ORDER BY total_vendido DESC';

  db.all(query, params, callback);
}

function getTopProducts(filters, callback) {
  let query = `
    SELECT 
      p.id,
      p.nombre,
      p.categoria,
      SUM(dv.cantidad) as cantidad_vendida,
      SUM(dv.subtotal) as total_vendido
    FROM productos p
    JOIN detalle_ventas dv ON p.id = dv.producto_id
    JOIN ventas v ON dv.venta_id = v.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.fecha_inicio) {
    query += ' AND DATE(v.fecha) >= DATE(?)';
    params.push(filters.fecha_inicio);
  }

  if (filters.fecha_fin) {
    query += ' AND DATE(v.fecha) <= DATE(?)';
    params.push(filters.fecha_fin);
  }

  query += ' GROUP BY p.id, p.nombre, p.categoria ORDER BY cantidad_vendida DESC LIMIT 10';

  db.all(query, params, callback);
}

function getDashboardSummary(userId, callback) {
  db.serialize(() => {
    const summary = {};
    const whereClause = userId ? `WHERE trabajador_id = ${userId}` : '';

    db.get('SELECT COUNT(*) as total FROM productos', (err, row) => {
      summary.total_productos = row ? row.total : 0;
    });

    db.get('SELECT COUNT(*) as total FROM trabajadores WHERE activo = 1', (err, row) => {
      summary.trabajadores_activos = row ? row.total : 0;
    });

    db.get(`SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as suma FROM ventas WHERE DATE(fecha) = DATE("now") ${whereClause}`, (err, row) => {
      summary.ventas_hoy = row ? row.total : 0;
      summary.total_hoy = row ? row.suma : 0;
    });

    db.get(`SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as suma FROM ventas ${whereClause}`, (err, row) => {
      summary.ventas_totales = row ? row.total : 0;
      summary.total_general = row ? row.suma : 0;
      callback(null, summary);
    });
  });
}

// ==================== EXPORTAR FUNCIONES ====================

module.exports = {
  initDatabase,
  loginUser,
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  adjustStock,
  getAllWorkers,
  getWorkerById,
  getWorkerSessionInfo,
  createWorker,
  updateWorker,
  deactivateWorker,
  getAllSales,
  getSaleById,
  getSaleDetails,
  createSale,
  getSalesByWorker,
  getTopProducts,
  getDashboardSummary
};
