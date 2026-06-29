const mongoose = require('mongoose');

const GemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  instructions: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    default: '#38f2d0',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('Gem', GemSchema);
