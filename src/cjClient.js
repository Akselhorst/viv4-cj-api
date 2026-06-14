'use strict';

const axios = require('axios');

function normalizeAuthResponse(data) {
  if (!data || typeof data !== 'object') return {};
  const accessToken = data.accessToken || data.access_token;
  const refreshToken = data.refreshToken || data.refresh_token;
  const expiresInSec = data.expiresIn || data.expires_in;
  return { accessToken, refreshToken, expiresInSec };
}

function clearTokenStore(store) {
  if (store && typeof store.clearTokens === 'function') store.clearTokens();
  else if (store && typeof store.saveTokens === 'function') {
    store.saveTokens({ accessToken: null, refreshToken: null, expiresAt: 0 });
  }
}

class CJClient {
  constructor({ baseURL, apiKey, tokenStore, logger = console }) {
    this.apiKey = apiKey;
    this.tokenStore = tokenStore;
    this.logger = logger;

    this.client = axios.create({
      baseURL,
      timeout: 60_000,
    });

    this.client.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      config.headers = config.headers || {};
      config.headers['CJ-Access-Token'] = token;
      config.headers['Content-Type'] = 'application/json';
      return config;
    });
  }

  async getAccessToken() {
    // tokenStore is responsible for expiry check
    const token = this.tokenStore.getAccessToken();
    if (token && !this.tokenStore.isAccessTokenExpiring()) return token;
    return this.refreshTokens();
  }

  async refreshTokens() {
    try {
      const refreshToken = this.tokenStore.getRefreshToken();
      const useApiKey = !refreshToken;

      const url = `/authentication/${useApiKey ? 'getAccessToken' : 'refreshAccessToken'}`;
      const payload = useApiKey ? { apiKey: this.apiKey } : { refreshToken };

      const res = await axios.post(
        `${this.client.defaults.baseURL}${url}`,
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      );

      const { accessToken, refreshToken: newRefreshToken, expiresInSec } = normalizeAuthResponse(res.data || {});
      if (!accessToken) throw new Error('CJ auth: missing accessToken');

      // Default: 13 days, refresh 1 day early
      const now = Date.now();
      const expiresAt = expiresInSec ? now + expiresInSec * 1000 : now + 13 * 24 * 60 * 60 * 1000;
      this.tokenStore.saveTokens({ accessToken, refreshToken: newRefreshToken || refreshToken || null, expiresAt });
      return accessToken;
    } catch (err) {
      this.logger.error('[CJ] Auth failed', err?.response?.data || err?.message || err);
      clearTokenStore(this.tokenStore);
      throw err;
    }
  }

  async request(fn, ...args) {
    try {
      return await fn(...args);
    } catch (err) {
      // auto-retry once on 401
      const status = err?.response?.status;
      if (status === 401) {
        clearTokenStore(this.tokenStore);
        await this.refreshTokens();
        return fn(...args);
      }
      throw err;
    }
  }

  listProducts(params) {
    return this.request((p) => this.client.post('/product/listV2', p), params);
  }

  getProduct(params) {
    // cj PID detail
    return this.request((p) => this.client.post('/product/query', p), params);
  }

  getCategoryTree() {
    return this.request(() => this.client.post('/product/getCategory'));
  }

  queryVariants(params) {
    return this.request((p) => this.client.post('/product/variant/query', p), params);
  }

  stockBySku(params) {
    return this.request((p) => this.client.post('/product/stock/queryBySku', p), params);
  }

  freightCalculate(params) {
    return this.request((p) => this.client.post('/logistics/freightCalculate', p), params);
  }

  createOrderV3(params) {
    return this.request((p) => this.client.post('/purchases/order/createOrderV3', p), params);
  }

  confirmOrder(params) {
    return this.request((p) => this.client.post('/purchases/order/confirmOrder', p), params);
  }

  trackingInfo(params) {
    return this.request((p) => this.client.post('/logistics/trackingInfo', p), params);
  }
}

module.exports = { CJClient };
