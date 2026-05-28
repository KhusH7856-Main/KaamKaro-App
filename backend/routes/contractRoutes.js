const express = require('express');
const router = express.Router();
const {
  createContract,
  getContract,
  addPayment,
  confirmPayment,
  getMyContracts
} = require('../controllers/contractController');
const authMiddleware = require('../middleware/auth');

// POST /api/contracts/create
router.post('/create', authMiddleware, createContract);

// GET /api/contracts/my-contracts
router.get('/my-contracts', authMiddleware, getMyContracts);

// GET /api/contracts/:contract_id
router.get('/:contract_id', authMiddleware, getContract);

// POST /api/contracts/:contract_id/payment
router.post('/:contract_id/payment', authMiddleware, addPayment);

// PUT /api/contracts/payment/:payment_id/confirm
router.put('/payment/:payment_id/confirm', authMiddleware, confirmPayment);

module.exports = router;