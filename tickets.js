// ============================================
// CONTROLLER DE CHAMADOS & INTEGRAÇÃO DE TONER (tickets.js)
// ============================================

Auth.requireAuth(); // Garantir que está autenticado

let allTickets = [];
let filteredTickets = [];
let availableToners = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadTonersInventory();
  await loadTickets();
  setupEventListeners();
});

// Carregar inventário de toners para popular dropdowns
async function loadTonersInventory() {
  try {
    const res = await fetch('/api/toners');
    if (res.ok) {
      availableToners = await res.json();
    }
  } catch (err) {
    console.error('Erro ao carregar toners:', err);
  }
}

// Carregar chamados
async function loadTickets() {
  try {
    const currentUser = Auth.getUser();
    const res = await fetch('/api/tickets', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });

    if (!res.ok) throw new Error('Erro ao carregar chamados');
    allTickets = await res.json();

    // Se for USUARIO, filtrar apenas os chamados dele
    if (currentUser.role === 'USUARIO') {
      allTickets = allTickets.filter(t => t.solicitanteId === currentUser.id);
    }

    applyTicketFilters();
  } catch (err) {
    alert(err.message);
  }
}

function applyTicketFilters() {
  const search = document.getElementById('ticketSearch').value.toLowerCase();
  const catFilter = document.getElementById('categoriaFilter').value;
  const statusFilter = document.getElementById('ticketStatusFilter').value;

  filteredTickets = allTickets.filter(t => {
    const matchesSearch = !search || 
      t.codigo.toLowerCase().includes(search) || 
      t.solicitanteNome.toLowerCase().includes(search) || 
      t.descricao.toLowerCase().includes(search);
    const matchesCat = !catFilter || t.categoria === catFilter;
    const matchesStatus = !statusFilter || t.status === statusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  });

  renderTicketsTable();
}

function renderTicketsTable() {
  const tbody = document.getElementById('ticketsTableBody');
  tbody.innerHTML = '';

  if (filteredTickets.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">Nenhum chamado encontrado.</td></tr>`;
    return;
  }

  const currentUser = Auth.getUser();
  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN';

  filteredTickets.forEach(t => {
    const row = document.createElement('tr');
    
    let detalhesStr = '-';
    if (t.detalhesToner && t.detalhesToner.modeloImpressora) {
      const itensStr = t.detalhesToner.itens.map(i => `${i.quantidadeSolicitada}x ${i.toner}`).join(', ');
      detalhesStr = `🖨️ <strong>${t.detalhesToner.modeloImpressora}</strong> (${itensStr})`;
    }

    row.innerHTML = `
      <td><strong>${t.codigo}</strong></td>
      <td>${new Date(t.dataAbertura).toLocaleDateString('pt-BR')} ${new Date(t.dataAbertura).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</td>
      <td>${t.solicitanteNome}</td>
      <td>${t.categoria}</td>
      <td>${detalhesStr}</td>
      <td><span class="status-badge status-${t.status.toLowerCase()}">${t.status.replace('_', ' ')}</span></td>
      <td>
        <button class="btn btn-info btn-small" onclick="viewTicketDetail(${t.id})">
          ${isAdmin ? '🛠️ Atender / Editar' : '👁️ Ver Detalhes'}
        </button>
        ${isAdmin ? `
          <button class="btn btn-danger btn-small" style="margin-left: 4px;" onclick="excluirChamado(${t.id}, '${t.codigo}')" title="Excluir Chamado">
            🗑️ Excluir
          </button>
        ` : ''}
      </td>
    `;
    tbody.appendChild(row);
  });
}

