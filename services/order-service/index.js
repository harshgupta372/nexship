require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const orderRoutes = require('./src/routes/orders');
const { connectProducer } = require('./src/kafka/producer');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'order-service' }));

app.use('/orders', orderRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error('[unhandled]', err.message);
  res.status(500).json({ message: 'Internal server error' });
});

const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[order-service] Connected to MongoDB');

    await connectProducer();

    app.listen(PORT, () =>
      console.log(`[order-service] Running on port ${PORT}`)
    );
  } catch (err) {
    console.error('[order-service] Startup failed:', err.message);
    process.exit(1);
  }
};

start();
