// Socket.io — Real time chat ke liye
// Jaise WhatsApp mein message turant deliver hota hai

const jwt = require('jsonwebtoken');
require('dotenv').config();

let io;

const initSocket = (server) => {
  io = require('socket.io')(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Middleware — socket connection pe token verify karo
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.user.user_id}`);

    // User apne room mein join karo
    // Room = user_id — sirf us user ko message milega
    socket.join(socket.user.user_id);

    // Send message event
    socket.on('send_message', async (data) => {
      const { receiver_id, message_text, job_id } = data;

      // Message receiver ke room mein bhejo
      io.to(receiver_id).emit('new_message', {
        sender_id: socket.user.user_id,
        message_text,
        job_id,
        created_at: new Date()
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.user.user_id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket not initialized');
  return io;
};

module.exports = { initSocket, getIO };