function setupEventListeners() {
  document.getElementById('ticketSearch').addEventListener('input', applyTicketFilters);
  document.getElementById('categoriaFilter').addEventListener('change', applyTicketFilters);
  document.getElementById('ticketStatusFilter').addEventListener('change', applyTicketFilters);

  const modal = document.getElementById('ticketModal');
  document.getElementById('openTicketBtn').addEventListener('click', () => {
    document.getElementById('ticketForm').reset();
    document.getElementById('tonerRequestSection').style.display = 'none';
    modal.style.display = 'block';
  });

  document.getElementById('closeTicketModal').addEventListener('click', () => modal.style.display = 'none');
  document.getElementById('cancelTicketModalBtn').addEventListener('click', () => modal.style.display = 'none');
  document.getElementById('closeDetailModal').addEventListener('click', () => document.getElementById('ticketDetailModal').style.display = 'none');

  // Monitorar alteração de categoria no form de criação
  const categoriaSelect = document.getElementById('categoria');
  categoriaSelect.addEventListener('change', (e) => {
    const tonerSection = document.getElementById('tonerRequestSection');
    if (e.target.value === 'Solicitação de Toners e Tintas') {
      tonerSection.style.display = 'block';
      populatePrinterModelsDropdown();
    } else {
      tonerSection.style.display = 'none';
    }
  });

  // Monitorar alteração do modelo da impressora
  document.getElementById('modeloImpressora').addEventListener('change', (e) => {
    renderTonerOptionsForPrinter(e.target.value);
  });

  // Salvar Novo Chamado
  document.getElementById('ticketForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentUser = Auth.getUser();
    const categoria = document.getElementById('categoria').value;
    const descricao = document.getElementById('descricao').value.trim();
    const prioridade = document.getElementById('prioridade').value;

    let detalhesToner = null;

    if (categoria === 'Solicitação de Toners e Tintas') {
      const modeloImpressora = document.getElementById('modeloImpressora').value;
      if (!modeloImpressora) {
        alert('Por favor, selecione o modelo da impressora.');
        return;
      }

      const selectedItems = [];
      const checkboxes = document.querySelectorAll('.toner-item-checkbox:checked');
      checkboxes.forEach(cb => {
        const tonerId = parseInt(cb.dataset.tonerId);
        const qtyInput = document.getElementById(`qty_${tonerId}`);
        const qty = parseInt(qtyInput ? qtyInput.value : 1) || 1;
        const tonerObj = availableToners.find(t => t.id === tonerId);
        if (tonerObj) {
          selectedItems.push({
            tonerId: tonerObj.id,
            marca: tonerObj.marca,
            modelo: tonerObj.modelo,
            toner: tonerObj.toner,
            quantidadeSolicitada: qty
          });
        }
      });

      if (selectedItems.length === 0) {
        alert('Por favor, selecione ao menos um toner/tinta da lista.');
        return;
      }

      detalhesToner = {
        modeloImpressora,
        itens: selectedItems
      };
    }

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({
          solicitanteId: currentUser.id,
          solicitanteNome: currentUser.nome,
          solicitanteEmail: currentUser.email,
          solicitanteDepartamento: currentUser.departamento || 'GERAL',
          categoria,
          detalhesToner,
          descricao,
          prioridade
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao abrir chamado');

      alert(`Chamado ${data.codigo} aberto com sucesso!`);
      document.getElementById('ticketModal').style.display = 'none';
      loadTickets();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  });
}

// Popular dropdown com modelos distintos de impressoras
function populatePrinterModelsDropdown() {
  const printerSelect = document.getElementById('modeloImpressora');
  printerSelect.innerHTML = '<option value="">Selecione a impressora...</option>';

  const printerModels = [...new Set(availableToners.map(t => `${t.marca} ${t.modelo}`))].sort();
  printerModels.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    printerSelect.appendChild(opt);
  });

  document.getElementById('tonerItemsContainer').style.display = 'none';
}

// Renderizar suprimentos vinculados à impressora selecionada (Criar Chamado)
function renderTonerOptionsForPrinter(fullModelName) {
  const container = document.getElementById('tonerItemsContainer');
  const listDiv = document.getElementById('tonerItemsList');

  if (!fullModelName) {
    container.style.display = 'none';
    return;
  }

  const matchingToners = availableToners.filter(t => `${t.marca} ${t.modelo}` === fullModelName);

  if (matchingToners.length === 0) {
    listDiv.innerHTML = '<p style="color:#e53e3e;">Nenhum toner/tinta encontrado para este modelo.</p>';
    container.style.display = 'block';
    return;
  }

  let html = '';
  matchingToners.forEach(t => {
    const isInk = t.toner.toLowerCase().includes('tank') || t.toner.toLowerCase().includes('tinta');
    let stockBadge = isInk ? `<span class="stock-tag stock-ink">💧 Tinta Recarregável</span>` :
      (t.quantidade === 0 ? `<span class="stock-tag stock-zero">🔴 Zerado (0 un)</span>` : `<span class="stock-tag stock-available">🟢 Estoque: ${t.quantidade} un</span>`);

    html += `
      <div class="toner-item-card">
        <div>
          <label style="cursor:pointer; font-weight:600;">
            <input type="checkbox" class="toner-item-checkbox" data-toner-id="${t.id}" onchange="toggleQtyInput(${t.id}, this.checked)" />
            Toner/Suprimento: ${t.toner}
          </label>
          <div style="margin-top: 4px;">${stockBadge}</div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <label style="font-size:0.85rem;">Qtd:</label>
          <input type="number" id="qty_${t.id}" value="1" min="1" max="10" style="width: 50px; padding: 4px; border: 1px solid #cbd5e0; border-radius: 4px;" disabled />
        </div>
      </div>
    `;
  });

  listDiv.innerHTML = html;
  container.style.display = 'block';
}

