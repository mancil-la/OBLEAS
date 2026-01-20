const express = require('express');
const serverless = require('serverless-http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en variables de entorno');
}
if (!JWT_SECRET) {
  console.warn('⚠️ Falta JWT_SECRET en variables de entorno');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '', {
  auth: { persistSession: false }
});

function httpError(res, status, message) {
  return res.status(status).json({ error: message });
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      nombre: user.nombre,
      rol: user.rol
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) return httpError(res, 401, 'No autenticado');

    const payload = jwt.verify(token, JWT_SECRET);
    const userId = payload.sub;

    const { data: user, error } = await supabase
      .from('trabajadores')
      .select('id, nombre, rol, activo')
      .eq('id', userId)
      .maybeSingle();

    if (error) return httpError(res, 500, error.message);
    if (!user || user.activo !== true) return httpError(res, 401, 'Usuario inactivo o no existe');

    req.user = { id: user.id, nombre: user.nombre, rol: user.rol };
    next();
  } catch (e) {
    return httpError(res, 401, 'Token inválido o expirado');
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.rol !== 'admin') {
    return httpError(res, 403, 'Acceso denegado. Solo administradores');
  }
  next();
}

// ==================== AUTH ====================

app.post('/auth/login', async (req, res) => {
  const { usuario, password } = req.body || {};
  if (!usuario || !password) return httpError(res, 400, 'Usuario y contraseña requeridos');

  const { data: user, error } = await supabase
    .from('trabajadores')
    .select('id, nombre, usuario, password, rol, activo')
    .eq('usuario', usuario)
    .maybeSingle();

  if (error) return httpError(res, 500, error.message);
  if (!user || user.activo !== true) return httpError(res, 401, 'Usuario o contraseña incorrectos');

  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) return httpError(res, 401, 'Usuario o contraseña incorrectos');

  const token = signToken(user);
  return res.json({
    token,
    user: { id: user.id, nombre: user.nombre, rol: user.rol }
  });
});

app.get('/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});

app.post('/auth/logout', (req, res) => {
  // En JWT, el logout es del lado del cliente (borrar token)
  res.json({ message: 'Sesión cerrada' });
});

// ==================== PRODUCTOS ====================

app.get('/productos', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('productos').select('*').order('nombre');
  if (error) return httpError(res, 500, error.message);
  res.json(data || []);
});

app.get('/productos/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) return httpError(res, 500, error.message);
  if (!data) return httpError(res, 404, 'Producto no encontrado');
  res.json(data);
});

app.post('/productos', requireAuth, requireAdmin, async (req, res) => {
  const { nombre, categoria, precio, stock } = req.body || {};
  if (!nombre || precio === undefined || precio === null) return httpError(res, 400, 'Nombre y precio son requeridos');

  const { data, error } = await supabase
    .from('productos')
    .insert([{ nombre, categoria: categoria || 'General', precio, stock: stock || 0 }])
    .select('id')
    .single();

  if (error) return httpError(res, 500, error.message);
  res.status(201).json({ id: data.id, message: 'Producto creado exitosamente' });
});

app.put('/productos/:id', requireAuth, requireAdmin, async (req, res) => {
  const { nombre, categoria, precio, stock } = req.body || {};

  const payload = {};
  if (nombre !== undefined) payload.nombre = nombre;
  if (categoria !== undefined) payload.categoria = categoria;
  if (precio !== undefined) payload.precio = precio;
  if (stock !== undefined) payload.stock = stock;

  const { error } = await supabase.from('productos').update(payload).eq('id', req.params.id);
  if (error) return httpError(res, 500, error.message);

  res.json({ message: 'Producto actualizado exitosamente' });
});

app.delete('/productos/:id', requireAuth, requireAdmin, async (req, res) => {
  const { error } = await supabase.from('productos').delete().eq('id', req.params.id);
  if (error) return httpError(res, 500, error.message);

  res.json({ message: 'Producto eliminado exitosamente' });
});

