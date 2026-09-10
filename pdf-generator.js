// ============================================
// GERADOR DE PDFs - Sistema de Controle de Toners
// ============================================

/**
 * Gera relatório de pedidos em PDF
 * Lista todos os toners que precisam ser pedidos
 */
async function gerarRelatorioPedidosPDF() {
  try {
    // Mostrar loading
    const btn = document.getElementById('pdfReportBtn');
    btn.classList.add('pdf-loading');
    btn.disabled = true;

    // Filtrar toners que precisam pedido
    const tonersPedido = currentData.filter(item => item.realizarPedido);

    if (tonersPedido.length === 0) {
      alert('Não há toners que precisam pedido no momento.');
      return;
    }

    // Criar documento PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Configurações
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;

    // Cabeçalho Oficial - Prefeitura Municipal de Guaraci - SP
    doc.setFillColor(0, 43, 127);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('PREFEITURA MUNICIPAL DE GUARACI - SP', pageWidth / 2, 18, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Relatório de Pedidos de Suprimentos & Toners - TI', pageWidth / 2, 28, { align: 'center' });

    // Data
    const hoje = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${hoje}`, margin, 50);

    // Totalizadores
    const totalItens = tonersPedido.length;
    const estoqueZero = tonersPedido.filter(t => t.quantidade === 0).length;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de itens para pedido: ${totalItens}`, margin, 60);
    doc.text(`Itens com estoque zerado: ${estoqueZero}`, margin, 67);

    // Tabela (com cálculo de quantidade a pedir)
    const tableData = tonersPedido.map(item => {
      // Calcular quanto precisa pedir
      // Se qtd atual < estoque mínimo, pedir o suficiente para chegar ao mínimo + 1 de buffer
      const quantidadeAPedir = item.quantidade < item.estoqueMinimo 
        ? (item.estoqueMinimo - item.quantidade + 1) 
        : 0;
      
      return [
        item.marca,
        item.modelo,
        item.toner,
        quantidadeAPedir.toString(), // Quantidade a pedir
        item.quantidade === 0 ? 'URGENTE' : 'Baixo'
      ];
    });

    doc.autoTable({
      startY: 75,
      head: [['Marca', 'Modelo', 'Toner', 'Qtd a Pedir', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [102, 126, 234],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 30 },  // Marca
        1: { cellWidth: 40 },  // Modelo
        2: { cellWidth: 60 },  // Toner
        3: { cellWidth: 25, halign: 'center' },  // Qtd a Pedir
        4: { cellWidth: 25, halign: 'center' }   // Status
      },
      didDrawPage: function(data) {
        // Rodapé em cada página
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
          `Página ${data.pageNumber}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }
    });

    // Observações finais
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Observações:', margin, finalY);
    doc.setFont('helvetica', 'normal');
    doc.text('• Este relatório foi gerado automaticamente pelo sistema', margin + 5, finalY + 5);
    doc.text('• Verifique a disponibilidade dos fornecedores antes do pedido', margin + 5, finalY + 10);
    doc.text('• Itens marcados como URGENTE possuem estoque zerado', margin + 5, finalY + 15);

    // Salvar PDF
    doc.save(`relatorio-pedidos-${new Date().toISOString().split('T')[0]}.pdf`);

    showSuccessMessage(`PDF gerado com sucesso! ${totalItens} itens.`);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    showErrorMessage('Erro ao gerar PDF: ' + error.message);
  } finally {
    // Remover loading
    const btn = document.getElementById('pdfReportBtn');
    btn.classList.remove('pdf-loading');
    btn.disabled = false;
  }
}
