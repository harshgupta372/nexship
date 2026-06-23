const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'nexship_node_' });

const httpRequestsTotal = new client.Counter({
  name: 'nexship_http_requests_total',
  help: 'Total HTTP requests handled',
  labelNames: ['method', 'route', 'status', 'service'],
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'nexship_http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'service'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

module.exports = { register, httpRequestsTotal, httpRequestDurationSeconds };
