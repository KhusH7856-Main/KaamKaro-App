const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP, selectRole, getProfile } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/select-role', authMiddleware, selectRole);
router.get('/profile', authMiddleware, getProfile);

module.exports = router;