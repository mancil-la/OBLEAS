// En Netlify (prod y netlify dev) la API vive en /api gracias a netlify.toml
const API_URL = '/api';

async function readResponseBody(response) {
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();
    if (contentType.includes('application/json')) {
        try {
            return { json: JSON.parse(text), text };
        } catch {
            return { json: null, text };
        }
    }
    // A veces Netlify devuelve HTML (502/404) y response.json() truena.
    try {
        return { json: JSON.parse(text), text };
    } catch {
        return { json: null, text };
    }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const usuario = document.getElementById('usuario').value.trim();
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    // Limpiar mensaje de error
    errorMessage.classList.add('hidden');
    errorMessage.textContent = '';
    
    // Deshabilitar botón
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando sesión...';
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ usuario, password })
        });

        const { json, text } = await readResponseBody(response);
        const data = json || {};
        
        if (response.ok) {
            // Guardar token + usuario
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Mostrar mensaje de éxito
            errorMessage.classList.remove('hidden');
            errorMessage.style.backgroundColor = '#d1fae5';
            errorMessage.style.color = '#065f46';
            errorMessage.style.borderColor = '#a7f3d0';
            errorMessage.textContent = '✓ Inicio de sesión exitoso. Redirigiendo...';
            
            // Redirigir al sistema
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            // Mostrar error
            errorMessage.classList.remove('hidden');
            const backendMsg = data.error
                ? data.error
                : (text ? text.slice(0, 200) : 'Error al iniciar sesión');
            errorMessage.textContent = `(${response.status}) ${backendMsg}`;
            
            // Rehabilitar botón
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            submitBtn.innerHTML = originalText;
        }
    } catch (error) {
        console.error('Error:', error);
        errorMessage.classList.remove('hidden');
        errorMessage.textContent = `Error de conexión. ${error && error.message ? error.message : ''}`.trim();
        
        // Rehabilitar botón
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitBtn.innerHTML = originalText;
    }
});

// Permitir presionar Enter para enviar el formulario
document.getElementById('password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('login-form').dispatchEvent(new Event('submit'));
    }
});
