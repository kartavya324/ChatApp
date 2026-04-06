const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const http = require('http')
const { Server } = require('socket.io')
require('dotenv').config()

const authRoutes = require('./routes/auth')
const messageRoutes = require('./routes/messages')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
})

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api', messageRoutes)

app.get('/', (req, res) => {
  res.json({ message: 'FlowStack server is running!' })
})

const onlineUsers = new Map()

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id)

  socket.on('join', (userId) => {
    onlineUsers.set(userId, socket.id)
    console.log(`${userId} is online`)
    io.emit('user_online', userId)
    const onlineUserIds = Array.from(onlineUsers.keys())
    socket.emit('online_users', onlineUserIds)
  })

  socket.on('send_message', ({ message, participants }) => {
    participants.forEach((participant) => {
      const participantId = participant._id || participant
      if (participantId !== message.sender) {
        const receiverSocketId = onlineUsers.get(participantId)
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('receive_message', message)
        }
      }
    })
  })

  socket.on('typing', ({ conversationId, userId, participants }) => {
    participants.forEach((participant) => {
      const participantId = participant._id || participant
      if (participantId !== userId) {
        const receiverSocketId = onlineUsers.get(participantId)
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('typing', { conversationId, userId })
        }
      }
    })
  })

  socket.on('stop_typing', ({ conversationId, userId, participants }) => {
    participants.forEach((participant) => {
      const participantId = participant._id || participant
      if (participantId !== userId) {
        const receiverSocketId = onlineUsers.get(participantId)
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('stop_typing', { conversationId })
        }
      }
    })
  })

  socket.on('message_read', ({ conversationId, userId, participants }) => {
    participants.forEach((participant) => {
      const participantId = participant._id || participant
      if (participantId !== userId) {
        const receiverSocketId = onlineUsers.get(participantId)
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('message_read', { conversationId })
        }
      }
    })
  })

  socket.on('disconnect', () => {
    onlineUsers.forEach((socketId, userId) => {
      if (socketId === socket.id) {
        onlineUsers.delete(userId)
        console.log(`${userId} went offline`)
        io.emit('user_offline', userId)
      }
    })
  })
})

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected!')
    server.listen(process.env.PORT, () => {
      console.log(`Server running on port ${process.env.PORT}`)
    })
  })
  .catch((err) => console.log('MongoDB connection error:', err))