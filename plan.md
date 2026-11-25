# Plano — Dashboard de Bitcoin

## 1. Objetivo

Criar uma página web (dashboard) que mostra o preço do Bitcoin e como ele mudou ao longo do tempo, com:

- Gráfico de variação **semanal** (últimos 7 dias)
- Gráfico de variação **anual** (últimos 365 dias)
- **Tabela de dados históricos**, fácil de ler
- **Seletor de período** (data inicial e data final) interativo

Prioridades: **simplicidade**, **visual bonito e legível** e **fácil de construir para iniciantes**.

---

## 2. Stack (ferramentas escolhidas)

| Camada | Escolha | Por quê |
|---|---|---|
| Estrutura | **HTML5** | Base de toda página web. Nada a instalar. |
| Estilo | **CSS puro** (com variáveis CSS) | Sem frameworks para aprender. Variáveis deixam as cores fáceis de trocar. |
| Lógica | **JavaScript puro** (ES Modules) | Roda direto no navegador. Módulos permitem separar o código em arquivos pequenos. |
| Gráficos | **Chart.js 4** (via CDN) | Biblioteca de gráficos mais simples e popular; boa documentação. |
| Eixo de datas | **chartjs-adapter-date-fns** (via CDN) | Faz o Chart.js entender datas no eixo X. |
| Seletor de datas | `<input type="date">` nativo | Já vem no navegador, funciona no celular, zero dependências. |
| Servidor local | **Live Server** (extensão do VS Code) ou `python -m http.server` | Módulos JS precisam de um servidor para funcionar (não abrem com duplo clique no arquivo). |

**Sem** Node.js, sem npm, sem build, sem React. Só abrir e rodar.

> **CDN** = um site que hospeda bibliotecas prontas. Você só coloca um `<script src="...">` no HTML e a biblioteca é baixada automaticamente.

---

## 3. Fonte de dados (API)

> **API** = um "garçom" de dados: você faz um pedido por uma URL e ele te devolve as informações em formato JSON.

### API principal: CoinGecko (gratuita, sem chave)

Base: `https://api.coingecko.com/api/v3`

| Uso no dashboard | Endpoint |
|---|---|
| Preço atual + variação 24h | `/simple/price?ids=bitcoin&vs_currencies=usd,brl&include_24hr_change=true` |
| Gráfico semanal | `/coins/bitcoin/market_chart?vs_currency=usd&days=7` |
| Gráfico anual | `/coins/bitcoin/market_chart?vs_currency=usd&days=365` |
| Período personalizado | `/coins/bitcoin/market_chart/range?vs_currency=usd&from=<unix>&to=<unix>` |

A resposta de `market_chart` vem assim:

```json
{
  "prices":        [[1732492800000, 98123.45], ...],
  "market_caps":   [[...], ...],
  "total_volumes": [[...], ...]
}
```

Cada item é `[data em milissegundos, valor]`.

### Limitações importantes (e como lidar)

1. **Limite de pedidos**: o plano gratuito aceita poucas chamadas por minuto (aprox. 5–30).
   → Guardar respostas em **cache** (`localStorage`) por ~5 minutos e evitar pedir de novo à toa.
2. **Histórico limitado**: no acesso gratuito, o histórico costuma ser limitado aos **últimos 365 dias**.
   → O seletor de datas terá `min` = hoje − 365 dias e `max` = hoje.
3. **Granularidade automática**: 1 dia → pontos a cada 5 min; 2–90 dias → por hora; mais de 90 dias → diário.
   → Para a tabela, agrupar os pontos por dia (pegar o último preço de cada dia).

### API reserva (opcional): Binance

`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&startTime=<ms>&endTime=<ms>`
Também gratuita e sem chave, com histórico desde 2017. Usar só se a CoinGecko falhar ou se quisermos períodos maiores que 1 ano.

---

## 4. Estrutura de pastas

