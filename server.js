require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

// Import Routes
const authRoutes = require('./src/backend/routes/auth');
const chatRoutes = require('./src/backend/routes/chat');
const gemRoutes = require('./src/backend/routes/gems');
const workspaceRoutes = require('./src/backend/routes/workspace');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Middleware
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  contentSecurityPolicy: false // Disabled for prototype to allow external CDNs (TensorFlow, Chart.js, Google Auth)
}));
app.use(cors({ origin: '*', credentials: false })); // Allow all origins so local file:// testing works
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api/', limiter);

// Serve static frontend files from current directory
app.use(express.static(__dirname));

// Database connection cache for serverless
let isConnected;
const connectDB = async () => {
  if (isConnected) return;
  try {
    const db = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/luvia', {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = db.connections[0].readyState;
    console.log('✅ Connected to MongoDB');
  } catch(err) {
    console.error('❌ MongoDB connection error:', err.message);
    throw err;
  }
};

// Global DB middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch(err) {
    res.status(500).json({ error: 'Database connection failed: ' + err.message });
  }
});

// Initialize Vector Database (Advanced RAG)
const vectorService = require('./src/backend/services/vector.service');
const caSyllabus = require('./src/backend/data/ca_syllabus_mock');
// Disable auto-indexing on cold start for Vercel compatibility
// (async () => {
//   try {
//     console.log('📚 Indexing CA Syllabus into Vector Database...');
//     for (const doc of caSyllabus) {
//       await vectorService.indexDocument(doc.id, doc.text, doc.metadata);
//     }
//     console.log('✅ Vector Database Ready! Indexed ' + caSyllabus.length + ' CA documents.');
//   } catch (err) {
//     console.error('❌ Failed to index vectors:', err);
//   }
// })();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/gems', gemRoutes);
app.use('/api/workspace', workspaceRoutes);

// Fallback for frontend routing (if using SPA)
app.use((req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server: ' + err.message, stack: err.stack });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Luvia server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel Serverless
module.exports = app;
