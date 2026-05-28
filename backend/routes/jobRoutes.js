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


router.post('/request', authMiddleware, sendJobRequest);


router.put('/:request_id/accept', authMiddleware, acceptRequest);


router.put('/:request_id/reject', authMiddleware, rejectRequest);


router.put('/:job_id/status', authMiddleware, updateJobStatus);


router.get('/my-jobs', authMiddleware, getMyJobs);


router.post('/review', authMiddleware, addReview);

module.exports = router;