const express = require('express');
const orderRoutes = require('./routes/orders');
const { register, httpRequestsTotal, httpRequestDurationSeconds } = require('./metrics');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const route = req.route ? req.route.path : req.path;
    const duration = (Date.now() - start) / 1000;
    httpRequestsTotal.inc({ method: req.method, route, status: res.statusCode, service: 'order-service' });
    httpRequestDurationSeconds.observe({ method: req.method, route, service: 'order-service' }, duration);
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'order-service' }));
app.use('/orders', orderRoutes);
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error('[unhandled]', err.message);
  res.status(500).json({ message: 'Internal server error' });
});

module.exports = app;
