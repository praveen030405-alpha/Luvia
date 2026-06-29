const express = require('express');
const { authMiddleware } = require('./auth');
const Chat = require('../models/Chat');
const aiService = require('../services/ai.service');
const memoryStore = require('../services/memory-store');
const { isMongoReady } = require('../utils/db');

const router = express.Router();

router.use(authMiddleware);

function compactTitle(message) {
  const text = String(message || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'New Chat';
  return text.length > 42 ? text.slice(0, 39) + '...' : text;
}

function serializeChatId(chat) {
  return String(chat._id || chat.id);
}

async function createChat(userId, message, mode) {
  const title = compactTitle(message);
  if (!isMongoReady()) {
    return memoryStore.createChat({ userId: userId, title: title, mode: mode, messages: [] });
  }

  return new Chat({
    userId: userId,
    title: title,
    mode: mode,
    messages: []
  });
}

async function findChat(chatId, userId) {
  if (!chatId) return null;
  if (!isMongoReady()) return memoryStore.findChat(chatId, userId);
  return Chat.findOne({ _id: chatId, userId: userId });
}

async function saveChat(chat) {
  if (chat && typeof chat.save === 'function') return chat.save();
  return memoryStore.saveChat(chat);
}

function appendMessage(chat, role, content) {
  chat.messages.push({ role: role, content: content });
}

router.post('/message', async (req, res) => {
  try {
    const { chatId, message, mode = 'fusion', systemInstruction = '', image = null } = req.body;
    if (!message || !String(message).trim()) return res.status(400).json({ error: 'Message is required' });

    let chat = chatId ? await findChat(chatId, req.user.userId) : null;
    if (chatId && !chat) return res.status(404).json({ error: 'Chat not found' });
    if (!chat) chat = await createChat(req.user.userId, message, mode);

    appendMessage(chat, 'user', String(message));
    chat = await saveChat(chat);

    const formattedMessages = chat.messages.map((item) => ({ role: item.role, content: item.content }));
    const aiResponseContent = await aiService.generateResponse(formattedMessages, chat.mode || mode, systemInstruction, image);

    appendMessage(chat, 'assistant', aiResponseContent);
    chat = await saveChat(chat);

    res.json({
      chatId: serializeChatId(chat),
      message: chat.messages[chat.messages.length - 1]
    });
  } catch (error) {
    console.error('Chat Error:', error.message);
    res.status(500).json({ error: 'Failed to process message', details: error.message });
  }
});

router.post('/stream', async (req, res) => {
  let chat;

  try {
    const { chatId, message, mode = 'fusion', systemInstruction = '', image = null } = req.body;
    if (!message || !String(message).trim()) return res.status(400).json({ error: 'Message is required' });

    chat = chatId ? await findChat(chatId, req.user.userId) : null;
    if (chatId && !chat) return res.status(404).json({ error: 'Chat not found' });
    if (!chat) chat = await createChat(req.user.userId, message, mode);

    appendMessage(chat, 'user', String(message));
    chat.mode = mode || chat.mode || 'fusion';
    chat = await saveChat(chat);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Prevent proxy buffering
    res.flushHeaders && res.flushHeaders();

    res.write('data: ' + JSON.stringify({ type: 'init', chatId: serializeChatId(chat) }) + '\n\n');

    const formattedMessages = chat.messages.map((item) => ({ role: item.role, content: item.content }));
    let fullContent = '';

    for await (const delta of aiService.generateStream(formattedMessages, chat.mode, systemInstruction, image)) {
      fullContent += delta;
      res.write('data: ' + JSON.stringify({ type: 'chunk', text: delta }) + '\n\n');
    }

    if (!fullContent.trim()) fullContent = 'I could not produce a response for that request.';
    appendMessage(chat, 'assistant', fullContent);
    await saveChat(chat);

    res.write('data: ' + JSON.stringify({ type: 'done' }) + '\n\n');
    res.end();
  } catch (error) {
    console.error('Chat Stream Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Stream failed', details: error.message });
      return;
    }
    res.write('data: ' + JSON.stringify({ type: 'error', message: error.message }) + '\n\n');
    res.end();
  }
});

router.get('/', async (req, res) => {
  try {
    if (!isMongoReady()) return res.json(await memoryStore.listChats(req.user.userId));

    const userChats = await Chat.find({ userId: req.user.userId })
      .select('_id title mode updatedAt')
      .sort({ updatedAt: -1 });
    res.json(userChats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const chat = await findChat(req.params.id, req.user.userId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    let deleted;
    if (!isMongoReady()) {
      deleted = await memoryStore.deleteChat(req.params.id, req.user.userId);
    } else {
      deleted = await Chat.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    }

    if (!deleted) return res.status(404).json({ error: 'Chat not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

module.exports = router;
