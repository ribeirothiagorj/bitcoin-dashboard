// main.js — o "maestro" do dashboard.
// Ele chama os outros arquivos (api.js, utils.js, charts.js, table.js)
// e liga os botões e campos da página às funções.

import * as api from './api.js';
import {
  formatarMoeda, formatarPercentual, calcularVariacao, descreverVariacao,
  somarDias, paraTextoData, deTextoData, diasEntre, escolherUnidadeTempo, calcularResumo,
} from './utils.js';
import { desenharGraficoPreco } from './charts.js';
import { iniciarTabela, mostrarTabela } from './table.js';

const DIAS_PERIODO_INICIAL = 30;          // período que aparece ao abrir a página
const MOEDAS_VALIDAS = ['usd', 'brl'];
const CHAVE_MOEDA_SALVA = 'btc-moeda';    // onde guardamos a moeda escolhida
const INTERVALO_ATUALIZACAO_MS = 60 * 1000; // atualiza o preço a cada 60 s
const LINKS_FONTES = {
  CoinGecko: 'https://www.coingecko.com',
  Binance: 'https://www.binance.com',
};

// Pegamos os elementos da página UMA vez e guardamos (mais rápido e organizado)
const elementos = {
  conteudo: document.getElementById('conteudo'),
  aviso: document.getElementById('aviso'),
  avisoTexto: document.getElementById('aviso-texto'),
  avisoTentar: document.getElementById('aviso-tentar'),
  botoesMoeda: document.querySelectorAll('[data-moeda]'),

  fonteDados: document.getElementById('fonte-dados'),

  // Cartões
  preco: document.getElementById('kpi-preco'),
  atualizadoEm: document.getElementById('atualizado-em'),
  variacao24h: document.getElementById('kpi-24h'),
  variacao7d: document.getElementById('kpi-7d'),
  variacao1a: document.getElementById('kpi-1a'),

  // Seletor de período
  formPeriodo: document.getElementById('form-periodo'),
  dataInicio: document.getElementById('data-inicio'),
  dataFim: document.getElementById('data-fim'),
  botaoAplicar: document.getElementById('botao-aplicar'),
  botoesAtalho: document.querySelectorAll('[data-dias]'),
  erroPeriodo: document.getElementById('erro-periodo'),

  // Resumo do período
  resumoMin: document.getElementById('resumo-min'),
  resumoMax: document.getElementById('resumo-max'),
  resumoMedia: document.getElementById('resumo-media'),
  resumoVariacao: document.getElementById('resumo-variacao'),
};

// ===================== Moeda (Etapa 8) =====================

// Lê a moeda salva da última visita (ou usa USD)
function lerMoedaSalva() {
  try {
    const salva = localStorage.getItem(CHAVE_MOEDA_SALVA);
    return MOEDAS_VALIDAS.includes(salva) ? salva : 'usd';
  } catch {
    return 'usd'; // navegador bloqueou o localStorage: tudo bem, usamos o padrão
  }
}

let moedaAtual = lerMoedaSalva(); // moeda escolhida no botão
let moedaNaTela = null;           // moeda dos dados que estão aparecendo agora
let historicosNaTela = null;      // { semana, ano } — usados ao atualizar o preço

function marcarBotaoMoeda() {
  for (const botao of elementos.botoesMoeda) {
    const ativo = botao.dataset.moeda === moedaAtual;
    botao.classList.toggle('botao--ativo', ativo);
    botao.setAttribute('aria-pressed', String(ativo));
  }
}

function salvarMoeda(moeda) {
  try {
    localStorage.setItem(CHAVE_MOEDA_SALVA, moeda);
  } catch {
    // sem localStorage: a escolha só não fica salva para a próxima visita
  }
}

function trocarMoeda(novaMoeda) {
  if (novaMoeda === moedaAtual) return;

  moedaAtual = novaMoeda;
  marcarBotaoMoeda();
  carregarDashboard(); // busca tudo de novo na moeda nova
}

// ===================== Avisos e "carregando" =====================

// Mostra um texto num elemento de aviso (ou esconde, se vier vazio)
function mostrarMensagem(elemento, texto) {
  elemento.textContent = texto;
  elemento.hidden = !texto;
}

