# viv4-cj-api

Gateway CJ (API Key) pro backend do VIV4.

> Importante: **não commit .env com chave/token**. Use secrets/variáveis do ambiente.

## Variáveis (server)

```bash
CJ_API_KEY=COLOQUE_AQUI
CJ_API_BASE=https://developers.cjdropshipping.com/api2.0/v1
```

## Cliente (axios)

```js
const axios = require('axios');

async function getAccessToken(apiKey, refreshToken) {
  const path = refreshToken ? 'refreshAccessToken' : 'getAccessToken';
  const payload = refreshToken ? { refreshToken } : { apiKey };
  const { data } = await axios.post(
    `${process.env.CJ_API_BASE}/authentication/${path}`,
    payload,
    { headers: { 'Content-Type': 'application/json' } }
  );
  return data;
}
```

## Endpoints CJ que usamos
- autenticação: `/authentication/getAccessToken`, `/authentication/refreshAccessToken`
- produtos: `/product/listV2`, `/product/query`
- estoque: `/product/stock/queryBySku`
- frete: `/logistics/freightCalculate`

Doc da API: https://developers.cjdropshipping.com/api2.0/v1
