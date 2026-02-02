// Auth utilities

const API_URL = '';

function getToken() {
    return localStorage.getItem('token');
}

function getUsuario() {
    const usuario = localStorage.getItem('usuario');
    return usuario ? JSON.parse(usuario) : null;
}

function isAuthenticated() {
    const token = getToken();
    return !!token;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = 'login.html';
}

function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

async function fetchApi(endpoint, options = {}) {
    const token = getToken();

    const defaultHeaders = {
        'Content-Type': 'application/json'
    };

    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    });

    if (response.status === 401) {
        logout();
        throw new Error('Sessão expirada');
    }

    return response;
}

// Toast notifications
function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// Format date
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format status
function getStatusBadge(status) {
    const statusMap = {
        'estoque': { label: 'Estoque', class: 'badge-estoque' },
        'cliente': { label: 'Cliente', class: 'badge-cliente' },
        'manutencao': { label: 'Manutenção', class: 'badge-manutencao' },
        'pendente': { label: 'Pendente', class: 'badge-pendente' },
        'em_andamento': { label: 'Em Andamento', class: 'badge-em_andamento' },
        'concluida': { label: 'Concluída', class: 'badge-concluida' }
    };

    const statusInfo = statusMap[status] || { label: status, class: '' };
    return `<span class="badge ${statusInfo.class}">${statusInfo.label}</span>`;
}

// Initialize user info in sidebar
function initUserInfo() {
    const usuario = getUsuario();
    if (usuario) {
        const userNameEl = document.querySelector('.user-name');
        const userAvatarEl = document.querySelector('.user-avatar');

        if (userNameEl) {
            userNameEl.textContent = usuario.nome;
        }
        if (userAvatarEl) {
            userAvatarEl.textContent = usuario.nome.charAt(0).toUpperCase();
        }
    }
}

// Set active nav link
function setActiveNav() {
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
        }
    });
}
