-- Datos de ejemplo (opcional)
-- NOTA: Las contraseñas deben estar hasheadas con bcrypt.
-- Para no complicar, el backend incluye un endpoint de "bootstrap"? (no recomendado).
-- Recomendación: crea los usuarios desde la UI admin una vez desplegado.

insert into public.productos (nombre, categoria, precio, stock)
values
  ('Obleas Vainilla', 'Obleas', 10.00, 100),
  ('Obleas Chocolate', 'Obleas', 10.00, 100),
  ('Obleas Fresa', 'Obleas', 10.00, 100),
  ('Papitas Clásicas', 'Botanas', 15.00, 50),
  ('Papitas Picantes', 'Botanas', 15.00, 50),
  ('Chicharrones', 'Botanas', 20.00, 30),
  ('Palomitas', 'Botanas', 12.00, 40)
on conflict do nothing;

-- Usuarios por defecto
-- password: 123456
-- hash generado con bcrypt (cost 10)
insert into public.trabajadores (nombre, usuario, password, rol, telefono, activo)
values
  ('Administrador', 'admin', '$2b$10$hxMEy6K3exM9hrixc7vVL.rDO/SL0eMTdsOyJ2MM1RS8Ru9g860vK', 'admin', '', true),
  ('Trabajador 1', 'trabajador1', '$2b$10$hxMEy6K3exM9hrixc7vVL.rDO/SL0eMTdsOyJ2MM1RS8Ru9g860vK', 'trabajador', '', true),
  ('Trabajador 2', 'trabajador2', '$2b$10$hxMEy6K3exM9hrixc7vVL.rDO/SL0eMTdsOyJ2MM1RS8Ru9g860vK', 'trabajador', '', true),
  ('Trabajador 3', 'trabajador3', '$2b$10$hxMEy6K3exM9hrixc7vVL.rDO/SL0eMTdsOyJ2MM1RS8Ru9g860vK', 'trabajador', '', true)
on conflict (usuario) do nothing;
