require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
// Import Routes
const authRoutes = require('./src/backend/routes/auth');
const chatRoutes = require('./src/backend/routes/chat');
// Other routes removed for prototype
const app = express();
const PORT = process.env.PORT || 3000;

// Security & Middleware
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  contentSecurityPolicy: false // Disabled for prototype to allow external CDNs (TensorFlow, Chart.js, Google Auth)
}));
app.use(cors({ origin: '*', credentials: false })); // Allow all origins so local file:// testing works
app.use(express.json());

// Rate Limiting removed for prototype stability

// Serve static frontend files from current directory
app.use(express.static(__dirname));

// Database Connection
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
}).then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

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
// Unused routes removed for prototype

// Fallback for frontend routing (if using SPA)
app.use((req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Luvia server running on http://localhost:${PORT}`);
  });
}

// Catch unhandled rejections to prevent Vercel from crashing completely
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export for Vercel Serverless
module.exports = app;
