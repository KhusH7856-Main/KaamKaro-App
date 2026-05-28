const pool = require('../config/db');
require('dotenv').config();

// =============================================
// CREATE CONTRACT
// Thekedar contract worker ke saath contract banata hai
// =============================================
const createContract = async (req, res) => {
  try {
    const thekedar_id = req.user.user_id;
    const {
      worker_id,
      project_name,
      total_amount,
      start_date,
      expected_end_date
    } = req.body;

    if (!worker_id || !project_name || !total_amount) {
      return res.status(400).json({
        success: false,
        message: 'worker_id, project_name and total_amount are required'
      });
    }

    const result = await pool.query(
      `INSERT INTO contracts
        (worker_id, thekedar_id, project_name, total_amount,
         remaining_amount, start_date, expected_end_date)
       VALUES ($1, $2, $3, $4, $4, $5, $6)
       RETURNING *`,
      [worker_id, thekedar_id, project_name, total_amount,
       start_date, expected_end_date]
    );

    return res.status(201).json({
      success: true,
      message: 'Contract created successfully!',
      contract: result.rows[0]
    });

  } catch (err) {
    console.error('createContract error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// GET CONTRACT DETAILS
// Contract ki full detail + payment history
// =============================================
const getContract = async (req, res) => {
  try {
    const { contract_id } = req.params;

    // Contract details
    const contractResult = await pool.query(
      `SELECT
        c.*,
        u1.name AS worker_name,
        u2.name AS thekedar_name
       FROM contracts c
       JOIN users u1 ON c.worker_id = u1.user_id
       JOIN users u2 ON c.thekedar_id = u2.user_id
       WHERE c.contract_id = $1`,
      [contract_id]
    );

    if (contractResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Payment history
    const paymentsResult = await pool.query(
      `SELECT * FROM contract_payments
       WHERE contract_id = $1
       ORDER BY created_at DESC`,
      [contract_id]
    );

    const contract = contractResult.rows[0];
    const payments = paymentsResult.rows;

    // Calculate totals
    const confirmed_paid = payments
      .filter(p => p.status === 'confirmed')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const pending_amount = payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const remaining = parseFloat(contract.total_amount) - confirmed_paid;
    const progress_percent = Math.round((confirmed_paid / parseFloat(contract.total_amount)) * 100);

    return res.status(200).json({
      success: true,
      contract,
      payments,
      summary: {
        total_amount: contract.total_amount,
        confirmed_paid,
        pending_amount,
        remaining,
        progress_percent
      }
    });

  } catch (err) {
    console.error('getContract error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// ADD PAYMENT TO CONTRACT
// Thekedar partial payment add karta hai
// =============================================
const addPayment = async (req, res) => {
  try {
    const thekedar_id = req.user.user_id;
    const { contract_id } = req.params;
    const { amount, payment_mode, payment_date } = req.body;

    if (!amount || !payment_mode) {
      return res.status(400).json({
        success: false,
        message: 'amount and payment_mode are required'
      });
    }

    // Check contract belongs to this thekedar
    const contractResult = await pool.query(
      `SELECT * FROM contracts WHERE contract_id = $1 AND thekedar_id = $2`,
      [contract_id, thekedar_id]
    );

    if (contractResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Add payment
    const result = await pool.query(
      `INSERT INTO contract_payments
        (contract_id, amount, payment_mode, payment_date,
         thekedar_confirmed, thekedar_confirmed_at)
       VALUES ($1, $2, $3, $4, true, NOW())
       RETURNING *`,
      [contract_id, amount, payment_mode, payment_date || new Date()]
    );

    // Update contract paid_amount
    await pool.query(
      `UPDATE contracts SET
        paid_amount = (
          SELECT COALESCE(SUM(amount), 0)
          FROM contract_payments
          WHERE contract_id = $1 AND status = 'confirmed'
        ),
        remaining_amount = total_amount - (
          SELECT COALESCE(SUM(amount), 0)
          FROM contract_payments
          WHERE contract_id = $1 AND status = 'confirmed'
        )
       WHERE contract_id = $1`,
      [contract_id]
    );

    return res.status(201).json({
      success: true,
      message: 'Payment added! Waiting for worker confirmation.',
      payment: result.rows[0]
    });

  } catch (err) {
    console.error('addPayment error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// WORKER CONFIRMS PAYMENT
// Worker payment confirm ya deny karta hai
// =============================================
const confirmPayment = async (req, res) => {
  try {
    const worker_id = req.user.user_id;
    const { payment_id } = req.params;
    const { confirmed } = req.body;

    // Get payment details
    const paymentResult = await pool.query(
      `SELECT cp.*, c.worker_id FROM contract_payments cp
       JOIN contracts c ON cp.contract_id = c.contract_id
       WHERE cp.payment_id = $1`,
      [payment_id]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (paymentResult.rows[0].worker_id !== worker_id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const contract_id = paymentResult.rows[0].contract_id;

    if (confirmed) {
      // Confirm payment
      await pool.query(
        `UPDATE contract_payments SET
          worker_confirmed = true,
          worker_confirmed_at = NOW(),
          status = 'confirmed'
         WHERE payment_id = $1`,
        [payment_id]
      );

      // Update contract paid and remaining amount
      await pool.query(
        `UPDATE contracts SET
          paid_amount = (
            SELECT COALESCE(SUM(amount), 0)
            FROM contract_payments
            WHERE contract_id = $1 AND status = 'confirmed'
          ),
          remaining_amount = total_amount - (
            SELECT COALESCE(SUM(amount), 0)
            FROM contract_payments
            WHERE contract_id = $1 AND status = 'confirmed'
          )
         WHERE contract_id = $1`,
        [contract_id]
      );

      return res.status(200).json({
        success: true,
        message: 'Payment confirmed received! ✅'
      });

    } else {
      // Dispute raise karo
      await pool.query(
        `UPDATE contract_payments SET status = 'disputed' WHERE payment_id = $1`,
        [payment_id]
      );

      await pool.query(
        `INSERT INTO disputes (payment_id, payment_type, raised_by_id, reason)
         VALUES ($1, 'contract', $2, 'Worker denied receiving payment')`,
        [payment_id, worker_id]
      );

      return res.status(200).json({
        success: true,
        message: 'Dispute raised! ⚠️ Admin will review.'
      });
    }

  } catch (err) {
    console.error('confirmPayment error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// GET MY CONTRACTS
// Apne saare contracts dekho
// =============================================
const getMyContracts = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const role = req.user.role;

    let result;

    if (role === 'worker') {
      result = await pool.query(
        `SELECT c.*, u.name AS thekedar_name
         FROM contracts c
         JOIN users u ON c.thekedar_id = u.user_id
         WHERE c.worker_id = $1
         ORDER BY c.created_at DESC`,
        [user_id]
      );
    } else {
      result = await pool.query(
        `SELECT c.*, u.name AS worker_name
         FROM contracts c
         JOIN users u ON c.worker_id = u.user_id
         WHERE c.thekedar_id = $1
         ORDER BY c.created_at DESC`,
        [user_id]
      );
    }

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      contracts: result.rows
    });

  } catch (err) {
    console.error('getMyContracts error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createContract,
  getContract,
  addPayment,
  confirmPayment,
  getMyContracts
};