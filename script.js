// Variáveis globais
let currentData = [];
let filteredData = [];
let editingId = null;
let manualChanges = new Map(); // Rastrear alterações manuais com timestamp

// Inicialização
document.addEventListener("DOMContentLoaded", async function () {
  await loadData();  // Aguardar carregamento dos dados
  setupEventListeners();
  populateMarcaOptions();
  renderTable();
  updateStats();

  // Inicializar dashboard
  if (typeof dashboard !== 'undefined') {
    dashboard.init();
  }

  // Mostrar mensagem de boas-vindas na primeira execução
  if (localStorage.getItem("firstRun") !== "false") {
    setTimeout(() => {
      alert(
        'Bem-vindo ao Sistema de Controle de Toners!\n\nOs dados foram carregados automaticamente.\nVocê pode adicionar, editar ou excluir itens conforme necessário.\n\nDica: Faça backups regulares usando o botão "Exportar Dados".'
      );
      localStorage.setItem("firstRun", "false");
    }, 1000);
  }
});

// Carregar dados (tentando API primeiro, com fallback para localStorage)
async function loadData() {
  try {
    // Tentar carregar da API REST
    if (typeof API !== 'undefined' && API.toners && API.toners.getAll) {
      try {
        const apiData = await API.toners.getAll();
        if (Array.isArray(apiData) && apiData.length > 0) {
          currentData = apiData;
          saveData(currentData);
          filteredData = [...currentData];
          console.log(`✅ ${currentData.length} toners carregados via API REST`);
          return currentData;
        }
      } catch (apiError) {
        console.warn('⚠️ API indisponível ou vazia, utilizando fallback para localStorage:', apiError.message);
      }
    }

    // Fallback: Carregar do localStorage usando função existente do data.js
    currentData = getData();
    
    // Se não houver dados, usar dados padrão do data.js
    if (!currentData || currentData.length === 0) {
      if (typeof initialData !== 'undefined' && initialData.length > 0) {
        currentData = [...initialData];
        saveData(currentData);
        console.log(`✅ ${currentData.length} toners carregados dos dados padrão`);
      } else {
        currentData = [];
        console.log('⚠️ Nenhum dado disponível');
      }
    } else {
      console.log(`✅ ${currentData.length} toners carregados do localStorage`);
    }
    
    filteredData = [...currentData];
    return currentData;
  } catch (error) {
    console.error('❌ Erro ao carregar dados:', error);
    currentData = [];
    filteredData = [];
    return currentData;
  }
}

// Configurar event listeners
function setupEventListeners() {
  // Busca
  document
    .getElementById("searchInput")
    .addEventListener("input", handleSearch);

  // Filtros
  document
    .getElementById("marcaFilter")
    .addEventListener("change", handleFilter);
  document
    .getElementById("statusFilter")
    .addEventListener("change", handleFilter);

  // Botões
  document.getElementById("addBtn").addEventListener("click", openAddModal);
  document.getElementById("exportBtn").addEventListener("click", exportData);
  document
    .getElementById("importBtn")
    .addEventListener("click", () =>
      document.getElementById("importFile").click()
    );
  document.getElementById("importFile").addEventListener("change", importData);
  document
    .getElementById("clearFiltersBtn")
    .addEventListener("click", clearFilters);
  document
    .getElementById("exportFilteredBtn")
    .addEventListener("click", exportFilteredData);

  // Botões de PDF
  document.getElementById('pdfReportBtn').addEventListener('click', gerarRelatorioPedidosPDF);

  // Modal
  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("cancelBtn").addEventListener("click", closeModal);
  document.getElementById("saveBtn").addEventListener("click", saveItem);

  // Fechar modal clicando fora - DESATIVADO A PEDIDO DO USUÁRIO
  /* window.addEventListener("click", function (event) {
    const modal = document.getElementById("modal");
    if (event.target === modal) {
      closeModal();
    }
  }); */
}

// Busca
function handleSearch() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  applyFilters();
}

// Filtros
function handleFilter() {
  applyFilters();
}

function applyFilters() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  const marcaFilter = document.getElementById("marcaFilter").value;
  const statusFilter = document.getElementById("statusFilter").value;

  filteredData = currentData.filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.marca.toLowerCase().includes(searchTerm) ||
      item.modelo.toLowerCase().includes(searchTerm) ||
      item.toner.toLowerCase().includes(searchTerm);

    const matchesMarca = !marcaFilter || item.marca === marcaFilter;

    const matchesStatus =
      !statusFilter ||
      (statusFilter === "sim" && item.realizarPedido) ||
      (statusFilter === "nao" && !item.realizarPedido);

    return matchesSearch && matchesMarca && matchesStatus;
  });

  renderTable();
  updateStats();
}

