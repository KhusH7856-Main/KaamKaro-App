const express = require('express');
const router = express.Router();
const {
  setupProfile,
  searchWorkers,
  getWorkerProfile,
  updateAvailability
} = require('../controllers/workerController');
const authMiddleware = require('../middleware/auth');

// GET /api/workers/search?category=plumber&latitude=19.0&longitude=72.8
router.get('/search', authMiddleware, searchWorkers);

// GET /api/workers/:worker_id/profile
router.get('/:worker_id/profile', authMiddleware, getWorkerProfile);

// PUT /api/workers/setup-profile (worker only)
router.put('/setup-profile', authMiddleware, setupProfile);

// PUT /api/workers/availability
router.put('/availability', authMiddleware, updateAvailability);

module.exports = router;