```
ProjetoClaudeCode/
├── index.html          ← a página (estrutura)
├── css/
│   └── style.css       ← cores, layout, responsividade
├── js/
│   ├── main.js         ← "maestro": inicia tudo e liga os eventos
│   ├── api.js          ← só busca dados (fetch + cache)
│   ├── charts.js       ← só cria/atualiza gráficos
│   ├── table.js        ← só monta a tabela de histórico
│   └── utils.js        ← formatação de moeda, datas, % de variação
├── plan.md
└── CLAUDE.md
```

**Boa prática — separação de responsabilidades:** cada arquivo faz uma coisa só. É como uma cozinha onde um corta, outro cozinha e outro monta o prato: se algo der errado, você sabe onde procurar.

---

## 5. Layout do dashboard

```
┌───────────────────────────────────────────────────────────┐
│  ₿ Bitcoin Dashboard                     [USD | BRL]      │
├──────────────┬──────────────┬──────────────┬──────────────┤
│ Preço atual  │ Variação 24h │ Variação 7d  │ Variação 1a  │  ← cartões (KPIs)
│ $ 98.123     │ ▲ +2,1%      │ ▼ −3,4%      │ ▲ +105%      │
├──────────────┴──────────────┴──────────────┴──────────────┤
│  Variação semanal (7 dias)          — gráfico de linha    │
├───────────────────────────────────────────────────────────┤
│  Variação anual (365 dias)          — gráfico de área     │
├───────────────────────────────────────────────────────────┤
│  Período: [ 01/09/2026 ] até [ 25/11/2026 ]               │
│  Atalhos: [7D] [30D] [90D] [1A]          [Aplicar]        │
│  Gráfico do período + resumo (mín, máx, média, variação)  │
├───────────────────────────────────────────────────────────┤
│  Tabela histórica: Data | Preço | Variação dia | Volume   │
│  (paginada, 15 linhas por página)                         │
└───────────────────────────────────────────────────────────┘
```

> **KPI** = "indicador-chave": um número importante destacado em um cartão.

### Regras visuais
- Tema escuro (comum em dashboards de cripto) com bom contraste.
- **Verde** para alta, **vermelho** para queda — sempre acompanhado de seta ▲/▼ (para quem não distingue cores).
- Números formatados no padrão brasileiro com `Intl.NumberFormat('pt-BR', ...)`.
- Tooltip (caixinha ao passar o mouse) mostrando data e preço exatos.
- Layout responsivo: cartões viram 2×2 no tablet e 1 coluna no celular (CSS Grid).

---

## 6. Etapas de desenvolvimento

Cada etapa termina com algo **funcionando e visível**. Faça uma de cada vez.

### Etapa 1 — Esqueleto da página
- [x] Criar `index.html` com as seções (cabeçalho, cartões, gráficos, seletor, tabela)
- [x] Criar `css/style.css` com variáveis de cor e layout em Grid
- [x] Incluir Chart.js e o adaptador de datas via CDN
- [ ] Abrir com Live Server e conferir que a página aparece

### Etapa 2 — Buscar dados (`api.js`)
- [x] Função `buscarPrecoAtual()`
- [x] Função `buscarHistorico(dias)`
- [x] Função `buscarPeriodo(dataInicio, dataFim)`
- [x] Cache simples em `localStorage` com tempo de validade
- [x] Tratamento de erro (`try/catch`) — inclusive erro 429 ("muitos pedidos")
- [ ] Testar no console do navegador (`F12`)

### Etapa 3 — Cartões de KPI
- [x] Preencher preço atual e variações 24h / 7d / 1 ano
- [x] Cor e seta conforme alta ou queda
- [x] Funções de formatação em `utils.js`

### Etapa 4 — Gráfico semanal
- [x] Gráfico de linha com os últimos 7 dias
- [x] Eixo X com datas, eixo Y com preço formatado
- [x] Linha sempre azul (verde/vermelho ficam reservados para "subiu/caiu" nos cartões)
- [x] Tooltip + linha vertical que segue o mouse

