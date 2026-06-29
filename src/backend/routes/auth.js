const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const memoryStore = require('../services/memory-store');
const { isMongoReady } = require('../utils/db');

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function publicUser(user) {
  return {
    id: String(user._id || user.id),
    name: user.name,
    email: user.email,
    picture: user.picture || ''
  };
}

function issueToken(user) {
  return jwt.sign(
    { userId: String(user._id || user.id), email: user.email },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '7d' }
  );
}

async function upsertUser(input) {
  const email = String(input.email || '').trim().toLowerCase();
  if (!email) throw new Error('Email is required');

  if (!isMongoReady()) {
    return memoryStore.upsertUser(Object.assign({}, input, { email: email }));
  }

  let user = await User.findOne({ email: email });
  if (!user) {
    user = new User({
      email: email,
      name: input.name || email.split('@')[0],
      picture: input.picture || '',
      googleId: input.googleId || ''
    });
    await user.save();
    return user;
  }

  user.name = input.name || user.name;
  user.picture = input.picture || user.picture;
  user.googleId = input.googleId || user.googleId;
  await user.save();
  return user;
}

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Google credential is required' });

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const user = await upsertUser({
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      googleId: payload.sub
    });

    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('Google Auth Error:', error.message);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

router.post('/guest', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const name = String(req.body.name || '').trim() || email.split('@')[0];
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email is required' });

    const user = await upsertUser({
      email: email,
      name: name,
      googleId: 'guest-' + email
    });

    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('Guest Auth Error:', error.message);
    res.status(500).json({ error: 'Failed to authenticate guest' });
  }
});

function authMiddleware(req, res, next) {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user.userId = String(req.user.userId);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = router;
module.exports.authMiddleware = authMiddleware;
