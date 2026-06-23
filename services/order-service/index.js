require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./src/app');
const { connectProducer } = require('./src/kafka/producer');

const PORT = process.env.PORT || 3002;

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
