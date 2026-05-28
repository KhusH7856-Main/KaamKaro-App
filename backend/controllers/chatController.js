const pool = require('../config/db');
require('dotenv').config();

// =============================================
// SEND MESSAGE
// Message database mein save karo
// =============================================
const sendMessage = async (req, res) => {
  try {
    const sender_id = req.user.user_id;
    const { receiver_id, message_text, job_id } = req.body;

    if (!receiver_id || !message_text) {
      return res.status(400).json({
        success: false,
        message: 'receiver_id and message_text are required'
      });
    }

    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, job_id, message_text)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [sender_id, receiver_id, job_id, message_text]
    );

    return res.status(201).json({
      success: true,
      message: result.rows[0]
    });

  } catch (err) {
    console.error('sendMessage error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// GET MESSAGES
// Do logon ke beech ki chat history
// =============================================
const getMessages = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { other_user_id } = req.params;

    const result = await pool.query(
      `SELECT
        m.*,
        u.name AS sender_name
       FROM messages m
       JOIN users u ON m.sender_id = u.user_id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2)
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at ASC`,
      [user_id, other_user_id]
    );

    // Mark messages as read
    await pool.query(
      `UPDATE messages SET is_read = true
       WHERE receiver_id = $1 AND sender_id = $2 AND is_read = false`,
      [user_id, other_user_id]
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      messages: result.rows
    });

  } catch (err) {
    console.error('getMessages error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// GET CHAT LIST
// Saari conversations ki list
// =============================================
const getChatList = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const result = await pool.query(
      `SELECT DISTINCT ON (other_user)
        CASE
          WHEN m.sender_id = $1 THEN m.receiver_id
          ELSE m.sender_id
        END AS other_user,
        u.name AS other_user_name,
        u.photo_url AS other_user_photo,
        m.message_text AS last_message,
        m.created_at AS last_message_time,
        COUNT(CASE WHEN m.receiver_id = $1 AND m.is_read = false THEN 1 END)
          OVER (PARTITION BY
            CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
          ) AS unread_count
       FROM messages m
       JOIN users u ON u.user_id = CASE
         WHEN m.sender_id = $1 THEN m.receiver_id
         ELSE m.sender_id
       END
       WHERE m.sender_id = $1 OR m.receiver_id = $1
       ORDER BY other_user, m.created_at DESC`,
      [user_id]
    );

    return res.status(200).json({
      success: true,
      chats: result.rows
    });

  } catch (err) {
    console.error('getChatList error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { sendMessage, getMessages, getChatList };