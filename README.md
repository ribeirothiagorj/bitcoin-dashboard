# ₿ Bitcoin Dashboard

Dashboard em HTML que mostra o preço do Bitcoin e seu histórico, feito com HTML, CSS e JavaScript puros — sem frameworks e sem instalação.

## O que ele mostra

- **Cartões**: preço atual e variação em 24 h, 7 dias e 1 ano (atualizado sozinho a cada 60 s)
- **Gráfico semanal** (últimos 7 dias) e **gráfico anual** (últimos 365 dias)
- **Período personalizado**: escolha as datas ou use os atalhos 7D / 30D / 90D / 1A, com resumo (mínimo, máximo, média e variação)
- **Tabela de histórico diário** com paginação, ordenação e exportação para **CSV**
- Valores em **USD** ou **BRL**
- Funciona no computador e no celular

## Como rodar

O JavaScript usa módulos, que não funcionam abrindo o `index.html` com duplo clique. Use um servidor local:

- **VS Code**: instale a extensão *Live Server* e clique em **Go Live**
- **ou no terminal**, dentro da pasta do projeto:

  ```
  python -m http.server 8000
  ```

  e abra <http://localhost:8000>

## Tecnologias

| Parte | Ferramenta |
|---|---|
| Estrutura e estilo | HTML5 + CSS puro |
| Lógica | JavaScript (ES Modules) |
| Gráficos | [Chart.js 4](https://www.chartjs.org/) via CDN |
| Dados | [CoinGecko API](https://www.coingecko.com/en/api) (principal) e [Binance API](https://developers.binance.com/) (reserva) — gratuitas e sem chave |

## Estrutura

```
index.html        a página
css/style.css     cores e layout
js/main.js        inicia tudo e liga os eventos
js/api.js         busca os dados (com cache e API reserva)
js/charts.js      gráficos
js/table.js       tabela, paginação e CSV
js/utils.js       formatação e cálculos
```

## Limitações

- A API gratuita da CoinGecko só oferece os **últimos 365 dias** e aceita **poucos pedidos por minuto**. O site guarda respostas por 5 minutos e usa a Binance como reserva quando a CoinGecko recusa.
- Na Binance, o preço "em dólar" é contra o USDT (≈ US$ 1) e o volume é só o da própria Binance.

Os dados são apenas informativos e não são recomendação de investimento.
