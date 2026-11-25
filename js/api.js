// api.js — o ÚNICO arquivo que conversa com a internet.
// Fonte principal: CoinGecko. Reserva: Binance (usada se a CoinGecko falhar).
// Se um dia alguma API mudar, só este arquivo precisa ser alterado.

// ===== Configurações (constantes no topo: muda aqui, vale para tudo) =====
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const BINANCE_BASE = 'https://data-api.binance.vision/api/v3'; // endpoint só de dados públicos
const SIMBOLOS_BINANCE = { usd: 'BTCUSDT', brl: 'BTCBRL' };   // USDT ≈ dólar

const MOEDA_PADRAO = 'usd';
const CACHE_PREFIXO = 'btc-cache:';
const CACHE_VALIDADE_MS = 5 * 60 * 1000;   // históricos: 5 minutos
const CACHE_PRECO_MS = 50 * 1000;          // preço atual: 50 s (atualiza a cada 60 s)
const LIMITE_DIAS_HISTORICO = 365;          // limite do plano gratuito da CoinGecko
const UM_DIA_MS = 24 * 60 * 60 * 1000;
const MAX_DIAS_POR_HORA = 40;               // Binance: até 40 dias, um ponto por hora

// Erro "nosso", com uma mensagem amigável para mostrar na tela.
export class ErroApi extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status; // código HTTP (ex.: 429), quando houver
  }
}

// Registra de quais fontes vieram os dados (para mostrar no rodapé)
const fontesUsadas = new Set();
export function limparFontes() { fontesUsadas.clear(); }
export function obterFontes() { return [...fontesUsadas]; }

// =========================================================
// CACHE: guarda respostas no navegador por alguns minutos.
// Como anotar a resposta num papel para não perguntar de novo.
// =========================================================
function lerCache(chave, validadeMs) {
  try {
    const texto = localStorage.getItem(CACHE_PREFIXO + chave);
    if (!texto) return null;

    const { salvoEm, dados } = JSON.parse(texto);
    const expirou = Date.now() - salvoEm > validadeMs;
    return expirou ? null : dados;
  } catch {
    return null; // cache corrompido ou indisponível: só ignoramos
  }
}

function salvarCache(chave, dados) {
  try {
    localStorage.setItem(CACHE_PREFIXO + chave, JSON.stringify({ salvoEm: Date.now(), dados }));
  } catch {
    // localStorage cheio ou bloqueado: o site continua funcionando sem cache
  }
}

// =========================================================
// Função genérica: busca uma URL e devolve o JSON.
// Todas as outras funções usam esta (não repetimos código).
// =========================================================
async function buscarJSON(url, { chaveCache = url, validadeMs = CACHE_VALIDADE_MS } = {}) {
  const emCache = lerCache(chaveCache, validadeMs);
  if (emCache) return emCache;

  let resposta;
  try {
    resposta = await fetch(url);
  } catch {
    // fetch só "falha" assim quando não há internet ou o site está fora do ar
    throw new ErroApi('Sem conexão com a internet ou a API está fora do ar.');
  }

  if (resposta.status === 429) {
    throw new ErroApi('Muitos pedidos em pouco tempo. Espere 1 minuto e tente de novo.', 429);
  }
  if (!resposta.ok) {
    throw new ErroApi(`A API respondeu com erro (código ${resposta.status}).`, resposta.status);
  }

  const dados = await resposta.json();
  salvarCache(chaveCache, dados);
  return dados;
}

// Tenta a fonte principal; se ela falhar, tenta a reserva.
// Se as duas falharem, mostramos o erro da principal (o mais útil).
async function comReserva(buscarPrincipal, buscarReserva) {
  try {
    const dados = await buscarPrincipal();
    fontesUsadas.add('CoinGecko');
    return dados;
  } catch (erroPrincipal) {
    console.warn('CoinGecko falhou, tentando a Binance...', erroPrincipal.message);
    try {
      const dados = await buscarReserva();
      fontesUsadas.add('Binance');
      return dados;
    } catch {
      throw erroPrincipal;
    }
  }
}

// Transforma um objeto Date em "2026-11-25" (usado como chave do cache)
function formatarDataISO(data) {
  return data.toISOString().slice(0, 10);
}

// =========================================================
// CoinGecko (principal)
// =========================================================

// A CoinGecko devolve listas separadas: prices = [[data, valor], ...] e
// total_volumes = [[data, valor], ...]. Juntamos em objetos fáceis de usar:
// [{ data: 1732492800000, preco: 98123.45, volume: 3.1e10 }, ...]
function converterSerieCoinGecko(resposta) {
  return resposta.prices.map(([data, preco], i) => ({
    data,
    preco,
    volume: resposta.total_volumes[i]?.[1] ?? null,
  }));
}

async function precoAtualCoinGecko() {
  const url = `${COINGECKO_BASE}/simple/price?ids=bitcoin&vs_currencies=usd,brl&include_24hr_change=true`;
  const { bitcoin } = await buscarJSON(url, { validadeMs: CACHE_PRECO_MS });
  return {
    usd: bitcoin.usd,
    brl: bitcoin.brl,
    variacao24hUsd: bitcoin.usd_24h_change,
    variacao24hBrl: bitcoin.brl_24h_change,
  };
}

async function historicoCoinGecko(dias, moeda) {
  const url = `${COINGECKO_BASE}/coins/bitcoin/market_chart?vs_currency=${moeda}&days=${dias}`;
  return converterSerieCoinGecko(await buscarJSON(url));
}

