const express = require('express');
const { authMiddleware } = require('./auth');
const Chat = require('../models/Chat');
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
      chat = await Chat.findOne({ _id: chatId, userId: req.user.userId });
      if (!chat) return res.status(404).json({ error: 'Chat not found' });
    } else {
      chat = new Chat({
        userId: req.user.userId,
        title: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
        mode,
        messages: []
      });
    }

    // Add user message
    chat.messages.push({ role: 'user', content: message });
    await chat.save(); // Save immediately so we don't lose the user's message if AI fails

    // Call AI Service
    // AI Service expects plain objects, so we map Mongoose documents to plain objects
    const formattedMessages = chat.messages.map(m => ({ role: m.role, content: m.content }));
    const aiResponseContent = await aiService.generateResponse(formattedMessages, chat.mode);
    
    // Add assistant message
    chat.messages.push({ role: 'assistant', content: aiResponseContent });
    await chat.save();
    
    res.json({
      chatId: chat._id,
      message: chat.messages[chat.messages.length - 1]
    });
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ error: 'Failed to process message', details: error.message });
  }
});

// Get chat history list
router.get('/', async (req, res) => {
  try {
    const userChats = await Chat.find({ userId: req.user.userId })
      .select('_id title mode updatedAt')
      .sort({ updatedAt: -1 });
    res.json(userChats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Get specific chat
router.get('/:id', async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

module.exports = router;
