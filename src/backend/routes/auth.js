const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
// In-memory user store for prototype
const users = [];
const generateId = () => Math.random().toString(36).substr(2, 9);

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    
    // Verify the Google JWT
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;
    
    // Find or create user in-memory
    let user = users.find(u => u.email === email);
    if (!user) {
      user = { _id: generateId(), email, name, picture, googleId };
      users.push(user);
    } else if (!user.googleId) {
      user.googleId = googleId;
      user.picture = picture;
    }
    
    // Issue our own JWT session token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );
    
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, picture: user.picture } });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

router.post('/guest', async (req, res) => {
  try {
    const { email, name } = req.body;
    let user = users.find(u => u.email === email);
    if (!user) {
      user = { _id: generateId(), email, name, googleId: 'guest-' + Date.now() };
      users.push(user);
    }
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch(err) {
    res.status(500).json({ error: 'Failed to create guest session' });
  }
});

// Middleware to protect routes
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = router;
module.exports.authMiddleware = authMiddleware;
