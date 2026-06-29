const crypto = require('crypto');

const usersByEmail = new Map();
const chatsById = new Map();

function makeId(prefix) {
  if (crypto.randomUUID) return prefix + '_' + crypto.randomUUID();
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function now() {
  return new Date().toISOString();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: user._id,
    _id: user._id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    googleId: user.googleId
  };
}

async function upsertUser(input) {
  const email = normalizeEmail(input.email);
  if (!email) throw new Error('Email is required');

  const existing = usersByEmail.get(email);
  if (existing) {
    existing.name = input.name || existing.name;
    existing.picture = input.picture || existing.picture;
    existing.googleId = input.googleId || existing.googleId;
    existing.updatedAt = now();
    return clone(existing);
  }

  const user = {
    _id: makeId('user'),
    email: email,
    name: input.name || email.split('@')[0],
    picture: input.picture || '',
    googleId: input.googleId || '',
    createdAt: now(),
    updatedAt: now()
  };
  usersByEmail.set(email, user);
  return clone(user);
}

async function createChat(input) {
  const created = now();
  const chat = {
    _id: makeId('chat'),
    userId: String(input.userId),
    title: input.title || 'New Chat',
    mode: input.mode || 'fusion',
    messages: Array.isArray(input.messages) ? input.messages : [],
    createdAt: created,
    updatedAt: created
  };
  chatsById.set(chat._id, chat);
  return clone(chat);
}

async function findChat(chatId, userId) {
  const chat = chatsById.get(String(chatId));
  if (!chat || String(chat.userId) !== String(userId)) return null;
  return clone(chat);
}

async function saveChat(chat) {
  const next = Object.assign({}, chat, { updatedAt: now() });
  chatsById.set(String(next._id), clone(next));
  return clone(next);
}

async function listChats(userId) {
  return Array.from(chatsById.values())
    .filter(function (chat) {
      return String(chat.userId) === String(userId);
    })
    .sort(function (a, b) {
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    })
    .map(function (chat) {
      return {
        _id: chat._id,
        title: chat.title,
        mode: chat.mode,
        updatedAt: chat.updatedAt
      };
    });
}

async function deleteChat(chatId, userId) {
  const chat = chatsById.get(String(chatId));
  if (!chat || String(chat.userId) !== String(userId)) return false;
  chatsById.delete(String(chatId));
  return true;
}

module.exports = {
  createChat: createChat,
  deleteChat: deleteChat,
  findChat: findChat,
  listChats: listChats,
  publicUser: publicUser,
  saveChat: saveChat,
  upsertUser: upsertUser
};
