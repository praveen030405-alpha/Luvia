const express = require('express');
const { authMiddleware } = require('./auth');
const ChatHistory = require('../models/ChatHistory');
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
      chat = await ChatHistory.findOne({ _id: chatId, userId: req.user.userId });
      if (!chat) return res.status(404).json({ error: 'Chat not found' });
    } else {
      chat = new ChatHistory({
        userId: req.user.userId,
        title: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
        mode,
        messages: []
      });
    }

    // Add user message
    const userMessage = { role: 'user', content: message };
    chat.messages.push(userMessage);

    // Call AI Service
    const aiResponseContent = await aiService.generateResponse(chat.messages, chat.mode);
    
    // Add assistant message
    const assistantMessage = { role: 'assistant', content: aiResponseContent };
    chat.messages.push(assistantMessage);
    
    await chat.save();
    
    res.json({
      chatId: chat._id,
      message: assistantMessage
    });
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Get chat history list
router.get('/', async (req, res) => {
  try {
    const chats = await ChatHistory.find({ userId: req.user.userId })
      .select('title mode updatedAt')
      .sort({ updatedAt: -1 });
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Get specific chat
router.get('/:id', async (req, res) => {
  try {
    const chat = await ChatHistory.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

module.exports = router;