app.post('/productos/:id/ajustar-stock', requireAuth, requireAdmin, async (req, res) => {
  const deltaNum = Number((req.body || {}).delta);
  if (!Number.isFinite(deltaNum) || deltaNum === 0) return httpError(res, 400, 'Delta inválido');

  const { data, error } = await supabase.rpc('adjust_stock', {
    producto_id: Number(req.params.id),
    delta: Math.trunc(deltaNum)
  });

  if (error) return httpError(res, 400, error.message);
  res.json({ message: 'Stock actualizado', stock: data });
});

// ==================== TRABAJADORES ====================

app.get('/trabajadores', requireAuth, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('trabajadores')
    .select('id, nombre, usuario, rol, telefono, activo, fecha_creacion')
    .order('nombre');

  if (error) return httpError(res, 500, error.message);
  res.json(data || []);
});

app.get('/trabajadores/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (req.user.rol !== 'admin' && req.user.id !== id) {
    return httpError(res, 403, 'Acceso denegado');
  }

  const { data, error } = await supabase
    .from('trabajadores')
    .select('id, nombre, usuario, rol, telefono, activo, fecha_creacion')
    .eq('id', id)
    .maybeSingle();

  if (error) return httpError(res, 500, error.message);
  if (!data) return httpError(res, 404, 'Trabajador no encontrado');
  res.json(data);
});

app.post('/trabajadores', requireAuth, requireAdmin, async (req, res) => {
  const { nombre, usuario, password, rol, telefono, activo } = req.body || {};
  if (!nombre || !usuario || !password) return httpError(res, 400, 'Nombre, usuario y contraseña son requeridos');

  const hashed = bcrypt.hashSync(password, 10);

  const { data, error } = await supabase
    .from('trabajadores')
    .insert([
      {
        nombre,
        usuario,
        password: hashed,
        rol: rol || 'trabajador',
        telefono: telefono || '',
        activo: activo === 0 ? false : Boolean(activo ?? true)
      }
    ])
    .select('id')
    .single();

  if (error) {
    if ((error.message || '').toLowerCase().includes('duplicate') || (error.message || '').toLowerCase().includes('unique')) {
      return httpError(res, 400, 'El usuario ya existe');
    }
    return httpError(res, 500, error.message);
  }

  res.status(201).json({ id: data.id, message: 'Trabajador creado exitosamente' });
});

app.put('/trabajadores/:id', requireAuth, requireAdmin, async (req, res) => {
  const { nombre, usuario, password, rol, telefono, activo } = req.body || {};

  const payload = {};
  if (nombre !== undefined) payload.nombre = nombre;
  if (usuario !== undefined) payload.usuario = usuario;
  if (rol !== undefined) payload.rol = rol;
  if (telefono !== undefined) payload.telefono = telefono;
  if (activo !== undefined) payload.activo = activo === 1 || activo === true;
  if (password) payload.password = bcrypt.hashSync(password, 10);

  const { error } = await supabase.from('trabajadores').update(payload).eq('id', Number(req.params.id));
  if (error) {
    if ((error.message || '').toLowerCase().includes('duplicate') || (error.message || '').toLowerCase().includes('unique')) {
      return httpError(res, 400, 'El usuario ya existe');
    }
    return httpError(res, 500, error.message);
  }

  res.json({ message: 'Trabajador actualizado exitosamente' });
});

app.delete('/trabajadores/:id', requireAuth, requireAdmin, async (req, res) => {
  const { error } = await supabase
    .from('trabajadores')
    .update({ activo: false })
    .eq('id', Number(req.params.id));

  if (error) return httpError(res, 500, error.message);
  res.json({ message: 'Trabajador desactivado exitosamente' });
});

// ==================== VENTAS ====================

