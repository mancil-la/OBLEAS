const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventario.db');
const db = new sqlite3.Database(dbPath);

const productos = [
    // Precio $30.00
    { nombre: 'Obleas', categoria: 'Obleas', precio: 30.00, stock: 50 },
    { nombre: 'Semillas Cristalizadas', categoria: 'Semillas', precio: 30.00, stock: 30 },
    { nombre: 'Semillas Horneadas', categoria: 'Semillas', precio: 30.00, stock: 30 },
    { nombre: 'Ciruelas con Nuez', categoria: 'Frutos Secos', precio: 30.00, stock: 25 },
    { nombre: 'Galletas de Amaranto', categoria: 'Galletas', precio: 30.00, stock: 40 },
    { nombre: 'Doraditas de Nata', categoria: 'Galletas', precio: 30.00, stock: 35 },
    { nombre: 'Verdura Deshidratada', categoria: 'Verduras', precio: 30.00, stock: 20 },

    // Precio $20.00 - Gomitas
    { nombre: 'Gomitas de Guayaba', categoria: 'Gomitas', precio: 20.00, stock: 50 },
    { nombre: 'Gomitas de Maracuyá', categoria: 'Gomitas', precio: 20.00, stock: 50 },
    { nombre: 'Gomitas de Lichi', categoria: 'Gomitas', precio: 20.00, stock: 45 },
    { nombre: 'Gomitas de Guanábana', categoria: 'Gomitas', precio: 20.00, stock: 45 },
    { nombre: 'Gomitas de Mango', categoria: 'Gomitas', precio: 20.00, stock: 50 },

    // Dulces
    { nombre: 'Bombón con Nuez', categoria: 'Dulces', precio: 20.00, stock: 40 },
    { nombre: 'Pasas con Chocolate', categoria: 'Dulces', precio: 20.00, stock: 35 },
    { nombre: 'Huesitos de Chocolate', categoria: 'Dulces', precio: 20.00, stock: 40 },

    // Alegrías
    { nombre: 'Alegrías de Miel', categoria: 'Alegrías', precio: 20.00, stock: 45 },
    { nombre: 'Alegrías de Chocolate', categoria: 'Alegrías', precio: 20.00, stock: 45 },
    { nombre: 'Alegrías Choco Menta', categoria: 'Alegrías', precio: 20.00, stock: 40 },

    // Botanas
    { nombre: 'Choco Hojuela', categoria: 'Botanas', precio: 20.00, stock: 35 },
    { nombre: 'Enjambres', categoria: 'Botanas', precio: 20.00, stock: 30 },
    { nombre: 'Muéganos', categoria: 'Botanas', precio: 20.00, stock: 30 },

    // Churros
    { nombre: 'Churros de Sal', categoria: 'Churros', precio: 20.00, stock: 40 },
    { nombre: 'Churros de Chipotle', categoria: 'Churros', precio: 20.00, stock: 40 },
    { nombre: 'Churros de Tajín', categoria: 'Churros', precio: 20.00, stock: 40 },

    // Cacahuates
    { nombre: 'Hot Nuts', categoria: 'Cacahuates', precio: 20.00, stock: 50 },
    { nombre: 'Cacahuates Queso', categoria: 'Cacahuates', precio: 20.00, stock: 50 },
    { nombre: 'Cacahuates Español con Ajo', categoria: 'Cacahuates', precio: 20.00, stock: 45 },
    { nombre: 'Abas', categoria: 'Cacahuates', precio: 20.00, stock: 40 },
    { nombre: 'Botanero', categoria: 'Cacahuates', precio: 20.00, stock: 50 },
    { nombre: 'Papatinas', categoria: 'Cacahuates', precio: 20.00, stock: 45 }
];

console.log('🚀 Iniciando inserción de productos...');

db.serialize(() => {
    // Primero limpiamos productos demo (opcional)
    db.run('DELETE FROM productos WHERE nombre LIKE "%Vainilla%" OR nombre LIKE "%Clásicas%" OR nombre LIKE "%Palomitas%"', (err) => {
        if (err) console.error('Error limpiando productos demo:', err);
        else console.log('✅ Productos demo eliminados');
    });

    const stmt = db.prepare('INSERT OR IGNORE INTO productos (nombre, categoria, precio, stock) VALUES (?, ?, ?, ?)');

    let count = 0;
    productos.forEach(p => {
        stmt.run(p.nombre, p.categoria, p.precio, p.stock, (err) => {
            if (!err) {
                count++;
                console.log(`✓ ${p.nombre} - $${p.precio}`);
            }
        });
    });

    stmt.finalize(() => {
        console.log(`\n✅ ${count} productos insertados exitosamente`);
        console.log('🎉 Base de datos actualizada');

        // Mostrar resumen
        db.all('SELECT categoria, COUNT(*) as total, precio FROM productos GROUP BY categoria, precio ORDER BY precio DESC', (err, rows) => {
            if (!err) {
                console.log('\n📊 Resumen por categoría:');
                rows.forEach(r => {
                    console.log(`   ${r.categoria}: ${r.total} productos ($${r.precio})`);
                });
            }
            db.close();
        });
    });
});
