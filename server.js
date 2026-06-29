require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');

const authRoutes = require('./src/backend/routes/auth');
const chatRoutes = require('./src/backend/routes/chat');
const gemRoutes = require('./src/backend/routes/gems');
const workspaceRoutes = require('./src/backend/routes/workspace');
const uploadRoutes = require('./src/backend/routes/upload');
const { isMongoReady } = require('./src/backend/utils/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');

app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: false
}));
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '2mb' }));

async function connectMongo() {
  if (!process.env.MONGODB_URI) {
    console.warn('MongoDB URI is not configured; using local memory storage.');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('Connected to MongoDB.');
  } catch (error) {
    console.warn('MongoDB unavailable; using local memory storage. ' + error.message);
  }
}

connectMongo();

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    aiProvider: 'gemini',
    storage: isMongoReady() ? 'mongodb' : 'memory',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.Gemini_API_key || process.env.GOOGLE_API_KEY)
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/gems', gemRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/upload', uploadRoutes);

app.use(express.static(__dirname));

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('Luvia server running on http://localhost:' + PORT);
  });
}

module.exports = app;
