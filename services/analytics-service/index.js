require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const analyticsRoutes = require('./src/routes/analytics');
const { startConsumer } = require('./src/kafka/consumer');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'analytics-service' }));

app.use('/analytics', analyticsRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error('[unhandled]', err.message);
  res.status(500).json({ message: 'Internal server error' });
});

const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[analytics-service] Connected to MongoDB');

    await startConsumer();

    app.listen(PORT, () =>
      console.log(`[analytics-service] Running on port ${PORT}`)
    );
  } catch (err) {
    console.error('[analytics-service] Startup failed:', err.message);
    process.exit(1);
  }
};

start();
