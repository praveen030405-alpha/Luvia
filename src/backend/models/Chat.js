const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    default: 'New Chat'
  },
  mode: {
    type: String,
    default: 'fusion'
  },
  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'system'] },
    content: String
  }],
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
