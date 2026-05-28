const pool = require('../config/db');
require('dotenv').config();

// =============================================
// MARK SALARY AS PAID
// Thekedar salary paid mark karta hai
// Worker ko notification jaati hai confirm karne
// =============================================
const markSalaryPaid = async (req, res) => {
  try {
    const thekedar_id = req.user.user_id;
    const {
      worker_id,
      month,
      total_days_present,
      daily_rate,
      total_amount,
      payment_mode
    } = req.body;

    if (!worker_id || !month || !total_amount || !payment_mode) {
      return res.status(400).json({
        success: false,
        message: 'worker_id, month, total_amount and payment_mode are required'
      });
    }

    const result = await pool.query(
      `INSERT INTO daily_salary_payments
        (worker_id, thekedar_id, month, total_days_present,
         daily_rate, total_amount, payment_mode, thekedar_confirmed, thekedar_confirmed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
       RETURNING *`,
      [worker_id, thekedar_id, month, total_days_present,
       daily_rate, total_amount, payment_mode]
    );

    return res.status(201).json({
      success: true,
      message: 'Salary marked as paid! Waiting for worker confirmation.',
      payment: result.rows[0]
    });

  } catch (err) {
    console.error('markSalaryPaid error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// WORKER CONFIRMS SALARY RECEIVED
// Worker confirm karta hai salary mili ya nahi
// =============================================
const confirmSalary = async (req, res) => {
  try {
    const worker_id = req.user.user_id;
    const { payment_id, confirmed } = req.body;

    if (confirmed) {
      // Worker ne confirm kiya — salary received!
      await pool.query(
        `UPDATE daily_salary_payments SET
          worker_confirmed = true,
          worker_confirmed_at = NOW(),
          status = 'confirmed'
         WHERE payment_id = $1 AND worker_id = $2`,
        [payment_id, worker_id]
      );

      return res.status(200).json({
        success: true,
        message: 'Salary confirmed received! ✅'
      });

    } else {
      // Worker ne deny kiya — dispute raise karo
      await pool.query(
        `UPDATE daily_salary_payments SET
          status = 'disputed'
         WHERE payment_id = $1 AND worker_id = $2`,
        [payment_id, worker_id]
      );

      // Dispute record banao
      await pool.query(
        `INSERT INTO disputes
          (payment_id, payment_type, raised_by_id, reason)
         VALUES ($1, 'daily', $2, 'Worker denied receiving salary')`,
        [payment_id, worker_id]
      );

      return res.status(200).json({
        success: true,
        message: 'Dispute raised! ⚠️ Admin will review.'
      });
    }

  } catch (err) {
    console.error('confirmSalary error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// GET SALARY HISTORY
// Worker ya thekedar ki payment history
// =============================================
const getSalaryHistory = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const role = req.user.role;

    let result;

    if (role === 'worker') {
      result = await pool.query(
        `SELECT
          dsp.*,
          u.name AS thekedar_name
         FROM daily_salary_payments dsp
         JOIN users u ON dsp.thekedar_id = u.user_id
         WHERE dsp.worker_id = $1
         ORDER BY dsp.created_at DESC`,
        [user_id]
      );
    } else {
      result = await pool.query(
        `SELECT
          dsp.*,
          u.name AS worker_name
         FROM daily_salary_payments dsp
         JOIN users u ON dsp.worker_id = u.user_id
         WHERE dsp.thekedar_id = $1
         ORDER BY dsp.created_at DESC`,
        [user_id]
      );
    }

    return res.status(200).json({
      success: true,
      payments: result.rows
    });

  } catch (err) {
    console.error('getSalaryHistory error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// GET PENDING CONFIRMATIONS
// Worker ke pending salary confirmations
// =============================================
const getPendingConfirmations = async (req, res) => {
  try {
    const worker_id = req.user.user_id;

    const result = await pool.query(
      `SELECT
        dsp.*,
        u.name AS thekedar_name
       FROM daily_salary_payments dsp
       JOIN users u ON dsp.thekedar_id = u.user_id
       WHERE dsp.worker_id = $1
         AND dsp.worker_confirmed = false
         AND dsp.status = 'pending'
       ORDER BY dsp.created_at DESC`,
      [worker_id]
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      pending_payments: result.rows
    });

  } catch (err) {
    console.error('getPendingConfirmations error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  markSalaryPaid,
  confirmSalary,
  getSalaryHistory,
  getPendingConfirmations
};