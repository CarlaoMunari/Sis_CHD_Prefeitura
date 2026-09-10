// ============================================
// DASHBOARD - Gráficos e Visualiz ações
// ============================================

class Dashboard {
  constructor() {
    this.charts = {
      brandPie: null,
      healthDonut: null,
    };
  }

  // Inicializar dashboard
  init() {
    console.log('📊 Inicializando Dashboard...');
    this.createCharts();
    this.updateDashboard();
    
    // Atualizar quando dados mudarem
    window.addEventListener('dataChanged', () => {
      console.log('📊 Dashboard: Atualizando gráficos...');
      this.updateDashboard();
    });
    
    console.log('✅ Dashboard inicializado!');
  }

  // Criar todos os gráficos
  createCharts() {
    this.createBrandPieChart();
    this.createHealthDonutChart();
  }

  // Gráfico de Pizza - Distribuição por Marca
  createBrandPieChart() {
    const ctx = document.getElementById('brandPieChart');
    if (!ctx) return;

    this.charts.brandPie = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [
            '#667eea', '#764ba2', '#f093fb', '#4facfe',
            '#43e97b', '#fa709a', '#fee140', '#30cfd0'
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 15, font: { size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  // Gráfico Donut - Saúde Geral
  createHealthDonutChart() {
    const ctx = document.getElementById('healthDonutChart');
    if (!ctx) return;

    this.charts.healthDonut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Críticos', 'Baixos', 'OK'],
        datasets: [{
          data: [0, 0, 0],
          backgroundColor: [
            'rgba(255, 68, 68, 0.8)',
            'rgba(255, 170, 0, 0.8)',
            'rgba(67, 233, 123, 0.8)'
          ],
          borderColor: '#fff',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 15, font: { size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return `${context.label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  // Atualizar todos os gráficos e widgets
  updateDashboard() {
    if (!currentData || currentData.length === 0) {
      console.log('ℹ️  Dashboard: Sem dados para exibir');
      return;
    }

    // Atualizar gráficos
    this.updateBrandPieChart();
    this.updateHealthDonutChart();

    // Atualizar widgets
    this.updateTopCriticalWidget();
    this.updateInsights();
  }

  // Atualizar Pizza de Marcas
  updateBrandPieChart() {
    if (!this.charts.brandPie) return;

    // Contar por marca
    const brandCounts = {};
    currentData.forEach(item => {
      brandCounts[item.marca] = (brandCounts[item.marca] || 0) + 1;
    });

    const labels = Object.keys(brandCounts);
    const data = Object.values(brandCounts);

    this.charts.brandPie.data.labels = labels;
    this.charts.brandPie.data.datasets[0].data = data;
    this.charts.brandPie.update();
  }

  // Atualizar Donut de Saúde
  updateHealthDonutChart() {
    if (!this.charts.healthDonut) return;

    const critical = currentData.filter(item => item.quantidade === 0).length;
    const low = currentData.filter(item => item.quantidade > 0 && item.quantidade <= item.estoqueMinimo).length;
    const ok = currentData.filter(item => item.quantidade > item.estoqueMinimo).length;

    this.charts.healthDonut.data.datasets[0].data = [critical, low, ok];
    this.charts.healthDonut.update();
  }

  // Widget - Top 10 Críticos
  updateTopCriticalWidget() {
    const widget = document.getElementById('topCriticalWidget');
    if (!widget) return;

    // Pegar itens zerados ou com quantidade baixa
    const itemsNeedOrder = currentData
      .filter(item => item.realizarPedido || item.quantidade === 0)
      .sort((a, b) => a.quantidade - b.quantidade)
      .slice(0, 10); // Mostrar até 10 itens

    let html = '';
    if (itemsNeedOrder.length === 0) {
      html = '<div style="text-align: center; padding: 20px; color: #48bb78;">✅ Todos os toners estão em estoque adequado!</div>';
    } else {
      itemsNeedOrder.forEach((item, index) => {
        html += `
          <div class="critical-item">
            <div class="critical-rank">#${index + 1}</div>
            <div class="critical-details">
              <div class="critical-name">${item.marca} ${item.modelo}</div>
              <div class="critical-qty">🔴 ZERADO</div>
            </div>
          </div>
        `;
      });
    }

    widget.innerHTML = html;
  }

  // Insights Bar
  updateInsights() {
    // Total que precisa pedido
    const needOrder = currentData.filter(item => item.realizarPedido).length;
    const pedidosEl = document.getElementById('insightPedidosCount');
    if (pedidosEl) pedidosEl.textContent = needOrder;

    // Marcas únicas
    const uniqueBrands = [...new Set(currentData.map(item => item.marca))].length;
    const marcasEl = document.getElementById('insightMarcasCount');
    if (marcasEl) marcasEl.textContent = uniqueBrands;
  }
}

// Instanciar dashboard global
const dashboard = new Dashboard();