// Faixa de aviso do topo. Com comBotao = true, mostra "Tentar novamente".
function mostrarAviso(texto, comBotao = false) {
  elementos.avisoTexto.textContent = texto;
  elementos.avisoTentar.hidden = !comBotao;
  elementos.aviso.hidden = !texto;
}

// Liga/desliga o visual de "carregando" e trava os botões de moeda
function definirCarregando(carregando) {
  elementos.conteudo.setAttribute('aria-busy', String(carregando));
  for (const botao of elementos.botoesMoeda) {
    botao.disabled = carregando;
  }
}

function verificarBibliotecas() {
  if (typeof window.Chart === 'undefined') {
    throw new Error('A biblioteca de gráficos não carregou. Verifique sua conexão com a internet.');
  }
}

// ===================== Cartões (Etapa 3) =====================

// Escreve "▲ +2,10%" no elemento e pinta de verde ou vermelho.
// A seta e o sinal garantem que dá para entender mesmo sem ver as cores.
function mostrarVariacao(elemento, valor) {
  const { seta, classe } = descreverVariacao(valor);

  elemento.classList.remove('alta', 'queda');
  if (classe) elemento.classList.add(classe);

  // A seta é só visual (aria-hidden); o leitor de tela lê o "+" ou "−"
  elemento.innerHTML = `<span aria-hidden="true">${seta}</span> ${formatarPercentual(valor)}`;
}

function preencherCartoes(precoAtual, semana, ano, moeda) {
  const precoDeAgora = precoAtual[moeda];

  // Variação = do primeiro preço da lista (7 ou 365 dias atrás) até o preço de agora
  const variacao7d = calcularVariacao(semana[0].preco, precoDeAgora);
  const variacao1a = calcularVariacao(ano[0].preco, precoDeAgora);
  const variacao24h = moeda === 'usd' ? precoAtual.variacao24hUsd : precoAtual.variacao24hBrl;

  elementos.preco.textContent = formatarMoeda(precoDeAgora, moeda);
  mostrarVariacao(elementos.variacao24h, variacao24h);
  mostrarVariacao(elementos.variacao7d, variacao7d);
  mostrarVariacao(elementos.variacao1a, variacao1a);
}

function mostrarHorarioAtualizacao() {
  elementos.atualizadoEm.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
}

// ===================== Atualização automática (Etapa 9) =====================

let atualizandoPreco = false;

// Busca só o preço atual e refaz os cartões (gráficos e tabela não mudam)
async function atualizarPreco() {
  const carregando = elementos.conteudo.getAttribute('aria-busy') === 'true';
  // Não atualiza se: nada carregou ainda, a aba está escondida,
  // o dashboard está recarregando, ou uma atualização já está em andamento.
  if (!historicosNaTela || document.hidden || carregando || atualizandoPreco) return;

  atualizandoPreco = true;
  try {
    const precoAtual = await api.buscarPrecoAtual();
    const { semana, ano } = historicosNaTela;
    preencherCartoes(precoAtual, semana, ano, moedaNaTela);
    mostrarHorarioAtualizacao();
    atualizarRodape();
  } catch (erro) {
    // Falhou? Sem alarde: mantemos o último preço e tentamos no próximo minuto
    console.warn('Não deu para atualizar o preço agora:', erro.message);
  } finally {
    atualizandoPreco = false;
  }
}

function iniciarAtualizacaoAutomatica() {
  setInterval(atualizarPreco, INTERVALO_ATUALIZACAO_MS);

  // Voltou para a aba? Atualiza na hora (o cache de 50 s evita pedidos demais)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) atualizarPreco();
  });
}

// Mostra no rodapé de onde vieram os dados (CoinGecko, Binance ou as duas)
function atualizarRodape() {
  const fontes = api.obterFontes();
  if (fontes.length === 0) return;

  const partes = fontes.flatMap((nome, i) => {
    const link = document.createElement('a');
    link.href = LINKS_FONTES[nome];
    link.textContent = nome;
    link.target = '_blank';
    link.rel = 'noopener';
    return i === 0 ? [link] : [' e ', link];
  });
  elementos.fonteDados.replaceChildren(...partes);
}

// ===================== Seletor de período (Etapa 6) =====================

