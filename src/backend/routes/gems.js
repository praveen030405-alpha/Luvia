const express = require('express');
const { authMiddleware } = require('./auth');
const Gem = require('../models/Gem');

const router = express.Router();

// Apply auth middleware
router.use(authMiddleware);

// Get all gems for user
router.get('/', async (req, res) => {
  try {
    const gems = await Gem.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(gems);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch gems' });
  }
});

// Create a new gem
router.post('/', async (req, res) => {
  try {
    const { name, description, instructions, color } = req.body;
    const gem = new Gem({
      userId: req.user.userId,
      name,
      description,
      instructions,
      color
    });
    await gem.save();
    res.status(201).json(gem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create gem' });
  }
});

module.exports = router;
