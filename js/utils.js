// utils.js — "caixa de ferramentas": funções pequenas reutilizadas no site todo.
// Nenhuma delas mexe na página nem na internet: recebem um valor e devolvem outro.
// Isso as torna fáceis de testar.

// Criar um formatador é "caro"; por isso criamos uma vez e guardamos aqui.
const formatadoresMoeda = {
  usd: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }),
  brl: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
};

// Versão sem centavos, para espaços pequenos (como o eixo dos gráficos)
const formatadoresMoedaCurta = {
  usd: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
  brl: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
};

// Versão compacta, para números enormes (como o volume): "US$ 35,6 bi"
const formatadoresMoedaCompacta = {
  usd: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }),
  brl: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }),
};

const formatadorPercentual = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero', // mostra "+" nos positivos e "−" nos negativos
});

/** 60296 → "US$ 60.296,00" (ou "R$ ..." se moeda = 'brl') */
export function formatarMoeda(valor, moeda = 'usd') {
  return formatadoresMoeda[moeda].format(valor);
}

/** 60296.78 → "US$ 60.297" (sem centavos) */
export function formatarMoedaCurta(valor, moeda = 'usd') {
  return formatadoresMoedaCurta[moeda].format(valor);
}

/** 35635096197 → "US$ 35,6 bi" */
export function formatarMoedaCompacta(valor, moeda = 'usd') {
  return formatadoresMoedaCompacta[moeda].format(valor);
}

/** 1795035600000 → "18/11/2026 14:00" */
export function formatarDataHora(dataEmMs) {
  return new Date(dataEmMs).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** 1795035600000 → "18/11/2026" (sem hora) */
export function formatarData(dataEmMs) {
  return new Date(dataEmMs).toLocaleDateString('pt-BR');
}

/** 2.1 → "+2,10%"   (recebe o número já em porcentagem) */
export function formatarPercentual(valor) {
  return formatadorPercentual.format(valor / 100);
}

/** Variação em % entre dois valores. Ex.: de 100 para 110 → 10 */
export function calcularVariacao(valorInicial, valorFinal) {
  return ((valorFinal - valorInicial) / valorInicial) * 100;
}

/** Diz se é alta, queda ou neutro, com a seta e a classe CSS certas */
export function descreverVariacao(valor) {
  if (valor > 0) return { seta: '▲', classe: 'alta' };
  if (valor < 0) return { seta: '▼', classe: 'queda' };
  return { seta: '■', classe: '' };
}

// ===== Datas =====

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Soma (ou subtrai, se negativo) dias a uma data. Devolve uma NOVA data. */
export function somarDias(data, dias) {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

/** Date → "2026-11-25" (formato que o <input type="date"> entende) */
export function paraTextoData(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * "2026-11-25" → Date no horário local.
 * fimDoDia = true devolve 23:59:59 (para incluir o dia final inteiro).
 */
export function deTextoData(texto, fimDoDia = false) {
  return new Date(`${texto}T${fimDoDia ? '23:59:59' : '00:00:00'}`);
}

/** Quantos dias há entre duas datas (arredondado) */
export function diasEntre(dataInicio, dataFim) {
  return Math.round((dataFim - dataInicio) / UM_DIA_MS);
}

/** Escolhe a escala do eixo X conforme o tamanho do período */
export function escolherUnidadeTempo(dias) {
  if (dias <= 2) return 'hour';
  if (dias <= 90) return 'day';
  return 'month';
}

// ===== Estatísticas =====

/** Lista [{ preco }, ...] → { minimo, maximo, media, variacao } */
export function calcularResumo(dados) {
  const precos = dados.map((ponto) => ponto.preco);
  const soma = precos.reduce((total, preco) => total + preco, 0);

  return {
    minimo: Math.min(...precos),
    maximo: Math.max(...precos),
    media: soma / precos.length,
    variacao: calcularVariacao(precos[0], precos.at(-1)),
  };
}

/**
 * Transforma vários pontos por dia em UMA linha por dia.
 * Usa o último ponto de cada dia ("fechamento") e calcula a variação
 * em relação ao fechamento do dia anterior.
 * Retorna: [{ data, preco, volume, variacao }, ...] do mais antigo ao mais novo
 */
export function agruparPorDia(dados) {
  const porDia = new Map(); // chave "2026-11-25" → último ponto daquele dia

  for (const ponto of dados) {
    // Como os dados vêm em ordem de tempo, o último a ser gravado é o fechamento
    porDia.set(paraTextoData(new Date(ponto.data)), ponto);
  }

  const dias = [...porDia.values()];
  return dias.map((ponto, i) => ({
    data: ponto.data,
    preco: ponto.preco,
    volume: ponto.volume,
    // O primeiro dia não tem "dia anterior" para comparar
    variacao: i === 0 ? null : calcularVariacao(dias[i - 1].preco, ponto.preco),
  }));
}

// ===== Exportar CSV =====

// Número → texto com vírgula decimal e sem separador de milhar: 60296.5 → "60296,50"
// (é o formato que o Excel em português entende como número)
function numeroParaCsv(valor) {
  return valor === null ? '' : valor.toFixed(2).replace('.', ',');
}

/**
 * Linhas da tabela → texto CSV separado por ";" (padrão do Excel no Brasil).
 * @param {Array} linhas [{ data, preco, volume, variacao }, ...]
 */
export function gerarCsv(linhas, moeda = 'usd') {
  const sigla = moeda.toUpperCase();
  const cabecalho = ['Data', `Preço de fechamento (${sigla})`, 'Variação do dia (%)', `Volume (${sigla})`];

  const corpo = linhas.map((linha) => [
    formatarData(linha.data),
    numeroParaCsv(linha.preco),
    numeroParaCsv(linha.variacao),
    numeroParaCsv(linha.volume),
  ]);

  return [cabecalho, ...corpo].map((colunas) => colunas.join(';')).join('\r\n');
}
