const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const sendOTP = async (req, res) => {
  try {
    const { phone_number } = req.body;

    if (!phone_number || phone_number.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid phone number'
      });
    }

    const otp_code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO otp_verifications (phone_number, otp_code, expires_at)
       VALUES ($1, $2, $3)`,
      [phone_number, otp_code, expires_at]
    );

    console.log(`📱 OTP for ${phone_number}: ${otp_code}`);

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      otp: process.env.NODE_ENV === 'development' ? otp_code : undefined
    });

  } catch (err) {
    console.error('sendOTP error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.'
    });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { phone_number, otp_code } = req.body;

    if (!phone_number || !otp_code) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required'
      });
    }

    const otpResult = await pool.query(
      `SELECT * FROM otp_verifications
       WHERE phone_number = $1
       AND otp_code = $2
       AND is_used = false
       AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone_number, otp_code]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    await pool.query(
      `UPDATE otp_verifications SET is_used = true WHERE otp_id = $1`,
      [otpResult.rows[0].otp_id]
    );

    let userResult = await pool.query(
      `SELECT * FROM users WHERE phone_number = $1`,
      [phone_number]
    );

    let user;
    let isNewUser = false;

    if (userResult.rows.length === 0) {
      const newUserResult = await pool.query(
        `INSERT INTO users (phone_number, is_verified)
         VALUES ($1, true)
         RETURNING *`,
        [phone_number]
      );
      user = newUserResult.rows[0];
      isNewUser = true;
    } else {
      user = userResult.rows[0];
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        phone_number: user.phone_number,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      message: isNewUser ? 'Account created successfully!' : 'Login successful!',
      isNewUser,
      token,
      user: {
        user_id: user.user_id,
        phone_number: user.phone_number,
        name: user.name,
        role: user.role,
        photo_url: user.photo_url
      }
    });

  } catch (err) {
    console.error('verifyOTP error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Verification failed. Please try again.'
    });
  }
};

const selectRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user_id = req.user.user_id;

    const validRoles = ['customer', 'worker', 'thekedar'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Choose: customer, worker, or thekedar'
      });
    }

    await pool.query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE user_id = $2`,
      [role, user_id]
    );

    if (role === 'worker') {
      await pool.query(
        `INSERT INTO worker_profiles (worker_id)
         VALUES ($1)
         ON CONFLICT (worker_id) DO NOTHING`,
        [user_id]
      );
    }

    return res.status(200).json({
      success: true,
      message: `Role set as ${role}`,
      role
    });

  } catch (err) {
    console.error('selectRole error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to set role. Please try again.'
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const result = await pool.query(
      `SELECT user_id, phone_number, name, photo_url, role, language, created_at
       FROM users WHERE user_id = $1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      user: result.rows[0]
    });

  } catch (err) {
    console.error('getProfile error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { sendOTP, verifyOTP, selectRole, getProfile };