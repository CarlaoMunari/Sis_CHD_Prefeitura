// ============================================
// SISTEMA DE AUTENTICAÇÃO & RBAC (auth.js)
// ============================================

const Auth = {
  INACTIVITY_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutos de inatividade

  // Salvar cookie de sessão (sem Expires/Max-Age = descartado pelo navegador ao fechar)
  setSessionCookie(data) {
    try {
      data.lastActive = Date.now();
      const json = JSON.stringify(data);
      document.cookie = 'chd_session=' + encodeURIComponent(json) + '; path=/; SameSite=Lax';
    } catch (e) {
      console.warn('Não foi possível salvar cookie de sessão:', e);
    }
  },

  // Obter cookie de sessão
  getSessionCookie() {
    try {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const c = cookies[i].trim();
        if (c.indexOf('chd_session=') === 0) {
          const val = c.substring('chd_session='.length);
          return JSON.parse(decodeURIComponent(val));
        }
      }
    } catch (e) {
      return null;
    }
    return null;
  },

  // Limpar cookie de sessão
  clearSessionCookie() {
    document.cookie = 'chd_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  },

  // Atualizar timestamp de atividade
  updateActivity() {
    try {
      sessionStorage.setItem('chd_last_active', Date.now().toString());
    } catch (e) {}
  },

  // Verificar se a sessão expirou por inatividade
  isSessionExpired() {
    try {
      const lastActive = sessionStorage.getItem('chd_last_active');
      if (!lastActive) return false;
      const elapsed = Date.now() - parseInt(lastActive, 10);
      return elapsed > this.INACTIVITY_TIMEOUT_MS;
    } catch (e) {
      return false;
    }
  },

  // Salvar usuário atual na sessão (sessionStorage + Cookie de sessão)
  setUser(user, token) {
    try {
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      sessionStorage.setItem('authToken', token);
      this.updateActivity();
    } catch (e) {}

    this.setSessionCookie({ user, token, lastActive: Date.now() });

    // Limpar resíduos do localStorage legado para evitar logins permanentes
    try {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
    } catch (e) {}
  },

  // Obter usuário logado
  getUser() {
    // 1. Verificar inatividade
    if (this.isSessionExpired()) {
      this.logout();
      return null;
    }

    // 2. Tentar obter do sessionStorage da aba atual
    try {
      const userStr = sessionStorage.getItem('currentUser');
      if (userStr) {
        this.updateActivity();
        return JSON.parse(userStr);
      }
    } catch (e) {}

    // 3. Se não estiver no sessionStorage (ex: nova aba aberta no mesmo navegador), buscar no cookie de sessão
    const sessionData = this.getSessionCookie();
    if (sessionData && sessionData.user && sessionData.token) {
      if (sessionData.lastActive && (Date.now() - sessionData.lastActive > this.INACTIVITY_TIMEOUT_MS)) {
        this.logout();
        return null;
      }

      try {
        sessionStorage.setItem('currentUser', JSON.stringify(sessionData.user));
        sessionStorage.setItem('authToken', sessionData.token);
        sessionStorage.setItem('chd_last_active', (sessionData.lastActive || Date.now()).toString());
      } catch (e) {}

      this.updateActivity();
      return sessionData.user;
    }

    // 4. Se não houver nem sessionStorage nem cookie de sessão, o navegador foi fechado
    return null;
  },

  // Obter token
  getToken() {
    if (this.isSessionExpired()) {
      this.logout();
      return '';
    }

    try {
      const token = sessionStorage.getItem('authToken');
      if (token) {
        this.updateActivity();
        return token;
      }
    } catch (e) {}

    const sessionData = this.getSessionCookie();
    if (sessionData && sessionData.token) {
      if (sessionData.lastActive && (Date.now() - sessionData.lastActive > this.INACTIVITY_TIMEOUT_MS)) {
        this.logout();
        return '';
      }

      try {
        sessionStorage.setItem('currentUser', JSON.stringify(sessionData.user));
        sessionStorage.setItem('authToken', sessionData.token);
        sessionStorage.setItem('chd_last_active', (sessionData.lastActive || Date.now()).toString());
      } catch (e) {}

      this.updateActivity();
      return sessionData.token;
    }

    return '';
  },

  // Fazer Logout e limpar todas as sessões
  logout() {
    try {
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('chd_last_active');
    } catch (e) {}

    this.clearSessionCookie();

    try {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
    } catch (e) {}

    // Notificar outras abas abertas para deslogar imediatamente
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('chd_auth_channel');
        channel.postMessage({ action: 'logout' });
        channel.close();
      } catch (e) {}
    }

    try {
      localStorage.setItem('chd_logout_sync', Date.now().toString());
    } catch (e) {}

    window.location.href = 'login.html';
  },

  // Monitorar atividade do usuário para atualizar timestamp
  setupActivityTracker() {
    let lastThrottledUpdate = 0;
    const update = () => {
      const now = Date.now();
      if (now - lastThrottledUpdate > 30000) { // Throttle de 30 segundos
        lastThrottledUpdate = now;
        if (sessionStorage.getItem('currentUser')) {
          this.updateActivity();
          const session = this.getSessionCookie();
          if (session) {
            this.setSessionCookie({ ...session, lastActive: now });
          }
        }
      }
    };

    window.addEventListener('click', update, { passive: true });
    window.addEventListener('keydown', update, { passive: true });
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('mousemove', update, { passive: true });
  },

  // Verificar se o usuário está logado e tem permissão para a página
  requireAuth(allowedRoles = []) {
    const user = this.getUser();
    if (!user) {
      window.location.href = 'login.html';
      return false;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      alert('Acesso restrito! Você não tem permissão para acessar esta página.');
      window.location.href = 'chamados.html';
      return false;
    }

    return true;
  },

  // Renderizar cabeçalho do usuário com botões de navegação conforme permissão
  renderUserHeader() {
    const user = this.getUser();
    if (!user) return;

    const navContainer = document.getElementById('mainNavigation');
    const userDisplay = document.getElementById('userDisplayInfo');

    if (userDisplay) {
      userDisplay.innerHTML = `
        <span class="user-badge role-${user.role.toLowerCase()}">${user.role}</span>
        <strong>${user.login || user.nome}</strong> (${user.email})
        <button onclick="Auth.openChangePasswordModal()" class="btn btn-warning btn-small" style="margin-left: 8px;">🔑 Minha Senha</button>
        <button onclick="Auth.logout()" class="btn btn-danger btn-small" style="margin-left: 6px;">🚪 Sair</button>
      `;
    }

    if (navContainer) {
      const isSuper = user.role === 'SUPER_ADMIN';
      const isAdmin = user.role === 'ADMIN' || isSuper;

      let navHtml = `
        <a href="chamados.html" class="nav-item ${window.location.pathname.includes('chamados.html') ? 'active' : ''}">🎫 Central de Chamados</a>
      `;

      if (isAdmin) {
        navHtml += `
          <a href="index.html" class="nav-item ${window.location.pathname.includes('index.html') ? 'active' : ''}">🖨️ Controle de Toners</a>
          <a href="usuarios.html" class="nav-item ${window.location.pathname.includes('usuarios.html') ? 'active' : ''}" id="navUsuariosLink">👥 Gerenciar Usuários</a>
          <a href="relatorios.html" class="nav-item ${window.location.pathname.includes('relatorios.html') ? 'active' : ''}">📊 Relatórios</a>
        `;
      }

      navContainer.innerHTML = navHtml;

      // Buscar contagem de pendentes e exibir badge vermelho no menu
      if (isAdmin) {
        this._updatePendingNavBadge();
      }
    }

    this.injectPasswordModalHTML();
  },

  // Busca pendentes e injeta badge vermelho ao lado de "Gerenciar Usuários"
  _updatePendingNavBadge() {
    fetch('/api/users', {
      headers: { 'Authorization': 'Bearer ' + this.getToken() }
    })
      .then(function(r) { return r.ok ? r.json() : []; })
      .then(function(users) {
        var count = users.filter(function(u) { return u.status === 'PENDENTE'; }).length;
        var link = document.getElementById('navUsuariosLink');
        if (!link) return;
        var old = link.querySelector('.nav-pending-badge');
        if (old) old.remove();
        if (count > 0) {
          var badge = document.createElement('span');
          badge.className = 'nav-pending-badge';
          badge.textContent = count;
          badge.style.display = 'inline-flex';
          badge.style.alignItems = 'center';
          badge.style.justifyContent = 'center';
          badge.style.minWidth = '18px';
          badge.style.height = '18px';
          badge.style.padding = '0 4px';
          badge.style.borderRadius = '9px';
          badge.style.background = '#e53e3e';
          badge.style.color = 'white';
          badge.style.fontSize = '0.68rem';
          badge.style.fontWeight = 'bold';
          badge.style.marginLeft = '6px';
          badge.style.verticalAlign = 'middle';
          badge.style.lineHeight = '1';
          link.appendChild(badge);
        }
      })
      .catch(function() {/* silencioso */});
  },

  // Injetar Modal de Alteração de Própria Senha no DOM
  injectPasswordModalHTML() {
    if (document.getElementById('myPasswordModal')) return;

    const modalHTML = `
      <div id="myPasswordModal" class="modal">
        <div class="modal-content" style="max-width: 400px;">
          <div class="modal-header">
            <h2>🔑 Alterar Minha Senha</h2>
            <span onclick="document.getElementById('myPasswordModal').style.display='none'" class="close">&times;</span>
          </div>

          <form id="myPasswordForm">
            <div class="form-group">
              <label for="myCurrentPassword">Senha Atual *</label>
              <input type="password" id="myCurrentPassword" class="form-control" required />
            </div>

            <div class="form-group">
              <label for="myNewPassword">Nova Senha (mín. 4 caracteres) *</label>
              <input type="password" id="myNewPassword" class="form-control" required minlength="4" />
            </div>

            <div class="form-actions" style="margin-top: 1.5rem;">
              <button type="button" onclick="document.getElementById('myPasswordModal').style.display='none'" class="btn btn-danger">Cancelar</button>
              <button type="submit" class="btn btn-success">Salvar Senha</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('myPasswordForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = this.getUser();
      const currentPassword = document.getElementById('myCurrentPassword').value;
      const newPassword = document.getElementById('myNewPassword').value;

      try {
        const res = await fetch(`/api/users/${user.id}/change-password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.getToken() },
          body: JSON.stringify({ currentPassword, newPassword, isAdminReset: false })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao alterar senha');

        alert('Sua senha foi alterada com sucesso!');
        document.getElementById('myPasswordModal').style.display = 'none';
        document.getElementById('myPasswordForm').reset();
      } catch (err) {
        alert('Erro: ' + err.message);
      }
    });
  },

  openChangePasswordModal() {
    const modal = document.getElementById('myPasswordModal');
    if (modal) {
      document.getElementById('myPasswordForm').reset();
      modal.style.display = 'block';
    }
  }
};

