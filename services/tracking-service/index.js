require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const trackingRoutes = require('./src/routes/tracking');
const { startConsumer } = require('./src/kafka/consumer');
const { register } = require('./src/metrics');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'tracking-service' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/tracking', trackingRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error('[unhandled]', err.message);
  res.status(500).json({ message: 'Internal server error' });
});

const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[tracking-service] Connected to MongoDB');

    await startConsumer();

    app.listen(PORT, () =>
      console.log(`[tracking-service] Running on port ${PORT}`)
    );
  } catch (err) {
    console.error('[tracking-service] Startup failed:', err.message);
    process.exit(1);
  }
};

start();
