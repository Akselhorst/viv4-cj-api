'use strict';

require('dotenv').config();

const express = require('express');
const cron = require('node-cron');

const { CJClient } = require('./cjClient');
const tokenStore = require('./tokenStore');

const CJ_API_KEY = process.env.CJ_API_KEY;
const CJ_API_BASE = process.env.CJ_API_BASE || process.env.CJ_BASE_URL;

if (!CJ_API_KEY || !CJ_API_BASE) {
  // Keep it loud to avoid running a "silent broken" backend.
  console.error('[CJ] Missing CJ_API_KEY or CJ_API_BASE. Check your .env / secrets.');
}

const cj = new CJClient({
  baseURL: CJ_API_BASE,
  apiKey: CJ_API_KEY,
  tokenStore,
  logger: console,
});

// Optional boot-time token generation (so the first request is fast)
cj.refreshTokens().catch((err) => console.error('[CJ] Boot-time refresh failed', err?.response?.data || err?.message || err));

// Scheduled refresh so we never expire during peak traffic
cron.schedule('0 */6 * * *', async () => {
  try {
    await cj.refreshTokens();
    console.log('[CJ] Tokens refreshed (cron)');
  } catch (err) {
    console.error('[CJ] Cron refresh failed', err?.response?.data || err?.message || err);
  }
});

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

function sendError(res, err) {
  const status = err?.response?.status || err?.status || 500;
  const payload = err?.response?.data || { message: err?.message || 'Internal error' };
  res.status(status).json({ status, payload });
}

// Products list
app.post('/v1/cj/products/list', async (req, res) => {
  try {
    const body = req.body || {};
    const pageNo = Number(body.pageNo || body.page || 1);
    const pageSize = Number(body.pageSize || body.page_size || 50);

    const filters = {
      pageNo,
      pageSize,
      keyword: body.keyword || body.q || '',
      categoryId: body.categoryId || body.category_id || '',
      // Add warehouse / country / etc here if needed
    };

    const r = await cj.listProducts(filters);
    res.json(r.data);
  } catch (err) {
    sendError(res, err);
  }
});

// Product detail
app.get('/v1/cj/products/:pid', async (req, res) => {
  try {
    const r = await cj.getProduct({ pid: req.params.pid });
    res.json(r.data);
  } catch (err) {
    sendError(res, err);
  }
});

// Categories
app.get('/v1/cj/categories/tree', async (_req, res) => {
  try {
    const r = await cj.getCategoryTree();
    res.json(r.data);
  } catch (err) {
    sendError(res, err);
  }
});

// Stock
app.get('/v1/cj/stock/:sku', async (req, res) => {
  try {
    const r = await cj.stockBySku({ sku: req.params.sku });
    res.json(r.data);
  } catch (err) {
    sendError(res, err);
  }
});

// Shipping cost
app.post('/v1/cj/freight/calculate', async (req, res) => {
  try {
    const r = await cj.freightCalculate(req.body || {});
    res.json(r.data);
  } catch (err) {
    sendError(res, err);
  }
});

// Order
app.post('/v1/cj/orders/create', async (req, res) => {
  try {
    const r = await cj.createOrderV3(req.body || {});
    res.json(r.data);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/v1/cj/orders/confirm', async (req, res) => {
  try {
    const r = await cj.confirmOrder(req.body || {});
    res.json(r.data);
  } catch (err) {
    sendError(res, err);
  }
});

// Tracking
app.get('/v1/cj/tracking/:orderId', async (req, res) => {
  try {
    const r = await cj.trackingInfo({ orderId: req.params.orderId });
    res.json(r.data);
  } catch (err) {
    sendError(res, err);
  }
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`[CJ] Gateway ready on port ${PORT}`);
});
