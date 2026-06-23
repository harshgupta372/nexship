require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./src/app');

const PORT = process.env.PORT || 3001;

const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[auth-service] Connected to MongoDB');
    app.listen(PORT, () =>
      console.log(`[auth-service] Running on port ${PORT}`)
    );
  } catch (err) {
    console.error('[auth-service] Startup failed:', err.message);
    process.exit(1);
  }
};

start();
