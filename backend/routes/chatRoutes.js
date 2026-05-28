const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getMessages,
  getChatList
} = require('../controllers/chatController');
const authMiddleware = require('../middleware/auth');

// POST /api/chat/send — message bhejo
router.post('/send', authMiddleware, sendMessage);

// GET /api/chat/:other_user_id — chat history
router.get('/:other_user_id', authMiddleware, getMessages);

// GET /api/chat — saari conversations
router.get('/', authMiddleware, getChatList);

module.exports = router;