// ============================================
// INICIALIZAÇÃO, SINCRONIZAÇÃO E EVENTOS GLOBAIS
// ============================================

// 1. Limpeza proativa de qualquer resíduo persistente antigo do localStorage
try {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('authToken');
} catch (e) {}

// 2. Ouvinte de BroadcastChannel para sincronizar logout instantâneo entre abas
if (typeof BroadcastChannel !== 'undefined') {
  try {
    const authBroadcast = new BroadcastChannel('chd_auth_channel');
    authBroadcast.onmessage = (event) => {
      if (event.data && event.data.action === 'logout') {
        try {
          sessionStorage.clear();
        } catch (e) {}
        Auth.clearSessionCookie();
        if (!window.location.pathname.includes('login.html')) {
          window.location.href = 'login.html';
        }
      }
    };
  } catch (e) {}
}

// 3. Fallback de sincronização de logout entre abas via evento de storage
window.addEventListener('storage', (event) => {
  if (event.key === 'chd_logout_sync') {
    try {
      sessionStorage.clear();
    } catch (e) {}
    Auth.clearSessionCookie();
    if (!window.location.pathname.includes('login.html')) {
      window.location.href = 'login.html';
    }
  }
});

// 4. Executar configuração de monitoramento e atualização visual do cabeçalho
document.addEventListener('DOMContentLoaded', () => {
  Auth.setupActivityTracker();

  if (!window.location.pathname.includes('login.html')) {
    Auth.renderUserHeader();
  }
});

