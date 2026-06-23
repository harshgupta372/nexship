require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { startConsumer } = require('./src/kafka/consumer');
const { register } = require('./src/metrics');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'notification-service' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Expose notification logs so admin can audit what was sent
app.get('/notifications/:orderId', async (req, res) => {
  try {
    const NotificationLog = require('./src/models/NotificationLog');
    const logs = await NotificationLog.find({ orderId: req.params.orderId }).sort({ sentAt: -1 });
    return res.json({ logs });
  } catch (err) {
    console.error('[GET /notifications/:orderId]', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error('[unhandled]', err.message);
  res.status(500).json({ message: 'Internal server error' });
});

const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[notification-service] Connected to MongoDB');

    await startConsumer();

    app.listen(PORT, () =>
      console.log(`[notification-service] Running on port ${PORT}`)
    );
  } catch (err) {
    console.error('[notification-service] Startup failed:', err.message);
    process.exit(1);
  }
};

start();
