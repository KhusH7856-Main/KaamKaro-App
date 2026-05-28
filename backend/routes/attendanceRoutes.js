const express = require('express');
const router = express.Router();
const {
  markAttendance,
  getAttendance,
  getTeamSummary
} = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/auth');

// POST /api/attendance/mark
router.post('/mark', authMiddleware, markAttendance);

// GET /api/attendance/team/:month — pehle ye aana chahiye!
router.get('/team/:month', authMiddleware, getTeamSummary);

// GET /api/attendance/:worker_id/:month — baad mein ye
router.get('/:worker_id/:month', authMiddleware, getAttendance);

module.exports = router;