async function periodoCoinGecko(de, ate, moeda, chaveCache) {
  const url = `${COINGECKO_BASE}/coins/bitcoin/market_chart/range?vs_currency=${moeda}&from=${Math.floor(de / 1000)}&to=${Math.floor(ate / 1000)}`;
  return converterSerieCoinGecko(await buscarJSON(url, { chaveCache: `cg:${chaveCache}` }));
}

// =========================================================
// Binance (reserva)
// =========================================================

// Cada "vela" (kline) da Binance é uma lista:
// [abertura, abre, máx, mín, FECHA, volume BTC, fechamento, VOLUME EM MOEDA, ...]
// Para ficar igual à CoinGecko, o volume de cada ponto é o das últimas 24h.
function converterSerieBinance(velas, intervalo) {
  const velasPorDia = intervalo === '1h' ? 24 : 1;
  const volumes = velas.map((vela) => Number(vela[7]));

  return velas.map((vela, i) => {
    const ultimas24h = volumes.slice(Math.max(0, i - velasPorDia + 1), i + 1);
    return {
      data: vela[6],             // horário de fechamento da vela
      preco: Number(vela[4]),    // preço de fechamento
      volume: ultimas24h.reduce((soma, v) => soma + v, 0),
    };
  });
}

function intervaloBinance(dias) {
  return dias <= MAX_DIAS_POR_HORA ? '1h' : '1d';
}

async function velasBinance(moeda, de, ate, chaveCache) {
  const dias = Math.ceil((ate - de) / UM_DIA_MS);
  const intervalo = intervaloBinance(dias);
  const url = `${BINANCE_BASE}/klines?symbol=${SIMBOLOS_BINANCE[moeda]}&interval=${intervalo}`
    + `&startTime=${Math.floor(de)}&endTime=${Math.floor(ate)}&limit=1000`;
  const velas = await buscarJSON(url, { chaveCache: `bn:${chaveCache}` });
  return converterSerieBinance(velas, intervalo);
}

async function precoAtualBinance() {
  const simbolos = encodeURIComponent(JSON.stringify(Object.values(SIMBOLOS_BINANCE)));
  const lista = await buscarJSON(`${BINANCE_BASE}/ticker/24hr?symbols=${simbolos}`, { validadeMs: CACHE_PRECO_MS });
  const porSimbolo = Object.fromEntries(lista.map((item) => [item.symbol, item]));
  const usd = porSimbolo[SIMBOLOS_BINANCE.usd];
  const brl = porSimbolo[SIMBOLOS_BINANCE.brl];

  return {
    usd: Number(usd.lastPrice),
    brl: Number(brl.lastPrice),
    variacao24hUsd: Number(usd.priceChangePercent),
    variacao24hBrl: Number(brl.priceChangePercent),
  };
}

// =========================================================
// FUNÇÕES PÚBLICAS (as que os outros arquivos vão usar)
// =========================================================

/**
 * Preço atual do Bitcoin em USD e BRL, com variação das últimas 24h.
 * Retorna: { usd, brl, variacao24hUsd, variacao24hBrl }
 */
export function buscarPrecoAtual() {
  return comReserva(precoAtualCoinGecko, precoAtualBinance);
}

/**
 * Histórico dos últimos `dias` (ex.: 7 ou 365).
 * Retorna: [{ data, preco, volume }, ...]
 */
export async function buscarHistorico(dias, moeda = MOEDA_PADRAO) {
  if (dias < 1 || dias > LIMITE_DIAS_HISTORICO) {
    throw new ErroApi(`Escolha entre 1 e ${LIMITE_DIAS_HISTORICO} dias.`);
  }
  const agora = Date.now();
  return comReserva(
    () => historicoCoinGecko(dias, moeda),
    () => velasBinance(moeda, agora - dias * UM_DIA_MS, agora, `hist:${moeda}:${dias}`),
  );
}

/**
 * Histórico entre duas datas (objetos Date).
 * Retorna: [{ data, preco, volume }, ...]
 */
export async function buscarPeriodo(dataInicio, dataFim, moeda = MOEDA_PADRAO) {
  const agora = Date.now();
  const inicioMinimo = agora - LIMITE_DIAS_HISTORICO * UM_DIA_MS;

  // Validamos ANTES de pedir: economiza pedidos e dá mensagens mais claras
  if (dataInicio >= dataFim) {
    throw new ErroApi('A data inicial precisa ser anterior à data final.');
  }
  if (dataInicio.getTime() < inicioMinimo) {
    throw new ErroApi(`A API gratuita só tem dados dos últimos ${LIMITE_DIAS_HISTORICO} dias.`);
  }

  // Se o fim está no futuro, usamos "agora"
  const de = dataInicio.getTime();
  const ate = Math.min(dataFim.getTime(), agora);

  // A chave do cache usa as datas escolhidas (e não os segundos exatos),
  // senão "agora" mudaria a cada segundo e o cache nunca seria reaproveitado.
  const chaveCache = `periodo:${moeda}:${formatarDataISO(dataInicio)}:${formatarDataISO(dataFim)}`;

  return comReserva(
    () => periodoCoinGecko(de, ate, moeda, chaveCache),
    () => velasBinance(moeda, de, ate, chaveCache),
  );
}

export { LIMITE_DIAS_HISTORICO };