// Impede escolher datas fora do que a API gratuita oferece
function configurarLimitesDatas() {
  const hoje = new Date();
  // "- 1" porque o dia de hoje também conta
  const maisAntiga = somarDias(hoje, -(api.LIMITE_DIAS_HISTORICO - 1));

  for (const campo of [elementos.dataInicio, elementos.dataFim]) {
    campo.min = paraTextoData(maisAntiga);
    campo.max = paraTextoData(hoje);
  }
}

// Preenche os campos com "os últimos N dias" (contando hoje)
function preencherDatas(dias) {
  const hoje = new Date();
  elementos.dataInicio.value = paraTextoData(somarDias(hoje, -(dias - 1)));
  elementos.dataFim.value = paraTextoData(hoje);
}

// Destaca o botão de atalho escolhido (ou nenhum, se dias = null)
function marcarAtalho(dias) {
  for (const botao of elementos.botoesAtalho) {
    const ativo = Number(botao.dataset.dias) === dias;
    botao.classList.toggle('botao--ativo', ativo);
    botao.setAttribute('aria-pressed', String(ativo));
  }
}

function preencherResumo(dados, moeda) {
  const { minimo, maximo, media, variacao } = calcularResumo(dados);

  elementos.resumoMin.textContent = formatarMoeda(minimo, moeda);
  elementos.resumoMax.textContent = formatarMoeda(maximo, moeda);
  elementos.resumoMedia.textContent = formatarMoeda(media, moeda);
  mostrarVariacao(elementos.resumoVariacao, variacao);
}

// Conta as buscas de período. Se o usuário clicar em 7D e logo depois em 1A,
// a resposta do 7D pode chegar POR ÚLTIMO e "atropelar" a do 1A.
// Com este número, só a busca mais recente pode mexer na tela.
let numeroUltimaBusca = 0;

// Lê as datas dos campos. Lança um erro se estiverem vazias.
function lerPeriodoEscolhido() {
  if (!elementos.dataInicio.value || !elementos.dataFim.value) {
    throw new Error('Preencha as duas datas.');
  }
  return {
    inicio: deTextoData(elementos.dataInicio.value),
    fim: deTextoData(elementos.dataFim.value, true),
  };
}

// Mostra os dados de um período: gráfico + resumo + tabela
function mostrarPeriodo(dados, inicio, fim, moeda) {
  if (dados.length === 0) {
    throw new Error('Não há dados para esse período.');
  }
  desenharGraficoPreco('grafico-periodo', dados, {
    moeda,
    unidadeTempo: escolherUnidadeTempo(diasEntre(inicio, fim)),
    preencher: true,
  });
  preencherResumo(dados, moeda);
  mostrarTabela(dados, moeda); // a tabela acompanha o período escolhido
}

// Trava o botão "Aplicar" enquanto carrega (vários cliques = vários pedidos à API)
function travarBotaoAplicar(travado) {
  elementos.botaoAplicar.disabled = travado;
  elementos.botaoAplicar.textContent = travado ? 'Carregando...' : 'Aplicar';
}

// Chamada pelo botão "Aplicar" e pelos atalhos: busca e mostra só o período
async function aplicarPeriodo() {
  mostrarMensagem(elementos.erroPeriodo, '');
  const moeda = moedaAtual;
  const minhaBusca = ++numeroUltimaBusca;
  travarBotaoAplicar(true);

  try {
    const { inicio, fim } = lerPeriodoEscolhido();
    const dados = await api.buscarPeriodo(inicio, fim, moeda);
    if (minhaBusca !== numeroUltimaBusca) return; // chegou atrasada: ignoramos
    mostrarPeriodo(dados, inicio, fim, moeda);
  } catch (erro) {
    if (minhaBusca !== numeroUltimaBusca) return;
    // Erros de validação e da API aparecem aqui, logo abaixo do seletor
    mostrarMensagem(elementos.erroPeriodo, `⚠️ ${erro.message}`);
  } finally {
    // "finally" roda sempre, dando certo ou errado: destrava o botão
    if (minhaBusca === numeroUltimaBusca) travarBotaoAplicar(false);
  }
}

// ===================== Carregar tudo =====================

