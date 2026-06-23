require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { v4: uuidv4 } = require('uuid');
const authenticate = require('./src/middleware/auth');
const { register, httpRequestsTotal, httpRequestDurationSeconds } = require('./src/metrics');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Request ID ──────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  console.log(`[gateway] ${req.method} ${req.path} x-request-id:${requestId}`);
  next();
});

// ─── HTTP Metrics ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestsTotal.inc({ method: req.method, route: req.path, status: res.statusCode, service: 'gateway' });
    httpRequestDurationSeconds.observe({ method: req.method, route: req.path, service: 'gateway' }, duration);
  });
  next();
});

// ─── JWT Auth ────────────────────────────────────────────────────────────────
app.use(authenticate);

// ─── Health + Metrics ────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'gateway' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ─── Service Route Map ───────────────────────────────────────────────────────
// All services communicate ONLY through this gateway — no direct service calls
const routes = [
  { prefix: '/auth',          target: process.env.AUTH_SERVICE_URL },
  { prefix: '/orders',        target: process.env.ORDER_SERVICE_URL },
  { prefix: '/tracking',      target: process.env.TRACKING_SERVICE_URL },
  { prefix: '/notifications', target: process.env.NOTIFICATION_SERVICE_URL },
  { prefix: '/analytics',     target: process.env.ANALYTICS_SERVICE_URL },
];

// Using pathFilter instead of app.use(prefix, proxy) so Express does NOT
// strip the prefix — the full path (e.g. /auth/register) reaches the service
routes.forEach(({ prefix, target }) => {
  app.use(
    createProxyMiddleware({
      pathFilter: prefix,
      target,
      changeOrigin: true,
      on: {
        error: (err, req, res) => {
          console.error(`[gateway] Proxy error → ${prefix}:`, err.message);
          res.status(502).json({ message: 'Upstream service unavailable' });
        },
        proxyReq: (proxyReq, req) => {
          if (req.headers['x-user-id'])     proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
          if (req.headers['x-user-role'])   proxyReq.setHeader('x-user-role', req.headers['x-user-role']);
          if (req.headers['x-request-id'])  proxyReq.setHeader('x-request-id', req.headers['x-request-id']);
        },
      },
    })
  );
});

// ─── 404 Fallback ────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

app.listen(PORT, () => console.log(`[gateway] Running on port ${PORT}`));
