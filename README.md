# Sistema de Gestión de Inventario - Obleas y Botanas

Sistema web para gestionar inventario, ventas y distribución de obleas y botanas entre 3 trabajadores/puntos de venta.

## Características

- 📦 Gestión de inventario de productos
- 👥 Control de 3 trabajadores/distribuidores
- 💰 Registro de ventas
- 🧾 Impresión de tickets de venta
- 📊 Reportes y estadísticas
- 📱 Interfaz web responsive

## Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Iniciar el servidor:
```bash
npm start
```

3. Para desarrollo con auto-reload:
```bash
npm run dev
```

4. Abrir en navegador: `http://localhost:3000`

## Estructura del Proyecto

- `/backend` - Servidor Node.js y API REST
- `/frontend` - Interfaz web (HTML, CSS, JS)
- `/database` - Base de datos SQLite

## Uso

### Trabajadores
El sistema gestiona 3 trabajadores predefinidos:
- Trabajador 1
- Trabajador 2
- Trabajador 3

### Funcionalidades
1. **Inventario**: Agregar, editar y consultar productos
2. **Ventas**: Registrar ventas por trabajador
3. **Tickets**: Imprimir recibo automático al completar venta
4. **Reportes**: Ver ventas por trabajador y periodo
