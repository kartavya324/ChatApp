const express = require('express')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const Conversation = require('../models/Conversation')
const Message = require('../models/Message')
const cloudinary = require('cloudinary').v2
const multer = require('multer')
const { CloudinaryStorage } = require('multer-storage-cloudinary')

cloudinary.config({
  cloud_name: 'ChatApp',
  api_key: '381892649671993',
  api_secret: 'TS9QUHgxFTwJmYDRz'
})

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'flowstack',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
  }
})

const upload = multer({ storage })

const router = express.Router()

const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ message: 'No token' })
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = decoded.userId
    next()
  } catch {
    res.status(401).json({ message: 'Invalid token' })
  }
}

// GET all users
router.get('/users', protect, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } }).select('-password')
    res.json(users)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// GET or CREATE 1:1 conversation
router.post('/conversations', protect, async (req, res) => {
  try {
    const { receiverId } = req.body
    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.userId, receiverId], $size: 2 }
    })
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.userId, receiverId],
        isGroup: false
      })
    }
    res.json(conversation)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// CREATE group conversation
router.post('/conversations/group', protect, async (req, res) => {
  try {
    const { name, memberIds } = req.body
    const participants = [...new Set([req.userId, ...memberIds])]
    const conversation = await Conversation.create({
      participants,
      isGroup: true,
      groupName: name,
      groupAdmin: req.userId
    })
    res.json(conversation)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// GET all conversations
router.get('/conversations', protect, async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.userId })
      .populate('participants', '-password')
      .populate('lastMessage')
      .sort({ lastMessageTime: -1 })
    res.json(conversations)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// GET messages in a conversation
router.get('/messages/:conversationId', protect, async (req, res) => {
  try {
    const messages = await Message.find({
      conversationId: req.params.conversationId
    })
      .populate('sender', 'name')
      .sort({ createdAt: 1 })
    res.json(messages)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// POST send a text message
router.post('/messages', protect, async (req, res) => {
  try {
    const { conversationId, content } = req.body
    const message = await Message.create({
      conversationId,
      sender: req.userId,
      content,
      type: 'text'
    })
    await message.populate('sender', 'name')
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      lastMessageTime: Date.now()
    })
    res.status(201).json(message)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// POST upload image message
router.post('/messages/image', protect, upload.single('image'), async (req, res) => {
  try {
    const { conversationId } = req.body
    const message = await Message.create({
      conversationId,
      sender: req.userId,
      content: req.file.path,
      type: 'image'
    })
    await message.populate('sender', 'name')
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      lastMessageTime: Date.now()
    })
    res.status(201).json(message)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// POST add reaction to message
router.post('/messages/:messageId/reaction', protect, async (req, res) => {
  try {
    const { emoji } = req.body
    const message = await Message.findById(req.params.messageId)
    if (!message) return res.status(404).json({ message: 'Message not found' })

    const existingIndex = message.reactions.findIndex(
      (r) => r.userId.toString() === req.userId
    )

    if (existingIndex > -1) {
      if (message.reactions[existingIndex].emoji === emoji) {
        message.reactions.splice(existingIndex, 1)
      } else {
        message.reactions[existingIndex].emoji = emoji
      }
    } else {
      message.reactions.push({ userId: req.userId, emoji })
    }

    await message.save()
    res.json(message)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// DELETE a message
router.delete('/messages/:messageId', protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId)
    if (!message) return res.status(404).json({ message: 'Message not found' })
    if (message.sender.toString() !== req.userId) {
      return res.status(401).json({ message: 'Not authorized' })
    }
    await Message.findByIdAndDelete(req.params.messageId)
    res.json({ message: 'Message deleted' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

module.exports = router