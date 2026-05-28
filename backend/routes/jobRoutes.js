const express = require('express');
const router = express.Router();
const {
  sendJobRequest,
  acceptRequest,
  rejectRequest,
  updateJobStatus,
  getMyJobs,
  addReview
} = require('../controllers/jobController');
const authMiddleware = require('../middleware/auth');

// POST /api/jobs/request — customer request bhejta hai
router.post('/request', authMiddleware, sendJobRequest);

// PUT /api/jobs/:request_id/accept — worker accept karta hai
router.put('/:request_id/accept', authMiddleware, acceptRequest);

// PUT /api/jobs/:request_id/reject — worker reject karta hai
router.put('/:request_id/reject', authMiddleware, rejectRequest);

// PUT /api/jobs/:job_id/status — worker status update karta hai
router.put('/:job_id/status', authMiddleware, updateJobStatus);

// GET /api/jobs/my-jobs — apni saari jobs dekho
router.get('/my-jobs', authMiddleware, getMyJobs);

// POST /api/jobs/review — review do
router.post('/review', authMiddleware, addReview);

module.exports = router;