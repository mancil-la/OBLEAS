# Guía de Instalación en Hostgator

## 📋 Requisitos Previos
- Cuenta de hosting en Hostgator con acceso a Node.js
- Acceso FTP o SSH
- Panel de control cPanel

## 🚀 Pasos para Instalar

### 1. Preparar el Backend (Node.js)

#### Opción A: Si Hostgator tiene Node.js habilitado

1. **Conectar por SSH al servidor**
   ```bash
   ssh usuario@tudominio.com
   ```

2. **Subir el proyecto**
   - Sube la carpeta completa del proyecto vía FTP a tu directorio (ej: `/home/usuario/obleas`)

3. **Instalar dependencias**
   ```bash
   cd /home/usuario/obleas
   npm install
   ```

4. **Configurar variables de entorno**
   Crea un archivo `.env`:
   ```bash
   NODE_ENV=production
   PORT=3000
   ```

5. **Iniciar el servidor con PM2 (recomendado)**
   ```bash
   npm install -g pm2
   pm2 start backend/server.js --name "obleas-api"
   pm2 save
   pm2 startup
   ```

#### Opción B: Si Hostgator NO tiene Node.js (Solo Frontend + Subir Backend a otro servicio)

Si Hostgator solo soporta PHP/HTML, necesitarás:
1. Subir solo la carpeta `frontend` a Hostgator
2. Hospedar el backend en un servicio como:
   - **Heroku** (gratis)
   - **Railway** (gratis)
   - **Render** (gratis)
   - **DigitalOcean**

### 2. Configurar el Frontend

1. **Subir archivos del frontend**
   - Sube todo el contenido de la carpeta `frontend` al directorio `public_html` de tu hosting

2. **Estructura en el servidor:**
   ```
   public_html/
   ├── index.html
   ├── login.html
   ├── css/
   │   ├── styles.css
   │   └── login.css
   ├── js/
   │   ├── app.js
   │   └── login.js
   └── .htaccess
   ```

3. **Actualizar URLs de la API**
   
   Si el backend está en otro servidor, edita `js/app.js` y `js/login.js`:
   ```javascript
   // Cambiar esta línea:
   const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
   
   // Por esta (reemplaza con tu URL del backend):
   const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : 'https://tu-backend.herokuapp.com/api';
   ```

### 3. Configurar Base de Datos

La base de datos SQLite se creará automáticamente cuando inicies el servidor por primera vez.

**⚠️ Importante:** En producción, considera migrar a MySQL o PostgreSQL para mejor rendimiento:
- Hostgator incluye MySQL en todos sus planes
- Necesitarías modificar el código para usar MySQL en lugar de SQLite

### 4. Configurar CORS en el Backend

Si frontend y backend están en dominios diferentes, asegúrate que el backend tenga:

```javascript
// En backend/server.js
app.use(cors({
  origin: 'https://tudominio.com', // Tu dominio de Hostgator
  credentials: true
}));
```

## 🔐 Configuración de Seguridad

1. **Cambiar las contraseñas por defecto**
   - Accede al sistema como admin
   - Ve a "Trabajadores"
   - Cambia las contraseñas de todos los usuarios

2. **Cambiar el secreto de sesión**
   En `backend/server.js`:
   ```javascript
   session({
     secret: 'tu-secreto-super-seguro-aqui', // Cambiar esto
     // ...
   })
   ```

3. **Habilitar HTTPS**
   - Instala un certificado SSL en cPanel (Hostgator ofrece SSL gratis)
   - Fuerza HTTPS en el `.htaccess`

## 🌐 Alternativa: Despliegue Completo en Servicios Modernos

### Opción Recomendada: Railway.app (Gratis)

1. **Crear cuenta en Railway.app**
2. **Conectar tu repositorio de GitHub**
3. **Railway detectará automáticamente Node.js**
4. **Configurar variables de entorno:**
   ```
   NODE_ENV=production
   PORT=3000
   ```
5. **Railway te dará una URL automática**

### Otras opciones:
- **Vercel**: Ideal para el frontend
- **Render**: Backend + Base de datos incluida
- **Netlify**: Solo frontend

## 📝 Usuarios por Defecto

Después de la instalación, el sistema crea estos usuarios:

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin | 123456 | Administrador |
| trabajador1 | 123456 | Trabajador |
| trabajador2 | 123456 | Trabajador |
| trabajador3 | 123456 | Trabajador |

**⚠️ IMPORTANTE: Cambia todas las contraseñas inmediatamente después de instalar**

## 🆘 Solución de Problemas

### Error: "No se puede conectar al servidor"
- Verifica que el servidor Node.js esté corriendo
- Revisa los logs: `pm2 logs obleas-api`
- Verifica el firewall y puertos abiertos

### Error: "Unauthorized / No autenticado"
- Limpia las cookies del navegador
- Verifica que las sesiones estén configuradas correctamente
- Revisa que CORS permita tu dominio

### Las ventas no se registran
- Abre la consola del navegador (F12)
- Verifica que no haya errores de JavaScript
- Confirma que el trabajador esté seleccionado

## 📞 Soporte

Si tienes problemas con la instalación:
1. Revisa los logs del servidor
2. Verifica la consola del navegador
3. Asegúrate de que todos los archivos se subieron correctamente

## 🔄 Actualizar el Sistema

Para actualizar después de hacer cambios:

1. **Backend:**
   ```bash
   cd /home/usuario/obleas
   git pull  # Si usas Git
   npm install
   pm2 restart obleas-api
   ```

2. **Frontend:**
   - Sube los archivos modificados vía FTP
   - Limpia la caché del navegador (Ctrl + F5)
