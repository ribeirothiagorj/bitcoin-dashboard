// table.js — só cuida da tabela de histórico: linhas, paginação e ordenação.
// Recebe os dados prontos de quem chamar (não busca nada na internet).

import {
  agruparPorDia, formatarData, formatarMoeda, formatarMoedaCompacta,
  formatarPercentual, descreverVariacao, gerarCsv, paraTextoData,
} from './utils.js';

const LINHAS_POR_PAGINA = 15;

const elementos = {
  corpo: document.getElementById('tabela-corpo'),
  botaoOrdenar: document.getElementById('ordenar-data'),
  cabecalhoData: document.getElementById('cabecalho-data'),
  setaOrdem: document.getElementById('seta-ordem'),
  anterior: document.getElementById('pagina-anterior'),
  proxima: document.getElementById('pagina-proxima'),
  info: document.getElementById('pagina-info'),
  baixarCsv: document.getElementById('baixar-csv'),
};

// Tudo que a tabela precisa "lembrar" fica junto aqui
const estado = {
  linhas: [],               // um item por dia, do mais antigo ao mais novo
  pagina: 1,
  maisRecentePrimeiro: true, // ordem padrão: hoje no topo
  moeda: 'usd',
};

// Cria uma célula <td> com texto (textContent é seguro: nunca vira código HTML)
function criarCelula(texto, classes = []) {
  const celula = document.createElement('td');
  celula.textContent = texto;
  celula.classList.add(...classes);
  return celula;
}

function criarCelulaVariacao(variacao) {
  if (variacao === null) return criarCelula('—', ['numero']);

  const { seta, classe } = descreverVariacao(variacao);
  const celula = criarCelula(`${seta} ${formatarPercentual(variacao)}`, ['numero']);
  if (classe) celula.classList.add(classe);
  return celula;
}

function totalPaginas() {
  return Math.max(1, Math.ceil(estado.linhas.length / LINHAS_POR_PAGINA));
}

// Desenha a página atual da tabela + atualiza os botões
function desenhar() {
  const ordenadas = estado.maisRecentePrimeiro ? [...estado.linhas].reverse() : estado.linhas;
  const inicio = (estado.pagina - 1) * LINHAS_POR_PAGINA;
  const daPagina = ordenadas.slice(inicio, inicio + LINHAS_POR_PAGINA);

  // Monta as linhas num "rascunho" (fragment) e coloca na página de uma vez só:
  // mais rápido do que inserir linha por linha.
  const rascunho = document.createDocumentFragment();
  for (const dia of daPagina) {
    const linha = document.createElement('tr');
    linha.append(
      criarCelula(formatarData(dia.data)),
      criarCelula(formatarMoeda(dia.preco, estado.moeda), ['numero']),
      criarCelulaVariacao(dia.variacao),
      criarCelula(dia.volume === null ? '—' : formatarMoedaCompacta(dia.volume, estado.moeda), ['numero']),
    );
    rascunho.append(linha);
  }
  elementos.corpo.replaceChildren(rascunho);

  // Paginação
  elementos.info.textContent = `Página ${estado.pagina} de ${totalPaginas()}`;
  elementos.anterior.disabled = estado.pagina === 1;
  elementos.proxima.disabled = estado.pagina === totalPaginas();

  // Ordenação: seta visual + aviso para leitores de tela
  elementos.setaOrdem.textContent = estado.maisRecentePrimeiro ? '↓' : '↑';
  elementos.cabecalhoData.setAttribute('aria-sort', estado.maisRecentePrimeiro ? 'descending' : 'ascending');
}

// Cria o arquivo .csv na memória e faz o navegador "baixar" ele
function baixarCsv() {
  if (estado.linhas.length === 0) return;

  // "﻿" no começo avisa ao Excel que o texto é UTF-8 (senão "Preço" vira "PreÃ§o")
  const conteudo = '﻿' + gerarCsv(estado.linhas, estado.moeda);
  const arquivo = new Blob([conteudo], { type: 'text/csv;charset=utf-8' });

  const primeiroDia = paraTextoData(new Date(estado.linhas[0].data));
  const ultimoDia = paraTextoData(new Date(estado.linhas.at(-1).data));

  // Truque padrão: um link invisível apontando para o arquivo, clicado pelo código
  const link = document.createElement('a');
  link.href = URL.createObjectURL(arquivo);
  link.download = `bitcoin-${estado.moeda}-${primeiroDia}-a-${ultimoDia}.csv`;
  link.click();
  // Libera a memória depois de 1 s (liberar na hora pode cancelar o download em alguns navegadores)
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function irParaPagina(numero) {
  // Math.min/max garantem que a página fica entre 1 e o total
  estado.pagina = Math.min(Math.max(numero, 1), totalPaginas());
  desenhar();
}

/** Liga os botões da tabela. Chamar UMA vez, ao abrir a página. */
export function iniciarTabela() {
  elementos.anterior.addEventListener('click', () => irParaPagina(estado.pagina - 1));
  elementos.proxima.addEventListener('click', () => irParaPagina(estado.pagina + 1));
  elementos.baixarCsv.addEventListener('click', baixarCsv);
  elementos.botaoOrdenar.addEventListener('click', () => {
    estado.maisRecentePrimeiro = !estado.maisRecentePrimeiro;
    irParaPagina(1);
  });
}

/**
 * Mostra os dados de um período na tabela (volta para a página 1).
 * @param {Array} dados lista [{ data, preco, volume }, ...] vinda do api.js
 */
export function mostrarTabela(dados, moeda = 'usd') {
  estado.linhas = agruparPorDia(dados);
  estado.moeda = moeda;
  elementos.baixarCsv.disabled = estado.linhas.length === 0;
  irParaPagina(1);
}
