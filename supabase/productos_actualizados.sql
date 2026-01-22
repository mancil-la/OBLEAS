-- =====================================================
-- ACTUALIZACIÓN DE PRODUCTOS - OBLEAS Y BOTANAS
-- =====================================================
-- Ejecuta este archivo en Supabase SQL Editor
-- Esto insertará todos los productos nuevos

-- Primero, puedes limpiar productos existentes si lo deseas (DESCOMENTAR SOLO SI QUIERES EMPEZAR DE CERO)
-- TRUNCATE TABLE public.productos RESTART IDENTITY CASCADE;

-- =====================================================
-- PRODUCTOS DE $30.00
-- =====================================================

-- Categoría: Obleas
INSERT INTO public.productos (nombre, categoria, precio, stock) VALUES
('Obleas', 'Obleas', 30.00, 50);

-- Categoría: Semillas
INSERT INTO public.productos (nombre, categoria, precio, stock) VALUES
('Semillas Cristalizadas', 'Semillas', 30.00, 30),
('Semillas Horneadas', 'Semillas', 30.00, 30);

-- Categoría: Frutos Secos
INSERT INTO public.productos (nombre, categoria, precio, stock) VALUES
('Ciruelas con Nuez', 'Frutos Secos', 30.00, 25);

-- Categoría: Galletas
INSERT INTO public.productos (nombre, categoria, precio, stock) VALUES
('Galletas de Amaranto', 'Galletas', 30.00, 40),
('Doraditas de Nata', 'Galletas', 30.00, 35);

-- Categoría: Verduras
INSERT INTO public.productos (nombre, categoria, precio, stock) VALUES
('Verdura Deshidratada', 'Verduras', 30.00, 20);

-- =====================================================
-- PRODUCTOS DE $20.00
-- =====================================================

-- Categoría: Gomitas
INSERT INTO public.productos (nombre, categoria, precio, stock) VALUES
('Gomitas de Guayaba', 'Gomitas', 20.00, 50),
('Gomitas de Maracuyá', 'Gomitas', 20.00, 50),
('Gomitas de Lichi', 'Gomitas', 20.00, 45),
('Gomitas de Guanábana', 'Gomitas', 20.00, 45),
('Gomitas de Mango', 'Gomitas', 20.00, 50);

-- Categoría: Dulces
INSERT INTO public.productos (nombre, categoria, precio, stock) VALUES
('Bombón con Nuez', 'Dulces', 20.00, 40),
('Pasas con Chocolate', 'Dulces', 20.00, 35),
('Huesitos de Chocolate', 'Dulces', 20.00, 40);

-- Categoría: Alegrías
INSERT INTO public.productos (nombre, categoria, precio, stock) VALUES
('Alegrías de Miel', 'Alegrías', 20.00, 45),
('Alegrías de Chocolate', 'Alegrías', 20.00, 45),
('Alegrías Choco Menta', 'Alegrías', 20.00, 40);

-- Categoría: Botanas Especiales
INSERT INTO public.productos (nombre, categoria, precio, stock) VALUES
('Choco Hojuela', 'Botanas', 20.00, 35),
('Enjambres', 'Botanas', 20.00, 30),
('Muéganos', 'Botanas', 20.00, 30);

-- Categoría: Churros
INSERT INTO public.productos (nombre, categoria, precio, stock) VALUES
('Churros de Sal', 'Churros', 20.00, 40),
('Churros de Chipotle', 'Churros', 20.00, 40),
('Churros de Tajín', 'Churros', 20.00, 40);

-- Categoría: Cacahuates
INSERT INTO public.productos (nombre, categoria, precio, stock) VALUES
('Hot Nuts', 'Cacahuates', 20.00, 50),
('Cacahuates Queso', 'Cacahuates', 20.00, 50),
('Cacahuates Español con Ajo', 'Cacahuates', 20.00, 45),
('Abas', 'Cacahuates', 20.00, 40),
('Botanero', 'Cacahuates', 20.00, 50),
('Papatinas', 'Cacahuates', 20.00, 45);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Consulta para verificar los productos insertados
SELECT 
    categoria,
    COUNT(*) as total_productos,
    precio,
    SUM(stock) as stock_total
FROM public.productos
GROUP BY categoria, precio
ORDER BY precio DESC, categoria;

-- Ver todos los productos ordenados por categoría
SELECT id, nombre, categoria, precio, stock 
FROM public.productos 
ORDER BY categoria, nombre;
