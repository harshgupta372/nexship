require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const authenticate = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── JWT Auth ────────────────────────────────────────────────────────────────
app.use(authenticate);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'gateway' }));

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
          if (req.headers['x-user-id']) {
            proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
          }
          if (req.headers['x-user-role']) {
            proxyReq.setHeader('x-user-role', req.headers['x-user-role']);
          }
        },
      },
    })
  );
});

// ─── 404 Fallback ────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

app.listen(PORT, () => console.log(`[gateway] Running on port ${PORT}`));
