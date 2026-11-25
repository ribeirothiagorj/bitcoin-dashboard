// charts.js — só cuida de desenhar e atualizar gráficos (com Chart.js).
// Não busca dados: recebe a lista pronta de quem chamar.

import { formatarMoeda, formatarMoedaCurta, formatarData, formatarDataHora } from './utils.js';

// Guarda os gráficos já criados, pelo id do <canvas>.
// Assim, na segunda vez, ATUALIZAMOS o gráfico em vez de criar outro por cima.
const graficosCriados = new Map();

// Lê uma cor do CSS (ex.: '--cor-serie'). As cores ficam só no style.css.
function lerCor(nomeVariavel) {
  return getComputedStyle(document.documentElement).getPropertyValue(nomeVariavel).trim();
}

// Plugin (um "acessório" do Chart.js) que desenha uma linha vertical
// onde o mouse está, para facilitar ler o ponto exato.
const pluginLinhaVertical = {
  id: 'linhaVertical',
  afterDatasetsDraw(grafico) {
    const pontoAtivo = grafico.tooltip?.getActiveElements()[0];
    if (!pontoAtivo) return;

    const { ctx, chartArea } = grafico;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pontoAtivo.element.x, chartArea.top);
    ctx.lineTo(pontoAtivo.element.x, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = lerCor('--cor-eixo');
    ctx.stroke();
    ctx.restore();
  },
};

// Formato das datas no eixo X, conforme a escala de tempo
const FORMATOS_DATA = {
  hour: 'HH:mm',
  day: 'dd/MM',
  week: 'dd/MM',
  month: 'MM/yy',
};

function montarConfiguracao(pontos, estado, opcoes) {
  const corSerie = lerCor('--cor-serie');
  const corTexto = lerCor('--texto-secundario');
  const corGrade = lerCor('--cor-grade');

  return {
    type: 'line',
    data: {
      datasets: [{
        label: 'Preço do Bitcoin',
        data: pontos,
        borderColor: corSerie,
        borderWidth: 2,
        pointRadius: 0,              // sem bolinhas em cada ponto (fica mais limpo)
        pointHoverRadius: 5,         // bolinha só no ponto do mouse
        pointHoverBackgroundColor: corSerie,
        pointHoverBorderColor: lerCor('--fundo-painel'),
        pointHoverBorderWidth: 2,
        tension: 0.2,                // curva levemente suave
        // 'start' = pinta da linha até a base do gráfico (o eixo Y não começa no zero)
        fill: opcoes.preencher ? 'start' : false,
        backgroundColor: corSerie + '22', // mesma cor + "22" no fim = bem transparente
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,    // usa a altura definida no CSS
      animation: { duration: 400 },
      // Mouse em qualquer lugar do gráfico mostra o ponto mais próximo na horizontal
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          type: 'time',
          time: { unit: opcoes.unidadeTempo, displayFormats: FORMATOS_DATA },
          grid: { display: false },
          ticks: { color: corTexto, maxTicksLimit: 8 },
        },
        y: {
          // Não começa no zero: queremos ver a VARIAÇÃO do preço
          grid: { color: corGrade },
          border: { display: false },
          ticks: {
            color: corTexto,
            maxTicksLimit: 6,
            callback: (valor) => formatarMoedaCurta(valor, estado.moeda),
          },
        },
      },
      plugins: {
        legend: { display: false }, // só uma linha: o título do painel já diz o que é
        tooltip: {
          displayColors: false,
          callbacks: {
            // Hora só faz sentido quando há vários pontos por dia (escala de horas/dias)
            title: (itens) => {
              const data = itens[0].parsed.x;
              return estado.unidadeTempo === 'month' ? formatarData(data) : formatarDataHora(data);
            },
            label: (item) => formatarMoeda(item.parsed.y, estado.moeda),
          },
        },
      },
    },
    plugins: [pluginLinhaVertical],
  };
}

/**
 * Cria (na primeira vez) ou atualiza (nas próximas) um gráfico de preço.
 *
 * @param {string} idCanvas  id do <canvas> no HTML (ex.: 'grafico-semanal')
 * @param {Array}  dados     lista [{ data, preco }, ...] vinda do api.js
 * @param {Object} opcoes    { moeda: 'usd', preencher: false, unidadeTempo: 'day' }
 */
export function desenharGraficoPreco(idCanvas, dados, opcoes = {}) {
  const opcoesCompletas = { moeda: 'usd', preencher: false, unidadeTempo: undefined, ...opcoes };

  // O Chart.js entende pontos no formato { x, y }
  const pontos = dados.map((ponto) => ({ x: ponto.data, y: ponto.preco }));

  const existente = graficosCriados.get(idCanvas);
  if (existente) {
    existente.estado.moeda = opcoesCompletas.moeda;
    existente.estado.unidadeTempo = opcoesCompletas.unidadeTempo;
    existente.grafico.data.datasets[0].data = pontos;
    existente.grafico.options.scales.x.time.unit = opcoesCompletas.unidadeTempo;
    existente.grafico.update();
    return;
  }

  // "estado" guarda o que pode mudar depois (moeda, escala), lido pelas formatações
  const estado = { moeda: opcoesCompletas.moeda, unidadeTempo: opcoesCompletas.unidadeTempo };
  const canvas = document.getElementById(idCanvas);
  const grafico = new window.Chart(canvas, montarConfiguracao(pontos, estado, opcoesCompletas));

  graficosCriados.set(idCanvas, { grafico, estado });
}