app.get('/ventas', requireAuth, async (req, res) => {
  const { trabajador_id, fecha_inicio, fecha_fin } = req.query || {};

  const filtroTrabajador = req.user.rol === 'admin' ? trabajador_id : req.user.id;

  let query = supabase
    .from('ventas')
    .select('id, trabajador_id, total, fecha, trabajadores(nombre)')
    .order('fecha', { ascending: false });

  if (filtroTrabajador) query = query.eq('trabajador_id', Number(filtroTrabajador));
  if (fecha_inicio) query = query.gte('fecha', `${fecha_inicio}T00:00:00.000Z`);
  if (fecha_fin) query = query.lte('fecha', `${fecha_fin}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) return httpError(res, 500, error.message);

  const mapped = (data || []).map((v) => ({
    id: v.id,
    trabajador_id: v.trabajador_id,
    trabajador_nombre: (v.trabajadores && v.trabajadores.nombre) ? v.trabajadores.nombre : '',
    total: v.total,
    fecha: v.fecha
  }));

  res.json(mapped);
});

app.get('/ventas/:id', requireAuth, async (req, res) => {
  const ventaId = Number(req.params.id);

  const { data: venta, error: ventaErr } = await supabase
    .from('ventas')
    .select('id, trabajador_id, total, fecha, trabajadores(nombre)')
    .eq('id', ventaId)
    .maybeSingle();

  if (ventaErr) return httpError(res, 500, ventaErr.message);
  if (!venta) return httpError(res, 404, 'Venta no encontrada');

  if (req.user.rol !== 'admin' && req.user.id !== venta.trabajador_id) {
    return httpError(res, 403, 'Acceso denegado');
  }

  const { data: detalles, error: detErr } = await supabase
    .from('detalle_ventas')
    .select('id, venta_id, producto_id, cantidad, precio_unitario, subtotal, productos(nombre)')
    .eq('venta_id', ventaId)
    .order('id', { ascending: true });

  if (detErr) return httpError(res, 500, detErr.message);

  const mappedDetalles = (detalles || []).map((d) => ({
    id: d.id,
    venta_id: d.venta_id,
    producto_id: d.producto_id,
    cantidad: d.cantidad,
    precio_unitario: d.precio_unitario,
    subtotal: d.subtotal,
    producto_nombre: (d.productos && d.productos.nombre) ? d.productos.nombre : ''
  }));

  res.json({
    id: venta.id,
    trabajador_id: venta.trabajador_id,
    trabajador_nombre: (venta.trabajadores && venta.trabajadores.nombre) ? venta.trabajadores.nombre : '',
    total: venta.total,
    fecha: venta.fecha,
    detalles: mappedDetalles
  });
});

app.post('/ventas', requireAuth, async (req, res) => {
  const { trabajador_id, productos } = req.body || {};
  const trabajadorFinal = req.user.rol === 'admin' ? trabajador_id : req.user.id;

  if (!trabajadorFinal || !Array.isArray(productos) || productos.length === 0) {
    return httpError(res, 400, 'Trabajador y productos son requeridos');
  }

  const { data, error } = await supabase.rpc('create_sale', {
    trabajador_id: Number(trabajadorFinal),
    productos: productos
  });

  if (error) return httpError(res, 400, error.message);

  res.status(201).json(data);
});

// ==================== REPORTES ====================

app.get('/reportes/ventas-por-trabajador', requireAuth, requireAdmin, async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query || {};

  const { data, error } = await supabase.rpc('sales_by_worker', {
    fecha_inicio: fecha_inicio || null,
    fecha_fin: fecha_fin || null
  });

  if (error) return httpError(res, 500, error.message);
  res.json(data || []);
});

app.get('/reportes/productos-mas-vendidos', requireAuth, async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query || {};

  const { data, error } = await supabase.rpc('top_products', {
    fecha_inicio: fecha_inicio || null,
    fecha_fin: fecha_fin || null
  });

  if (error) return httpError(res, 500, error.message);
  res.json(data || []);
});

app.get('/reportes/resumen', requireAuth, async (req, res) => {
  const userId = req.user.rol === 'admin' ? null : req.user.id;

  const { data, error } = await supabase.rpc('dashboard_summary', {
    user_id: userId
  });

  if (error) return httpError(res, 500, error.message);
  res.json(data || {});
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

module.exports.handler = serverless(app, {
  basePath: '/.netlify/functions/api'
});
