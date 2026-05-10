require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./src/routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());

// ─── Health Check ────────────────────────────────────────────────────────────
// Used by Docker Compose healthcheck and the gateway's depends_on condition
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'auth-service' }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[unhandled]', err.message);
  res.status(500).json({ message: 'Internal server error' });
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────
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
