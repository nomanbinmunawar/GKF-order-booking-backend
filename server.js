require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const errorHandler = require('./middleware/errorHandler');

const ordersRouter = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security headers ─────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ── Middleware ───────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
  methods: ['GET', 'POST', 'DELETE'],
}));

app.use(express.json({ limit: '1mb' }));

// ── Routes ───────────────────────────────────
app.use('/api/orders', ordersRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Error handler
app.use(errorHandler);

// ── MongoDB + Server START ───────────────────
const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI missing');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on ${PORT}`);
    });

  })
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);

    // IMPORTANT: don't crash container immediately on Railway
    setTimeout(() => process.exit(1), 5000);
  });