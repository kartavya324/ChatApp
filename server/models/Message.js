const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['text', 'image'], default: 'text' },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  reactions: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, emoji: String }]
}, { timestamps: true })

module.exports = mongoose.model('Message', messageSchema)