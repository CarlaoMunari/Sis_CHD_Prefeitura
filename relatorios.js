// ============================================
// RELATORIOS.JS - Geracao de PDFs de Chamados
// Prefeitura Municipal de Guaraci - SP
// ============================================

Auth.requireAuth(['ADMIN', 'SUPER_ADMIN']);

let allTickets = [];
let chartStatus = null;
let chartCat    = null;
let chartDepto  = null;
let chartLine   = null;

// ── Constantes visuais ───────────────────────────────────────────────────────
const COLORS_PALETTE = [
  '#667eea','#f6ad55','#68d391','#fc8181','#76e4f7',
  '#b794f4','#f687b3','#4fd1c5','#f6e05e','#a0aec0'
];

const STATUS_LABELS = {
  ABERTO:            'Aberto',
  EM_ATENDIMENTO:    'Em Atendimento',
  AGUARDANDO_PECAS:  'Aguardando Pecas',
  FINALIZADO:        'Finalizado',
  CANCELADO:         'Cancelado'
};

// ── Inicializacao ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await carregarChamados();
});

async function carregarChamados() {
  try {
    const res = await fetch('/api/tickets', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    if (!res.ok) throw new Error('Erro ao carregar chamados');
    allTickets = await res.json();
    atualizarContadores();
    renderizarGraficos();
  } catch (err) {
    mostrarFeedback('Erro ao carregar dados: ' + err.message, 'error');
  }
}

// ── Utilitarios ──────────────────────────────────────────────────────────────
function mostrarLoading(show) {
  const el = document.getElementById('loadingOverlay');
  if (show) el.classList.add('active');
  else el.classList.remove('active');
}

function mostrarFeedback(msg, tipo) {
  const el = document.getElementById('feedbackBar');
  el.textContent = msg;
  el.className = 'feedback-bar ' + tipo;
  setTimeout(() => { el.className = 'feedback-bar'; }, 5000);
}

function filtrarPorDatas(tickets, dataInicioId, dataFimId) {
  const di = document.getElementById(dataInicioId).value;
  const df = document.getElementById(dataFimId).value;
  return tickets.filter(t => {
    const dt = new Date(t.dataAbertura);
    if (di && dt < new Date(di)) return false;
    if (df && dt > new Date(df + 'T23:59:59')) return false;
    return true;
  });
}

function formatarData(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function calcularTempo(t1, t2) {
  if (!t1 || !t2) return '-';
  const diff = Math.abs(new Date(t2) - new Date(t1));
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

// ── Contadores dos cards ──────────────────────────────────────────────────────
function atualizarContadores() {
  const abertos     = allTickets.filter(t => ['ABERTO','EM_ATENDIMENTO','AGUARDANDO_PECAS'].includes(t.status));
  const finalizados = allTickets.filter(t => ['FINALIZADO','CANCELADO'].includes(t.status));
  const cats  = new Set(allTickets.map(t => t.categoria)).size;
  const deptos= new Set(allTickets.map(t => t.solicitanteDepartamento)).size;

  document.getElementById('countAbertos').textContent     = `⏳ ${abertos.length} chamados`;
  document.getElementById('countFinalizados').textContent = `✅ ${finalizados.length} chamados`;
  document.getElementById('countCategorias').textContent  = `🏷️ ${cats} categorias`;
  document.getElementById('countDeptos').textContent      = `🏢 ${deptos} departamentos`;
}

// ── Graficos de Previa ────────────────────────────────────────────────────────
function renderizarGraficos() {
  if (allTickets.length === 0) return;
  document.getElementById('previewSection').classList.add('visible');

  // Status
  const statusCount = {};
  allTickets.forEach(t => {
    statusCount[t.status] = (statusCount[t.status] || 0) + 1;
  });

  if (chartStatus) chartStatus.destroy();
  chartStatus = new Chart(document.getElementById('previewStatusChart'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(statusCount).map(k => STATUS_LABELS[k] || k),
      datasets: [{ data: Object.values(statusCount), backgroundColor: COLORS_PALETTE }]
    },
    options: { plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, responsive: true }
  });

  // Categoria
  const catCount = {};
  allTickets.forEach(t => {
    catCount[t.categoria] = (catCount[t.categoria] || 0) + 1;
  });

  if (chartCat) chartCat.destroy();
  chartCat = new Chart(document.getElementById('previewCatChart'), {
    type: 'bar',
    data: {
      labels: Object.keys(catCount).map(k => k.length > 22 ? k.substring(0, 20) + '...' : k),
      datasets: [{ label: 'Chamados', data: Object.values(catCount), backgroundColor: COLORS_PALETTE }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      responsive: true,
      scales: { x: { beginAtZero: true } }
    }
  });

  // Departamento
  const deptoCount = {};
  allTickets.forEach(t => {
    const d = t.solicitanteDepartamento || 'GERAL';
    deptoCount[d] = (deptoCount[d] || 0) + 1;
  });

  if (chartDepto) chartDepto.destroy();
  chartDepto = new Chart(document.getElementById('previewDeptoChart'), {
    type: 'pie',
    data: {
      labels: Object.keys(deptoCount),
      datasets: [{ data: Object.values(deptoCount), backgroundColor: COLORS_PALETTE }]
    },
    options: { plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, responsive: true }
  });

  // Timeline Abertos vs Finalizados (ultimos 30 dias)
  const hoje = new Date();
  const dias = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().split('T')[0];
  });

  const abPorDia  = dias.map(d => allTickets.filter(t => t.dataAbertura && t.dataAbertura.startsWith(d)).length);
  const finPorDia = dias.map(d => allTickets.filter(t => t.dataFinalizacao && t.dataFinalizacao.startsWith(d)).length);

  if (chartLine) chartLine.destroy();
  chartLine = new Chart(document.getElementById('previewTimelineChart'), {
    type: 'line',
    data: {
      labels: dias.map(d => {
        const p = d.split('-');
        return `${p[2]}/${p[1]}`;
      }),
      datasets: [
        { label: 'Abertos', data: abPorDia, borderColor: '#f6ad55', backgroundColor: 'rgba(246,173,85,.15)', tension: 0.3, fill: true },
        { label: 'Finalizados', data: finPorDia, borderColor: '#68d391', backgroundColor: 'rgba(104,211,145,.15)', tension: 0.3, fill: true }
      ]
    },
    options: {
      plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
      responsive: true,
      scales: { x: { ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: true } }
    }
  });
}

// ── Cabecalho padrao PDF ──────────────────────────────────────────────────────
function addHeaderPDF(doc, titulo, subtitulo) {
  const W = doc.internal.pageSize.width;
  doc.setFillColor(0, 43, 127);
  doc.rect(0, 0, W, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PREFEITURA MUNICIPAL DE GUARACI - SP', W / 2, 16, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(titulo, W / 2, 26, { align: 'center' });
  if (subtitulo) doc.text(subtitulo, W / 2, 33, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const hora  = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  doc.setFontSize(9);
  doc.text(`Gerado em: ${hoje} as ${hora}`, 15, 48);
  doc.text(`Responsavel: ${Auth.getUser().nome || Auth.getUser().login}`, 15, 54);
  return 62; // Y de inicio do conteudo
}

function addFooterPDF(doc, pageNum, totalPages) {
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(160);
  doc.text(`Pagina ${pageNum} de ${totalPages}`, W / 2, H - 10, { align: 'center' });
  doc.text('Prefeitura Municipal de Guaraci - SP | Departamento de TI', W / 2, H - 6, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

function finalizarPDF(doc, nome) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    addFooterPDF(doc, i, total);
  }
  doc.save(nome);
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  RELATORIO 1 - CHAMADOS ABERTOS                                         ║
// ╚══════════════════════════════════════════════════════════════════════════╝
async function gerarRelatorioAbertos() {
  mostrarLoading(true);
  try {
    const filtrados = filtrarPorDatas(
      allTickets.filter(t => ['ABERTO','EM_ATENDIMENTO','AGUARDANDO_PECAS'].includes(t.status)),
      'dataInicioAbertos', 'dataFimAbertos'
    );

    if (filtrados.length === 0) {
      mostrarFeedback('Nenhum chamado aberto encontrado no periodo selecionado.', 'error');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    const startY = addHeaderPDF(doc,
      'Relatorio de Chamados Abertos',
      `Total: ${filtrados.length} chamado(s)`
    );

    // Totais por status
    const por = { ABERTO: 0, EM_ATENDIMENTO: 0, AGUARDANDO_PECAS: 0 };
    filtrados.forEach(t => { if (por[t.status] !== undefined) por[t.status]++; });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Aberto: ${por.ABERTO}   Em Atendimento: ${por.EM_ATENDIMENTO}   Aguardando Pecas: ${por.AGUARDANDO_PECAS}`, 15, startY);

    doc.autoTable({
      startY: startY + 8,
      head: [['Codigo', 'Data Abertura', 'Solicitante', 'Departamento', 'Categoria', 'Prioridade', 'Status']],
      body: filtrados.map(t => [
        t.codigo,
        formatarData(t.dataAbertura),
        t.solicitanteNome,
        t.solicitanteDepartamento || 'GERAL',
        t.categoria,
        t.prioridade || 'NORMAL',
        STATUS_LABELS[t.status] || t.status
      ]),
      theme: 'striped',
      headStyles: { fillColor: [193, 122, 5], textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 36 },
        2: { cellWidth: 40 },
        3: { cellWidth: 30 },
        4: { cellWidth: 55 },
        5: { cellWidth: 22, halign: 'center' },
        6: { cellWidth: 30, halign: 'center' }
      },
      alternateRowStyles: { fillColor: [255, 253, 240] }
    });

    finalizarPDF(doc, `chamados-abertos-${new Date().toISOString().split('T')[0]}.pdf`);
    mostrarFeedback(`PDF gerado com sucesso! ${filtrados.length} chamados abertos.`, 'success');
  } catch (e) {
    mostrarFeedback('Erro ao gerar PDF: ' + e.message, 'error');
  } finally {
    mostrarLoading(false);
  }
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  RELATORIO 2 - CHAMADOS FINALIZADOS                                     ║
// ╚══════════════════════════════════════════════════════════════════════════╝
async function gerarRelatorioFinalizados() {
  mostrarLoading(true);
  try {
    const filtrados = filtrarPorDatas(
      allTickets.filter(t => ['FINALIZADO','CANCELADO'].includes(t.status)),
      'dataInicioFinalizados', 'dataFimFinalizados'
    );

    if (filtrados.length === 0) {
      mostrarFeedback('Nenhum chamado finalizado encontrado no periodo selecionado.', 'error');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    const startY = addHeaderPDF(doc,
      'Relatorio de Chamados Finalizados',
      `Total: ${filtrados.length} chamado(s)`
    );

    const finalizados = filtrados.filter(t => t.status === 'FINALIZADO').length;
    const cancelados  = filtrados.filter(t => t.status === 'CANCELADO').length;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Finalizados: ${finalizados}   Cancelados: ${cancelados}`, 15, startY);

    doc.autoTable({
      startY: startY + 8,
      head: [['Codigo', 'Abertura', 'Finalizacao', 'Tempo', 'Solicitante', 'Departamento', 'Categoria', 'Status']],
      body: filtrados.map(t => [
        t.codigo,
        formatarData(t.dataAbertura),
        formatarData(t.dataFinalizacao),
        calcularTempo(t.dataAbertura, t.dataFinalizacao),
        t.solicitanteNome,
        t.solicitanteDepartamento || 'GERAL',
        t.categoria,
        STATUS_LABELS[t.status] || t.status
      ]),
      theme: 'striped',
      headStyles: { fillColor: [34, 84, 61], textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 32 },
        2: { cellWidth: 32 },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 38 },
        5: { cellWidth: 28 },
        6: { cellWidth: 52 },
        7: { cellWidth: 22, halign: 'center' }
      },
      alternateRowStyles: { fillColor: [240, 255, 244] }
    });

    finalizarPDF(doc, `chamados-finalizados-${new Date().toISOString().split('T')[0]}.pdf`);
    mostrarFeedback(`PDF gerado com sucesso! ${filtrados.length} chamados finalizados.`, 'success');
  } catch (e) {
    mostrarFeedback('Erro ao gerar PDF: ' + e.message, 'error');
  } finally {
    mostrarLoading(false);
  }
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  RELATORIO 3 - CHAMADOS POR CATEGORIA                                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝
async function gerarRelatorioCategoria() {
  mostrarLoading(true);
  try {
    const filtrados = filtrarPorDatas(allTickets, 'dataInicioCategoria', 'dataFimCategoria');
    if (filtrados.length === 0) {
      mostrarFeedback('Nenhum chamado encontrado no periodo selecionado.', 'error');
      return;
    }

    // Agrupar
    const grupos = {};
    filtrados.forEach(t => {
      if (!grupos[t.categoria]) grupos[t.categoria] = [];
      grupos[t.categoria].push(t);
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait' });
    const W = doc.internal.pageSize.width;
    let startY = addHeaderPDF(doc, 'Relatorio de Chamados por Categoria', `Total: ${filtrados.length} chamado(s) em ${Object.keys(grupos).length} categoria(s)`);

    // Tabela-resumo de categorias
    doc.autoTable({
      startY,
      head: [['Categoria', 'Total', 'Abertos', 'Finalizados', 'Cancelados', '%']],
      body: Object.entries(grupos).sort((a,b) => b[1].length - a[1].length).map(([cat, itens]) => [
        cat,
        itens.length,
        itens.filter(t => ['ABERTO','EM_ATENDIMENTO','AGUARDANDO_PECAS'].includes(t.status)).length,
        itens.filter(t => t.status === 'FINALIZADO').length,
        itens.filter(t => t.status === 'CANCELADO').length,
        `${((itens.length / filtrados.length) * 100).toFixed(1)}%`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [107, 70, 193], textColor: 255, fontSize: 10, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 18, halign: 'center' }
      },
      alternateRowStyles: { fillColor: [248, 240, 255] }
    });

    startY = doc.lastAutoTable.finalY + 12;

    // Detalhe de cada categoria
    for (const [cat, itens] of Object.entries(grupos)) {
      // Verificar espaco na pagina
      if (startY > 240) { doc.addPage(); startY = 20; }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(107, 70, 193);
      doc.text(`Categoria: ${cat} (${itens.length} chamado(s))`, 15, startY);
      doc.setTextColor(0, 0, 0);
      startY += 5;

      doc.autoTable({
        startY,
        head: [['Codigo', 'Data', 'Solicitante', 'Departamento', 'Status']],
        body: itens.map(t => [
          t.codigo,
          formatarData(t.dataAbertura),
          t.solicitanteNome,
          t.solicitanteDepartamento || 'GERAL',
          STATUS_LABELS[t.status] || t.status
        ]),
        theme: 'grid',
        headStyles: { fillColor: [180, 160, 220], textColor: 50, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 42 },
          2: { cellWidth: 50 },
          3: { cellWidth: 35 },
          4: { cellWidth: 30, halign: 'center' }
        }
      });

      startY = doc.lastAutoTable.finalY + 10;
    }

    finalizarPDF(doc, `chamados-por-categoria-${new Date().toISOString().split('T')[0]}.pdf`);
    mostrarFeedback(`PDF gerado com sucesso! ${Object.keys(grupos).length} categorias.`, 'success');
  } catch (e) {
    mostrarFeedback('Erro ao gerar PDF: ' + e.message, 'error');
  } finally {
    mostrarLoading(false);
  }
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  RELATORIO 4 - CHAMADOS POR DEPARTAMENTO                                ║
// ╚══════════════════════════════════════════════════════════════════════════╝
async function gerarRelatorioDepto() {
  mostrarLoading(true);
  try {
    const filtrados = filtrarPorDatas(allTickets, 'dataInicioDepto', 'dataFimDepto');
    if (filtrados.length === 0) {
      mostrarFeedback('Nenhum chamado encontrado no periodo selecionado.', 'error');
      return;
    }

    // Agrupar por departamento
    const grupos = {};
    filtrados.forEach(t => {
      const d = t.solicitanteDepartamento || 'GERAL';
      if (!grupos[d]) grupos[d] = [];
      grupos[d].push(t);
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait' });
    let startY = addHeaderPDF(doc, 'Relatorio de Chamados por Departamento', `Total: ${filtrados.length} chamado(s) em ${Object.keys(grupos).length} departamento(s)`);

    // Tabela-resumo por departamento
    doc.autoTable({
      startY,
      head: [['Departamento', 'Total', 'Abertos', 'Em Atend.', 'Ag. Pecas', 'Finalizados', 'Cancelados', '%']],
      body: Object.entries(grupos).sort((a,b) => b[1].length - a[1].length).map(([depto, itens]) => [
        depto,
        itens.length,
        itens.filter(t => t.status === 'ABERTO').length,
        itens.filter(t => t.status === 'EM_ATENDIMENTO').length,
        itens.filter(t => t.status === 'AGUARDANDO_PECAS').length,
        itens.filter(t => t.status === 'FINALIZADO').length,
        itens.filter(t => t.status === 'CANCELADO').length,
        `${((itens.length / filtrados.length) * 100).toFixed(1)}%`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [43, 108, 176], textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: {
        0: { cellWidth: 48 },
        1: { cellWidth: 14, halign: 'center' },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' },
        6: { cellWidth: 18, halign: 'center' },
        7: { cellWidth: 15, halign: 'center' }
      },
      alternateRowStyles: { fillColor: [235, 245, 255] }
    });

    startY = doc.lastAutoTable.finalY + 12;

    // Detalhe de cada departamento
    for (const [depto, itens] of Object.entries(grupos)) {
      if (startY > 240) { doc.addPage(); startY = 20; }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(43, 108, 176);
      doc.text(`Departamento: ${depto} (${itens.length} chamado(s))`, 15, startY);
      doc.setTextColor(0, 0, 0);
      startY += 5;

      doc.autoTable({
        startY,
        head: [['Codigo', 'Data Abertura', 'Solicitante', 'Categoria', 'Status']],
        body: itens.map(t => [
          t.codigo,
          formatarData(t.dataAbertura),
          t.solicitanteNome,
          t.categoria,
          STATUS_LABELS[t.status] || t.status
        ]),
        theme: 'grid',
        headStyles: { fillColor: [160, 195, 230], textColor: 30, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 42 },
          2: { cellWidth: 45 },
          3: { cellWidth: 55 },
          4: { cellWidth: 30, halign: 'center' }
        }
      });

      startY = doc.lastAutoTable.finalY + 10;
    }

    finalizarPDF(doc, `chamados-por-departamento-${new Date().toISOString().split('T')[0]}.pdf`);
    mostrarFeedback(`PDF gerado com sucesso! ${Object.keys(grupos).length} departamentos.`, 'success');
  } catch (e) {
    mostrarFeedback('Erro ao gerar PDF: ' + e.message, 'error');
  } finally {
    mostrarLoading(false);
  }
}
