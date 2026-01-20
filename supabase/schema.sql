-- Ejecuta este archivo en Supabase (SQL Editor) para crear tablas + funciones.

-- ===================== TABLAS =====================

create table if not exists public.productos (
  id bigserial primary key,
  nombre text not null,
  categoria text default 'General',
  precio numeric(12,2) not null,
  stock integer not null default 0,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

create table if not exists public.trabajadores (
  id bigserial primary key,
  nombre text not null,
  usuario text not null unique,
  password text not null,
  rol text not null default 'trabajador',
  telefono text,
  activo boolean not null default true,
  fecha_creacion timestamptz not null default now()
);

create table if not exists public.ventas (
  id bigserial primary key,
  trabajador_id bigint not null references public.trabajadores(id),
  total numeric(12,2) not null,
  fecha timestamptz not null default now()
);

create table if not exists public.detalle_ventas (
  id bigserial primary key,
  venta_id bigint not null references public.ventas(id) on delete cascade,
  producto_id bigint not null references public.productos(id),
  cantidad integer not null,
  precio_unitario numeric(12,2) not null,
  subtotal numeric(12,2) not null
);

create index if not exists idx_ventas_trabajador_fecha on public.ventas(trabajador_id, fecha);
create index if not exists idx_detalle_ventas_venta on public.detalle_ventas(venta_id);
create index if not exists idx_detalle_ventas_producto on public.detalle_ventas(producto_id);

-- Trigger para actualizar fecha_actualizacion
create or replace function public.set_fecha_actualizacion()
returns trigger as $$
begin
  new.fecha_actualizacion := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_productos_fecha_actualizacion on public.productos;
create trigger trg_productos_fecha_actualizacion
before update on public.productos
for each row execute function public.set_fecha_actualizacion();

-- ===================== FUNCIONES =====================

-- Ajuste de stock (delta puede ser positivo o negativo). No permite stock negativo.
create or replace function public.adjust_stock(producto_id bigint, delta integer)
returns integer
language plpgsql
as $$
declare
  current_stock integer;
  new_stock integer;
begin
  select stock into current_stock from public.productos where id = producto_id for update;
  if not found then
    raise exception 'Producto no encontrado';
  end if;

  new_stock := current_stock + delta;
  if new_stock < 0 then
    raise exception 'Stock insuficiente para realizar el ajuste';
  end if;

  update public.productos set stock = new_stock where id = producto_id;
  return new_stock;
end;
$$;

-- Crear venta de forma atómica (inserta venta, detalle, y descuenta stock)
-- productos: JSONB array de objetos {id, precio, cantidad}
create or replace function public.create_sale(trabajador_id bigint, productos jsonb)
returns jsonb
language plpgsql
as $$
declare
  venta_id bigint;
  total numeric(12,2) := 0;
  item jsonb;
  p_id bigint;
  p_precio numeric(12,2);
  p_cantidad integer;
  p_stock integer;
  subtotal numeric(12,2);
begin
  if trabajador_id is null then
    raise exception 'Trabajador requerido';
  end if;

  if productos is null or jsonb_array_length(productos) = 0 then
    raise exception 'Productos requeridos';
  end if;

  -- validar trabajador activo
  if not exists(select 1 from public.trabajadores t where t.id = trabajador_id and t.activo = true) then
    raise exception 'Trabajador inactivo o no existe';
  end if;

  -- calcular total y validar stock
  for item in select * from jsonb_array_elements(productos)
  loop
    p_id := (item->>'id')::bigint;
    p_precio := (item->>'precio')::numeric;
    p_cantidad := (item->>'cantidad')::integer;

    if p_id is null or p_cantidad is null or p_cantidad <= 0 then
      raise exception 'Producto/cantidad inválidos';
    end if;

    select stock into p_stock from public.productos where id = p_id for update;
    if not found then
      raise exception 'Producto no encontrado';
    end if;

    if p_stock < p_cantidad then
      raise exception 'Stock insuficiente';
    end if;

    subtotal := p_precio * p_cantidad;
    total := total + subtotal;
  end loop;

  insert into public.ventas(trabajador_id, total) values (trabajador_id, total) returning id into venta_id;

  -- insertar detalles y descontar stock
  for item in select * from jsonb_array_elements(productos)
  loop
    p_id := (item->>'id')::bigint;
    p_precio := (item->>'precio')::numeric;
    p_cantidad := (item->>'cantidad')::integer;
    subtotal := p_precio * p_cantidad;

    insert into public.detalle_ventas(venta_id, producto_id, cantidad, precio_unitario, subtotal)
    values (venta_id, p_id, p_cantidad, p_precio, subtotal);

    perform public.adjust_stock(p_id, -p_cantidad);
  end loop;

  return jsonb_build_object('id', venta_id, 'total', total, 'message', 'Venta registrada exitosamente');
end;
$$;

-- Reporte: ventas por trabajador (filtrable por fechas)
create or replace function public.sales_by_worker(fecha_inicio date default null, fecha_fin date default null)
returns table(
  id bigint,
  nombre text,
  total_ventas bigint,
  total_vendido numeric(12,2)
)
language sql
as $$
  select
    t.id,
    t.nombre,
    count(v.id) as total_ventas,
    coalesce(sum(v.total), 0)::numeric(12,2) as total_vendido
  from public.trabajadores t
  left join public.ventas v on v.trabajador_id = t.id
    and (fecha_inicio is null or (v.fecha::date) >= fecha_inicio)
    and (fecha_fin is null or (v.fecha::date) <= fecha_fin)
  group by t.id, t.nombre
  order by total_vendido desc;
$$;

-- Reporte: productos más vendidos
create or replace function public.top_products(fecha_inicio date default null, fecha_fin date default null)
returns table(
  id bigint,
  nombre text,
  categoria text,
  cantidad_vendida bigint,
  total_vendido numeric(12,2)
)
language sql
as $$
  select
    p.id,
    p.nombre,
    p.categoria,
    coalesce(sum(dv.cantidad), 0) as cantidad_vendida,
    coalesce(sum(dv.subtotal), 0)::numeric(12,2) as total_vendido
  from public.productos p
  join public.detalle_ventas dv on dv.producto_id = p.id
  join public.ventas v on v.id = dv.venta_id
  where (fecha_inicio is null or (v.fecha::date) >= fecha_inicio)
    and (fecha_fin is null or (v.fecha::date) <= fecha_fin)
  group by p.id, p.nombre, p.categoria
  order by cantidad_vendida desc
  limit 10;
$$;

-- Dashboard summary (admin o por trabajador)
create or replace function public.dashboard_summary(user_id bigint default null)
returns jsonb
language plpgsql
as $$
declare
  total_productos bigint;
  trabajadores_activos bigint;
  ventas_hoy bigint;
  total_hoy numeric(12,2);
  ventas_totales bigint;
  total_general numeric(12,2);
begin
  select count(*) into total_productos from public.productos;
  select count(*) into trabajadores_activos from public.trabajadores where activo = true;

  select count(*), coalesce(sum(total), 0)::numeric(12,2)
    into ventas_hoy, total_hoy
  from public.ventas
  where (fecha::date) = (now()::date)
    and (user_id is null or trabajador_id = user_id);

  select count(*), coalesce(sum(total), 0)::numeric(12,2)
    into ventas_totales, total_general
  from public.ventas
  where (user_id is null or trabajador_id = user_id);

  return jsonb_build_object(
    'total_productos', total_productos,
    'trabajadores_activos', trabajadores_activos,
    'ventas_hoy', ventas_hoy,
    'total_hoy', total_hoy,
    'ventas_totales', ventas_totales,
    'total_general', total_general
  );
end;
$$;