// Renderizar tabela
function renderTable() {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  if (filteredData.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <p style="padding: 2rem; color: #6c757d;">
                        Nenhum registro encontrado
                    </p>
                </td>
            </tr>
        `;
    return;
  }

  filteredData.forEach((item) => {
    const row = document.createElement("tr");

    // Adicionar classes para alertas de estoque
    if (item.quantidade === 0) {
      row.classList.add("estoque-zero");
    } else if (item.quantidade <= item.estoqueMinimo) {
      row.classList.add("estoque-baixo");
    }

    row.innerHTML = `
            <td>${item.marca}</td>
            <td>${item.modelo}</td>
            <td>${item.toner}</td>
            <td class="text-center">${item.quantidade}</td>
            <td class="text-center">
                <span class="status-${item.realizarPedido ? "sim" : "nao"}">
                    ${item.realizarPedido ? "SIM" : "NÃO"}
                </span>
            </td>
            <td class="text-center">
                <button class="btn btn-warning btn-small" onclick="editItem(${
                  item.id
                })">
                    Editar
                </button>
                <button class="btn btn-danger btn-small" onclick="deleteItem(${
                  item.id
                })">
                    Excluir
                </button>
            </td>
        `;

    tbody.appendChild(row);
  });
}

// Atualizar estatísticas
// Atualizar estatísticas e auto-marcar pedidos
async function updateStats() {
  // Auto-marcar pedido para itens com quantidade <= 3
  currentData.forEach((item, index) => {
    const shouldOrder = item.quantidade <= 3;
    
    // Se mudou e não foi alteração manual recente
    if (item.realizarPedido !== shouldOrder) {
      const manualKey = `${item.id || index}_realizarPedido`;
      const manualChange = manualChanges.get(manualKey);
      const isRecentManual = manualChange && (Date.now() - manualChange) < 60000; // 1 minuto
      
      if (!isRecentManual) {
        item.realizarPedido = shouldOrder;
      }
    }
  });
  
  saveData(currentData);
}

// Abrir modal para adicionar
function openAddModal() {
  editingId = null;
  document.getElementById("modalTitle").textContent = "Adicionar Toner";
  document.getElementById("itemForm").reset();
  document.getElementById("modal").style.display = "block";
  populateMarcaOptions();
}

// Editar item
function editItem(id) {
  const item = currentData.find((i) => i.id === id);
  if (!item) return;

  editingId = id;
  document.getElementById("modalTitle").textContent = "Editar Toner";

  document.getElementById("marca").value = item.marca;
  document.getElementById("modelo").value = item.modelo;
  document.getElementById("toner").value = item.toner;
  document.getElementById("quantidade").value = item.quantidade;
  document.getElementById("estoqueMinimo").value = item.estoqueMinimo;
  document.getElementById("realizarPedido").checked = item.realizarPedido;

  document.getElementById("modal").style.display = "block";
  populateMarcaOptions();
}

// Excluir item
async function deleteItem(id) {
  if (confirm("Tem certeza que deseja excluir este item?")) {
    try {
      await API.toners.delete(id);
      await loadData();
      applyFilters();
      showSuccessMessage('Toner excluído com sucesso!');
      window.dispatchEvent(new Event('dataChanged'));
    } catch (error) {
      console.warn('⚠️ API indisponível, salvando no localStorage');
      // Fallback para localStorage
      currentData = currentData.filter((item) => item.id !== id);
      saveData(currentData);
      filteredData = [...currentData];
      applyFilters();
      showSuccessMessage('Toner excluído (localStorage)');
      window.dispatchEvent(new Event('dataChanged'));
    }
  }
}

// Salvar item
async function saveItem() {
  const form = document.getElementById("itemForm");
  const formData = new FormData(form);

  const item = {
    marca: formData.get("marca").trim(),
    modelo: formData.get("modelo").trim(),
    toner: formData.get("toner").trim(),
    quantidade: parseInt(formData.get("quantidade")) || 0,
    estoqueMinimo: parseInt(formData.get("estoqueMinimo")) || 5,
    realizarPedido: formData.has("realizarPedido"),
  };

  // Validação
  if (!item.marca || !item.modelo || !item.toner) {
    alert("Por favor, preencha todos os campos obrigatórios.");
    return;
  }

  try {
    if (editingId) {
      await API.toners.update(editingId, item);
      showSuccessMessage('Toner atualizado com sucesso!');
    } else {
      await API.toners.create(item);
      showSuccessMessage('Toner adicionado com sucesso!');
    }

    await loadData();
    populateMarcaOptions();
    applyFilters();
    closeModal();
  } catch (error) {
    console.warn('⚠️ API indisponível, salvando no localStorage');
    // Fallback para localStorage
    let itemId;
    if (editingId) {
      const index = currentData.findIndex((i) => i.id === editingId);
      if (index !== -1) {
        currentData[index] = { ...item, id: editingId };
        itemId = editingId;
      }
    } else {
      const newId = Math.max(...currentData.map((i) => i.id), 0) + 1;
      currentData.push({ ...item, id: newId });
      itemId = newId;
    }

    // ATUALIZAÇÃO EM MASSA: Sincronizar quantidade para todos os toners iguais
    const targetToner = item.toner;
    const targetQty = item.quantidade;
    const targetRealizarPedido = item.realizarPedido;

    currentData.forEach(d => {
        if (d.toner === targetToner) {
            d.quantidade = targetQty;
            // Atualizar status de pedido com base na nova quantidade ou na escolha manual
            // Se o usuário marcou/desmarcou manualmente no form, aplicamos a todos?
            // "alterasse a quantidade para todos" foi o pedido. 
            // Vamos sincronizar também o realizarPedido para consistência se a quantidade desencadear
            d.realizarPedido = targetRealizarPedido; 
            
            // Opcional: Recalcular baseado no estoque minimo se preferir automação total
            // d.realizarPedido = d.quantidade <= d.estoqueMinimo;
        }
    });
    
    saveData(currentData);
    filteredData = [...currentData];
    populateMarcaOptions();
    applyFilters();
    closeModal();
    
    const action = editingId ? "atualizado" : "adicionado";
    showSuccessMessage(`Toner ${action} (localStorage)`);
  }
}

// Fechar modal
function closeModal() {
  document.getElementById("modal").style.display = "none";
  editingId = null;
}

// Popular opções de marca no filtro
function populateMarcaOptions() {
  const marcas = [...new Set(currentData.map((item) => item.marca))].sort();
  const marcaFilter = document.getElementById("marcaFilter");

  // Manter a opção "Todas"
  const currentValue = marcaFilter.value;
  marcaFilter.innerHTML = '<option value="">Todas as marcas</option>';

  marcas.forEach((marca) => {
    const option = document.createElement("option");
    option.value = marca;
    option.textContent = marca;
    marcaFilter.appendChild(option);
  });

  marcaFilter.value = currentValue;
}

// Exportar dados
function exportData() {
  const dataStr = JSON.stringify(currentData, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(dataBlob);
  link.download = `toners_backup_${
    new Date().toISOString().split("T")[0]
  }.json`;
  link.click();
}

// Exportar apenas os dados filtrados
function exportFilteredData() {
  const dataStr = JSON.stringify(filteredData, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(dataBlob);
  link.download = `toners_solicitacao_${
    new Date().toISOString().split("T")[0]
  }.json`;
  link.click();
}

// Importar dados
function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const importedData = JSON.parse(e.target.result);

      // Validar estrutura dos dados importados
      if (!Array.isArray(importedData)) {
        throw new Error("Formato de dados inválido");
      }

      // Validar cada item
      const validatedData = importedData.map((item, index) => {
        if (!item.marca || !item.modelo || !item.toner) {
          throw new Error(
            `Item ${index + 1} possui campos obrigatórios em branco`
          );
        }

        return {
          id: item.id || index + 1,
          marca: String(item.marca).trim(),
          modelo: String(item.modelo).trim(),
          toner: String(item.toner).trim(),
          quantidade: parseInt(item.quantidade) || 0,
          estoqueMinimo: parseInt(item.estoqueMinimo) || 5,
          realizarPedido: Boolean(item.realizarPedido),
        };
      });

      if (
        confirm("Isso substituirá todos os dados atuais. Deseja continuar?")
      ) {
        // Limpar alterações manuais anteriores
        manualChanges.clear();

        currentData = validatedData;
        saveData(currentData);
        loadData();
        applyFilters();
        populateMarcaOptions();
        alert("Dados importados com sucesso!");
      }
    } catch (error) {
      alert(`Erro ao importar arquivo: ${error.message}`);
      console.error("Erro na importação:", error);
    }
  };
  reader.readAsText(file);

  // Limpar input
  event.target.value = "";
}

// Função para atualizar automaticamente o status de pedido baseado na quantidade
function updatePedidoStatus() {
  let updated = false;
  const now = Date.now();
  const MANUAL_CHANGE_PROTECTION_TIME = 30000; // 30 segundos de proteção após alteração manual

  currentData.forEach((item) => {
    // Verificar se houve alteração manual recente
    const lastManualChange = manualChanges.get(item.id);
    const isRecentlyModified =
      lastManualChange &&
      now - lastManualChange < MANUAL_CHANGE_PROTECTION_TIME;

    // Só atualizar automaticamente se não houve alteração manual recente
    if (!isRecentlyModified) {
      const shouldOrder = item.quantidade <= item.estoqueMinimo;
      if (item.realizarPedido !== shouldOrder) {
        item.realizarPedido = shouldOrder;
        updated = true;
      }
    }
  });

  if (updated) {
    try {
      saveData(currentData);
      loadData();
      applyFilters();
    } catch (error) {
      console.error("Erro na atualização automática:", error);
    }
  }

  // Limpar alterações manuais antigas (mais de 5 minutos)
  const OLD_CHANGE_THRESHOLD = 300000; // 5 minutos
  for (const [itemId, timestamp] of manualChanges.entries()) {
    if (now - timestamp > OLD_CHANGE_THRESHOLD) {
      manualChanges.delete(itemId);
    }
  }
}

// Limpar filtros
function clearFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("marcaFilter").value = "";
  document.getElementById("statusFilter").value = "";
  applyFilters();
}

// Funções de feedback visual
function showSuccessMessage(message) {
  // Usar alert por enquanto, mas pode ser melhorado com toast notifications
  setTimeout(() => {
    alert(message);
  }, 100);
}

function showErrorMessage(message) {
  alert(message);
}

// Executar atualização automática a cada 5 segundos
setInterval(updatePedidoStatus, 5000);
