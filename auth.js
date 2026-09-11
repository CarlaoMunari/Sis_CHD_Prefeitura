// ============================================
// SISTEMA DE AUTENTICAÇÃO & RBAC (auth.js)
// ============================================

const Auth = {
  // Salvar usuário atual na sessão
  setUser(user, token) {
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('authToken', token);
  },

  // Obter usuário logado
  getUser() {
    try {
      const userStr = localStorage.getItem('currentUser');
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  },

  // Obter token
  getToken() {
    return localStorage.getItem('authToken') || '';
  },

  // Fazer Logout
  logout() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    window.location.href = 'login.html';
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

// Executar atualização visual do cabeçalho quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.includes('login.html')) {
    Auth.renderUserHeader();
  }
});