// Busca os dados principais na moeda atual e preenche cartões + gráficos.
// É chamada ao abrir a página, ao trocar de moeda e no "Tentar novamente".
async function carregarDashboard() {
  const moeda = moedaAtual;
  const minhaBusca = ++numeroUltimaBusca; // invalida buscas de período antigas
  definirCarregando(true);
  travarBotaoAplicar(true);
  mostrarMensagem(elementos.erroPeriodo, '');
  mostrarAviso('Carregando dados do Bitcoin...');
  api.limparFontes();

  try {
    verificarBibliotecas();

    // 1) BUSCA TUDO PRIMEIRO. Se qualquer pedido falhar, nada na tela muda
    //    (evita ficar metade em USD e metade em BRL).

    // Promise.all faz os 3 pedidos AO MESMO TEMPO (mais rápido que um por vez)
    const [precoAtual, semana, ano] = await Promise.all([
      api.buscarPrecoAtual(),
      api.buscarHistorico(7, moeda),
      api.buscarHistorico(365, moeda),
    ]);

    // O período é buscado DEPOIS dos outros: espalha os pedidos e
    // ajuda a não estourar o limite da API gratuita.
    const { inicio, fim } = lerPeriodoEscolhido();
    const dadosPeriodo = await api.buscarPeriodo(inicio, fim, moeda);

    // 2) DEPOIS DESENHA: todos os dados chegaram, na mesma moeda
    preencherCartoes(precoAtual, semana, ano, moeda);
    desenharGraficoPreco('grafico-semanal', semana, { moeda, unidadeTempo: 'day' });
    desenharGraficoPreco('grafico-anual', ano, { moeda, unidadeTempo: 'month', preencher: true });
    if (minhaBusca === numeroUltimaBusca) {
      mostrarPeriodo(dadosPeriodo, inicio, fim, moeda);
    }

    moedaNaTela = moeda;
    historicosNaTela = { semana, ano };
    mostrarHorarioAtualizacao();
    atualizarRodape();
    salvarMoeda(moeda); // só salvamos a moeda que carregou com sucesso
    mostrarAviso('');   // tudo certo: esconde o aviso
  } catch (erro) {
    console.error(erro);

    // Se a troca de moeda falhou, o botão volta para a moeda que está na tela.
    // Assim o botão marcado nunca "mente" sobre os valores mostrados.
    if (moedaNaTela && moedaNaTela !== moeda) {
      moedaAtual = moedaNaTela;
      marcarBotaoMoeda();
      mostrarAviso(`⚠️ Não foi possível trocar a moeda. ${erro.message}`);
    } else {
      mostrarAviso(`⚠️ ${erro.message}`, true);
    }
  } finally {
    definirCarregando(false);
    if (minhaBusca === numeroUltimaBusca) travarBotaoAplicar(false);
  }
}

// ===================== Início =====================

function ligarEventos() {
  // Moeda
  for (const botao of elementos.botoesMoeda) {
    botao.addEventListener('click', () => trocarMoeda(botao.dataset.moeda));
  }

  // "Tentar novamente" na faixa de erro
  elementos.avisoTentar.addEventListener('click', carregarDashboard);

  // Botão "Aplicar" (submit do formulário)
  elementos.formPeriodo.addEventListener('submit', (evento) => {
    evento.preventDefault(); // impede o formulário de recarregar a página
    aplicarPeriodo();
  });

  // Atalhos 7D / 30D / 90D / 1A: preenchem as datas e já aplicam
  for (const botao of elementos.botoesAtalho) {
    botao.addEventListener('click', () => {
      const dias = Number(botao.dataset.dias);
      preencherDatas(dias);
      marcarAtalho(dias);
      aplicarPeriodo();
    });
  }

  // Mexeu na data à mão? Então nenhum atalho está mais valendo
  for (const campo of [elementos.dataInicio, elementos.dataFim]) {
    campo.addEventListener('input', () => marcarAtalho(null));
  }
}

function iniciar() {
  // O seletor e os botões ficam prontos antes mesmo de os dados chegarem
  configurarLimitesDatas();
  preencherDatas(DIAS_PERIODO_INICIAL);
  marcarAtalho(DIAS_PERIODO_INICIAL);
  marcarBotaoMoeda();
  ligarEventos();
  iniciarTabela();
  iniciarAtualizacaoAutomatica();

  carregarDashboard();
}

iniciar();