function toggleQtyInput(tonerId, isChecked) {
  const qtyInput = document.getElementById(`qty_${tonerId}`);
  if (qtyInput) {
    qtyInput.disabled = !isChecked;
  }
}

// Renderizar suprimentos e quantidades no painel de edição do Admin
function renderAdminTonerEditor(fullModelName, currentTicketItens = []) {
  const container = document.getElementById('adminTonerEditorContainer');
  if (!container || !fullModelName) return;

  const matchingToners = availableToners.filter(t => `${t.marca} ${t.modelo}` === fullModelName);

  if (matchingToners.length === 0) {
    container.innerHTML = '<p style="color:#e53e3e;">Nenhum toner/tinta encontrado para esta impressora.</p>';
    return;
  }

  let html = '<label style="font-weight:600; display:block; margin: 10px 0 4px 0;">Selecione o(s) Toner(s) e a Quantidade Corrigida:</label>';
  matchingToners.forEach(t => {
    const existingItem = currentTicketItens.find(i => i.tonerId === t.id || i.toner === t.toner);
    const isChecked = Boolean(existingItem);
    const initialQty = existingItem ? existingItem.quantidadeSolicitada : 1;
    const isInk = t.toner.toLowerCase().includes('tank') || t.toner.toLowerCase().includes('tinta');

    let stockBadge = isInk ? `<span class="stock-tag stock-ink">💧 Tinta</span>` :
      (t.quantidade === 0 ? `<span class="stock-tag stock-zero">🔴 Zerado (0 un)</span>` : `<span class="stock-tag stock-available">🟢 Estoque: ${t.quantidade} un</span>`);

    html += `
      <div class="toner-item-card" style="margin-bottom:6px; background:#ffffff; border:1px solid #e2e8f0;">
        <div>
          <label style="cursor:pointer; font-weight:600;">
            <input type="checkbox" class="admin-toner-checkbox" data-toner-id="${t.id}" ${isChecked ? 'checked' : ''} onchange="document.getElementById('admin_qty_${t.id}').disabled = !this.checked" />
            ${t.toner}
          </label>
          <div style="margin-top:2px;">${stockBadge}</div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <label style="font-size:0.85rem;">Qtd:</label>
          <input type="number" id="admin_qty_${t.id}" value="${initialQty}" min="1" max="50" style="width: 55px; padding: 4px; border: 1px solid #cbd5e0; border-radius: 4px;" ${isChecked ? '' : 'disabled'} />
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Visualizar / Atender / Editar Chamado
async function viewTicketDetail(ticketId) {
  const ticket = allTickets.find(t => t.id === ticketId);
  if (!ticket) return;

  const currentUser = Auth.getUser();
  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN';
  const modal = document.getElementById('ticketDetailModal');
  const content = document.getElementById('detailModalContent');

  let itemsHtml = '';
  if (ticket.detalhesToner) {
    itemsHtml += `<div style="background:#f7fafc; padding:12px; border-radius:6px; margin: 10px 0; border:1px solid #e2e8f0;">`;
    itemsHtml += `<strong>Modelo Impressora:</strong> ${ticket.detalhesToner.modeloImpressora}<br>`;
    itemsHtml += `<strong>Itens Solicitados:</strong><ul>`;
    ticket.detalhesToner.itens.forEach(i => {
      itemsHtml += `<li><strong>${i.quantidadeSolicitada}x</strong> ${i.toner} (${i.marca} ${i.modelo})</li>`;
    });
    itemsHtml += `</ul></div>`;
  }

  let adminControls = '';
  if (isAdmin) {
    const currentPrinterModel = ticket.detalhesToner ? ticket.detalhesToner.modeloImpressora : '';
    const currentItens = ticket.detalhesToner ? ticket.detalhesToner.itens : [];

    adminControls = `
      <hr style="margin: 1.5rem 0; border:0; border-top:1px solid #e2e8f0;">
      <h3 style="font-size:1.1rem; color:#2d3748;">🛠️ Painel do Atendente (Edição Admin)</h3>
      
      <div class="form-group">
        <label for="updateStatus">Alterar Status do Chamado:</label>
        <select id="updateStatus" class="form-control">
          <option value="ABERTO" ${ticket.status === 'ABERTO' ? 'selected' : ''}>Aberto</option>
          <option value="EM_ATENDIMENTO" ${ticket.status === 'EM_ATENDIMENTO' ? 'selected' : ''}>Em Atendimento</option>
          <option value="AGUARDANDO_PECAS" ${ticket.status === 'AGUARDANDO_PECAS' ? 'selected' : ''}>Aguardando Peças</option>
          <option value="FINALIZADO" ${ticket.status === 'FINALIZADO' ? 'selected' : ''}>Finalizado</option>
          <option value="CANCELADO" ${ticket.status === 'CANCELADO' ? 'selected' : ''}>Cancelado</option>
        </select>
      </div>

      ${ticket.categoria === 'Solicitação de Toners e Tintas' ? `
        <div style="background:#fffaf0; border:1px solid #feebc8; padding:14px; border-radius:8px; margin-bottom:1rem;">
          <h4 style="margin:0 0 6px 0; color:#c05621; font-size:1rem;">🛠️ Correção Administrativa do Pedido:</h4>
          <small style="color:#744210;">Altere o modelo da impressora, os toners ou as quantidades se o usuário solicitou errado:</small>
          
          <div class="form-group" style="margin-top:8px;">
            <label for="adminCorrectPrinter" style="font-weight:600;">Modelo da Impressora:</label>
            <select id="adminCorrectPrinter" class="form-control" onchange="renderAdminTonerEditor(this.value, [])">
              ${[...new Set(availableToners.map(t => `${t.marca} ${t.modelo}`))].sort().map(m => `
                <option value="${m}" ${currentPrinterModel === m ? 'selected' : ''}>${m}</option>
              `).join('')}
            </select>
          </div>

          <div id="adminTonerEditorContainer"></div>
        </div>
      ` : ''}

      <div style="display:flex; gap:10px; margin-top: 1rem; flex-wrap: wrap; align-items: center;">
        <button class="btn btn-primary" onclick="saveAdminTicketChanges(${ticket.id})">💾 Salvar Alterações</button>
        ${ticket.status !== 'FINALIZADO' ? `
          <button class="btn btn-success" onclick="finalizarEDarBaixaEstoque(${ticket.id})">✅ Finalizar & Dar Baixa no Estoque</button>
        ` : '<span style="color:#22543d; font-weight:bold; align-self:center;">✓ Baixa no Estoque Concluída</span>'}
        <button class="btn btn-danger" style="margin-left:auto;" onclick="excluirChamado(${ticket.id}, '${ticket.codigo}')">🗑️ Excluir Chamado</button>
      </div>
    `;
  } else {
    // Visão do Usuário
    if (ticket.status === 'FINALIZADO') {
      adminControls = `
        <div style="margin-top:1.5rem;">
          <button class="btn btn-warning" onclick="reabrirChamado(${ticket.id})">🔄 Reabrir Chamado</button>
        </div>
      `;
    }
  }

  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h3>Chamado: ${ticket.codigo}</h3>
      <span class="status-badge status-${ticket.status.toLowerCase()}">${ticket.status.replace('_', ' ')}</span>
    </div>
    <p><strong>Solicitante:</strong> ${ticket.solicitanteNome} (${ticket.solicitanteEmail}) &nbsp;|&nbsp; <strong>Departamento:</strong> <span class="dept-badge">${ticket.solicitanteDepartamento || 'GERAL'}</span></p>
    <p><strong>Data de Abertura:</strong> ${new Date(ticket.dataAbertura).toLocaleString('pt-BR')}</p>
    <p><strong>Categoria:</strong> ${ticket.categoria}</p>
    <p><strong>Descrição:</strong> ${ticket.descricao}</p>
    ${itemsHtml}
    ${adminControls}
  `;

  modal.style.display = 'block';

  // Se for ticket de toner e for admin, inicializar o editor de toner com os valores atuais
  if (isAdmin && ticket.categoria === 'Solicitação de Toners e Tintas') {
    const printerVal = document.getElementById('adminCorrectPrinter').value;
    renderAdminTonerEditor(printerVal, ticket.detalhesToner ? ticket.detalhesToner.itens : []);
  }
}

// Salvar alterações de status/impressora/toner/quantidade feitas pelo admin
async function saveAdminTicketChanges(ticketId) {
  const status = document.getElementById('updateStatus').value;
  const printerSelect = document.getElementById('adminCorrectPrinter');
  
  let detalhesToner = null;

  if (printerSelect) {
    const modeloImpressora = printerSelect.value;
    const selectedItems = [];
    const checkboxes = document.querySelectorAll('.admin-toner-checkbox:checked');

    checkboxes.forEach(cb => {
      const tonerId = parseInt(cb.dataset.tonerId);
      const qtyInput = document.getElementById(`admin_qty_${tonerId}`);
      const qty = parseInt(qtyInput ? qtyInput.value : 1) || 1;
      const tonerObj = availableToners.find(t => t.id === tonerId);
      if (tonerObj) {
        selectedItems.push({
          tonerId: tonerObj.id,
          marca: tonerObj.marca,
          modelo: tonerObj.modelo,
          toner: tonerObj.toner,
          quantidadeSolicitada: qty
        });
      }
    });

    if (selectedItems.length === 0) {
      alert('Por favor, selecione ao menos um toner/tinta no painel de correção.');
      return;
    }

    detalhesToner = {
      modeloImpressora,
      itens: selectedItems
    };
  }

  try {
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({ status, detalhesToner })
    });

    if (!res.ok) throw new Error('Erro ao atualizar chamado');
    alert('Alterações do chamado salvas com sucesso!');
    document.getElementById('ticketDetailModal').style.display = 'none';
    loadTickets();
  } catch (err) {
    alert(err.message);
  }
}

