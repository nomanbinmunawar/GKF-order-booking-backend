require('dotenv').config();
const express      = require('express');
const mongoose     = require('mongoose');
const cors         = require('cors');
const errorHandler = require('./middleware/errorHandler');

const ordersRouter = require('./routes/orders');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security headers (manual, no helmet dep) ───────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ── Core middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
  methods: ['GET', 'POST', 'DELETE'],
}));
app.use(express.json({ limit: '1mb' }));

// Simple in-memory rate limiter (no extra dep)
const requestCounts = new Map();
app.use((req, res, next) => {
  const ip  = req.ip || req.connection.remoteAddress || 'unknown';
  const key = `${ip}:${Math.floor(Date.now() / 60000)}`; // per minute window
  const count = (requestCounts.get(key) || 0) + 1;
  requestCounts.set(key, count);
  // cleanup old windows periodically
  if (requestCounts.size > 10000) requestCounts.clear();
  if (count > 200) {
    return res.status(429).json({ success: false, message: 'Too many requests. Slow down.' });
  }
  next();
});

// ── Routes ─────────────────────────────────────────────────────────────────
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
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global error handler (must be last)
app.use(errorHandler);

// ── MongoDB ────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌  MONGODB_URI is not defined in .env');
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log('✅  Connected to MongoDB Atlas');
  app.listen(5000, "0.0.0.0", () => {
  console.log("Server running on 5000");
});
  })
  .catch(err => {
    console.error('❌  MongoDB connection error:', err.message);
    process.exit(1);
  });
