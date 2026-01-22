const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../database/inventario.db');
const db = new sqlite3.Database(dbPath);

const defaultPassword = bcrypt.hashSync('123456', 10);

const trabajadores = [
    { nombre: 'Garifa', usuario: 'garifa', rol: 'trabajador' },
    { nombre: 'Fabiola', usuario: 'fabiola', rol: 'trabajador' },
    { nombre: 'Brenda', usuario: 'brenda', rol: 'trabajador' }
];

console.log('👷 Actualizando trabajadores...');

db.serialize(() => {
    const stmt = db.prepare('INSERT OR IGNORE INTO trabajadores (nombre, usuario, password, rol, telefono, activo) VALUES (?, ?, ?, ?, ?, ?)');

    trabajadores.forEach(t => {
        stmt.run(t.nombre, t.usuario, defaultPassword, t.rol, '', 1, (err) => {
            if (err) console.error(`Error creando ${t.nombre}:`, err.message);
            else console.log(`✓ Trabajador creado/verificado: ${t.nombre} (Usuario: ${t.usuario})`);
        });
    });

    stmt.finalize(() => {
        console.log('✅ Proceso de trabajadores completado');
        db.close();
    });
});