// Finalizar Chamado com Baixa Automática no Estoque
async function finalizarEDarBaixaEstoque(ticketId) {
  if (confirm('Deseja finalizar o chamado e dar baixa automática da quantidade de toner no estoque?')) {
    try {
      // Primeiro salvar qualquer alteração pendente no formulário admin
      await saveAdminTicketChangesSilent(ticketId);

      const res = await fetch(`/api/tickets/${ticketId}/finalizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao finalizar chamado');

      alert(data.message || 'Chamado finalizado e baixa no estoque realizada!');
      document.getElementById('ticketDetailModal').style.display = 'none';
      loadTickets();
    } catch (err) {
      alert(err.message);
    }
  }
}

// Auxiliar para salvar alterações do admin antes de finalizar
async function saveAdminTicketChangesSilent(ticketId) {
  const printerSelect = document.getElementById('adminCorrectPrinter');
  if (!printerSelect) return;

  const status = document.getElementById('updateStatus').value;
  const modeloImpressora = printerSelect.value;
  const selectedItems = [];
  const checkboxes = document.querySelectorAll('.admin-toner-checkbox:checked');

  checkboxes.forEach(cb => {
    const tonerId = parseInt(cb.dataset.tonerId);
    const qtyInput = document.getElementById(`admin_qty_${tonerId}`);
    const qty = parseInt(qtyInput ? qtyInput.value : 1) || 1;
    const tonerObj = availableToners.find(t => t.id === tonerId);
    if (tonerObj) {
      selectedItems.push({
        tonerId: tonerObj.id,
        marca: tonerObj.marca,
        modelo: tonerObj.modelo,
        toner: tonerObj.toner,
        quantidadeSolicitada: qty
      });
    }
  });

  if (selectedItems.length > 0) {
    await fetch(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({ status, detalhesToner: { modeloImpressora, itens: selectedItems } })
    });
  }
}

// Reabrir chamado pelo usuário
async function reabrirChamado(ticketId) {
  if (confirm('Deseja reabrir este chamado?')) {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({ status: 'ABERTO' })
      });

      if (!res.ok) throw new Error('Erro ao reabrir chamado');
      alert('Chamado reaberto com sucesso!');
      document.getElementById('ticketDetailModal').style.display = 'none';
      loadTickets();
    } catch (err) {
      alert(err.message);
    }
  }
}

// Excluir Chamado por Administrador (desfaz processos atrelados e estorna baixa de estoque de toner)
async function excluirChamado(ticketId, ticketCodigo) {
  const currentUser = Auth.getUser();
  if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
    alert('Apenas administradores podem excluir chamados.');
    return;
  }

  const confirmMsg = `Tem certeza que deseja EXCLUIR o chamado ${ticketCodigo}?\n\n` +
    `⚠️ ATENÇÃO: Esta ação é irreversível.\n` +
    `Se este chamado tiver tido baixa automática no estoque de toner, ela será DESFEITA e os itens serão devolvidos ao estoque.`;

  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao excluir chamado.');

    alert(data.message || `Chamado ${ticketCodigo} excluído com sucesso!`);

    const modal = document.getElementById('ticketDetailModal');
    if (modal) modal.style.display = 'none';

    await loadTonersInventory();
    await loadTickets();
  } catch (err) {
    alert('Erro ao excluir chamado: ' + err.message);
  }
}

