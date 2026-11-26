# CLAUDE.md — Dashboard de Bitcoin

Instruções para o Claude Code trabalhar neste projeto. O plano completo está em [plan.md](plan.md) — leia antes de começar qualquer etapa.

## Sobre o projeto
Dashboard em HTML que mostra preço e histórico do Bitcoin: cartões de KPI, gráfico semanal, gráfico anual, seletor de período (datas) e tabela histórica.

## Stack (não mudar sem perguntar)
- HTML5 + CSS puro + JavaScript puro (ES Modules)
- Chart.js 4 + chartjs-adapter-date-fns, carregados via CDN
- Seletor de datas: `<input type="date">` nativo
- **Proibido** adicionar: frameworks (React, Vue...), npm/Node, bundlers, TypeScript, Tailwind. O objetivo é ser simples para iniciante.

## Dados
- API principal: CoinGecko pública, **sem chave** — `https://api.coingecko.com/api/v3`
- Reserva: Binance `https://data-api.binance.vision/api/v3` (sem chave), usada automaticamente pela função `comReserva` quando a CoinGecko falha. Pares `BTCUSDT` (≈ USD) e `BTCBRL`.
- Nunca colocar chaves de API ou segredos no código.
- Toda chamada de rede fica **somente** em `js/api.js`, com cache em `localStorage` (históricos 5 min, preço atual 50 s) e tratamento de erro (incluindo HTTP 429).
- Histórico gratuito da CoinGecko é limitado a 365 dias: o seletor de datas deve respeitar isso.
- O limite de pedidos da CoinGecko é baixo (~5–7 por minuto na prática). Evitar adicionar pedidos novos ao carregamento.
- Na tela, buscar tudo primeiro e desenhar depois (`carregarDashboard`), para nunca misturar moedas.

## Estrutura
```
index.html
css/style.css
js/main.js    → inicializa e conecta eventos
js/api.js     → fetch + cache
js/charts.js  → criar/atualizar gráficos
js/table.js   → tabela histórica + paginação + exportar CSV
js/utils.js   → formatação (moeda, data, %)
```

## Como rodar
Módulos JS não funcionam abrindo o arquivo com duplo clique. Use um servidor local:
- VS Code: extensão **Live Server** → botão "Go Live"
- ou no terminal, na pasta do projeto: `python -m http.server 8000` e abrir `http://localhost:8000`

## Convenções de código
- Nomes de variáveis e funções em **português**, em camelCase (`buscarHistorico`, `precoAtual`).
- Constantes de configuração em MAIÚSCULAS no topo do arquivo (`const API_BASE = ...`).
- Usar `async/await`, `const`/`let` (nunca `var`) e funções pequenas.
- Não repetir código: uma função genérica para criar gráficos, reutilizada.
- Atualizar gráficos com `chart.update()` em vez de recriar.
- Formatar números com `Intl.NumberFormat('pt-BR', ...)` e datas com `toLocaleDateString('pt-BR')`.
- Alta = verde + ▲, queda = vermelho + ▼ (nunca só a cor). Verde/vermelho são **só** para alta/queda: as linhas dos gráficos são sempre azuis (`--cor-serie`).
- Cores ficam como variáveis no topo do `style.css`; o JS lê de lá (`lerCor`). Texto sobre fundo colorido precisa de contraste ≥ 4,5:1.
- Inserir texto na página com `textContent` (não `innerHTML`) sempre que houver dado externo.
- Comentários curtos explicando o **porquê**, não o óbvio.

## Forma de trabalhar
- Seguir as etapas do `plan.md` **uma por vez**, na ordem, e marcar `[x]` ao concluir.
- Ao final de cada etapa, dizer como testar no navegador (o que abrir, o que deve aparecer).
- O dono do projeto é iniciante: explicar em português simples cada mudança e cada termo técnico novo.
- Antes de mudar a stack ou a estrutura de pastas, perguntar.
