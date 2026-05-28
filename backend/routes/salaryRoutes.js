const express = require('express');
const router = express.Router();
const {
  markSalaryPaid,
  confirmSalary,
  getSalaryHistory,
  getPendingConfirmations
} = require('../controllers/salaryController');
const authMiddleware = require('../middleware/auth');

// POST /api/salary/mark-paid — thekedar salary mark karta hai
router.post('/mark-paid', authMiddleware, markSalaryPaid);

// PUT /api/salary/confirm — worker confirm karta hai
router.put('/confirm', authMiddleware, confirmSalary);

// GET /api/salary/history — payment history
router.get('/history', authMiddleware, getSalaryHistory);

// GET /api/salary/pending — worker ke pending confirmations
router.get('/pending', authMiddleware, getPendingConfirmations);

module.exports = router;