### Etapa 5 — Gráfico anual
- [x] Gráfico de área com os últimos 365 dias
- [x] Reaproveitar a mesma função de criar gráfico da etapa 4 (**não repetir código**)

### Etapa 6 — Seletor de período
- [x] Dois `<input type="date">` com `min`/`max` válidos
- [x] Validação: data inicial menor que a final; mostrar mensagem amigável se não for
- [x] Botões de atalho 7D / 30D / 90D / 1A
- [x] Ao aplicar: buscar dados, **atualizar** o gráfico (não recriar) e mostrar resumo (mín, máx, média, variação %)

### Etapa 7 — Tabela histórica
- [x] Agrupar dados por dia
- [x] Colunas: Data, Preço de fechamento, Variação do dia (%), Volume
- [x] Paginação simples (15 por página) e ordenação por data
- [x] Tabela segue o período escolhido no seletor

### Etapa 8 — Acabamento
- [x] Indicador de "carregando..." enquanto busca dados
- [x] Mensagem de erro amigável se a API falhar (com botão "Tentar novamente")
- [x] Botão USD ↔ BRL (busca os dados em BRL de verdade; se falhar, volta para a moeda anterior)
- [x] Testar no celular (DevTools → modo responsivo) — corrigido transbordamento da tabela (`minmax(0, 1fr)`)
- [x] Revisar acessibilidade: textos alternativos, contraste, `aria-label` nos botões — botão "Aplicar" escurecido (3,4:1 → 5,8:1)

### Etapa 9 (extra, opcional)
- [x] Atualização automática do preço a cada 60 s (pausa com a aba escondida)
- [x] Exportar a tabela para CSV (formato do Excel brasileiro: `;` e vírgula decimal)
- [x] Fallback para a API da Binance (automático; rodapé mostra a fonte usada)
- [x] Publicar grátis no GitHub Pages → https://ribeirothiagorj.github.io/bitcoin-dashboard/

---

## 7. Boas práticas que vamos aplicar

| Prática | O que é | Por que é boa |
|---|---|---|
| Separar responsabilidades | Cada arquivo/função faz uma só coisa | Fácil de entender, testar e consertar |
| Não repetir código (DRY) | Criar uma função e reusar | Corrige um bug em um lugar só |
| Constantes no topo | URLs e configurações em um lugar | Muda uma vez, vale para tudo |
| Nomes claros | `buscarHistorico` em vez de `bh` | O código "se explica sozinho" |
| Tratar erros | `try/catch` e mensagens ao usuário | A página não "quebra" em silêncio |
| Cache | Guardar respostas por um tempo | Respeita o limite da API e fica mais rápido |
| `async/await` | Jeito moderno de esperar respostas da internet | Código mais legível que `.then()` encadeado |
| Atualizar em vez de recriar gráficos | `chart.update()` | Evita vazamento de memória e "piscadas" |

---

## 8. Critérios de pronto

- [ ] Os 4 cartões mostram valores reais e corretos
- [ ] Gráfico semanal e anual carregam sem erros no console
- [ ] Escolher datas atualiza gráfico, resumo e tabela
- [ ] Datas inválidas mostram aviso (e não quebram a página)
- [ ] Funciona bem em tela de celular e de computador
- [ ] Recarregar a página várias vezes não estoura o limite da API (cache funcionando)

---

## 9. Riscos

| Risco | Como evitar |
|---|---|
| API bloquear por excesso de pedidos (erro 429) | Cache + não buscar a cada clique |
| API mudar regras ou sair do ar | Isolar tudo em `api.js`; ter a Binance como reserva |
| Abrir `index.html` com duplo clique e nada funcionar | Sempre usar Live Server ou `python -m http.server` |
| Muitos pontos deixarem o gráfico lento | Usar dados diários para períodos > 90 dias; `pointRadius: 0` |
