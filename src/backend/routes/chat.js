const express = require('express');
const { authMiddleware } = require('./auth');
// In-memory chat store for prototype
const chats = [];
const generateId = () => Math.random().toString(36).substr(2, 9);
const aiService = require('../services/ai.service');

const router = express.Router();

// Apply auth middleware to all chat routes
router.use(authMiddleware);

// Send a message
router.post('/message', async (req, res) => {
  try {
    const { chatId, message, mode = 'fusion' } = req.body;
    
    let chat;
    if (chatId) {
      chat = chats.find(c => c._id === chatId && c.userId === req.user.userId);
      if (!chat) return res.status(404).json({ error: 'Chat not found' });
    } else {
      chat = {
        _id: generateId(),
        userId: req.user.userId,
        title: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
        mode,
        messages: [],
        updatedAt: new Date()
      };
      chats.push(chat);
    }

    // Add user message
    const userMessage = { role: 'user', content: message };
    chat.messages.push(userMessage);

    // Call AI Service
    const aiResponseContent = await aiService.generateResponse(chat.messages, chat.mode);
    
    // Add assistant message
    const assistantMessage = { role: 'assistant', content: aiResponseContent };
    chat.messages.push(assistantMessage);
    
    chat.updatedAt = new Date();
    
    res.json({
      chatId: chat._id,
      message: assistantMessage
    });
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ error: 'Failed to process message', details: error.message });
  }
});

// Get chat history list
router.get('/', async (req, res) => {
  try {
    const userChats = chats
      .filter(c => c.userId === req.user.userId)
      .map(c => ({ _id: c._id, title: c.title, mode: c.mode, updatedAt: c.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    res.json(userChats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Get specific chat
router.get('/:id', async (req, res) => {
  try {
    const chat = chats.find(c => c._id === req.params.id && c.userId === req.user.userId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

module.exports = router;
