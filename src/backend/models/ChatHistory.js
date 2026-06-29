const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  }
});

const ChatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    default: 'New Chat',
  },
  messages: [MessageSchema],
  mode: {
    type: String,
    enum: ['fusion', 'reasoning', 'fast', 'ca'],
    default: 'fusion',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

ChatHistorySchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('ChatHistory', ChatHistorySchema);
