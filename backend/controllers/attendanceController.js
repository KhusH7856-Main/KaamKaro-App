const pool = require('../config/db');
require('dotenv').config();

// =============================================
// MARK ATTENDANCE
// Thekedar daily attendance mark karta hai
// =============================================
const markAttendance = async (req, res) => {
  try {
    const thekedar_id = req.user.user_id;
    const { worker_id, date, status, daily_rate } = req.body;

    if (!worker_id || !date || !status) {
      return res.status(400).json({
        success: false,
        message: 'worker_id, date and status are required'
      });
    }

    // Insert or update attendance
    // UPSERT — agar pehle se hai to update, nahi to insert
    await pool.query(
      `INSERT INTO attendance (worker_id, thekedar_id, date, status, daily_rate)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (worker_id, thekedar_id, date)
       DO UPDATE SET status = $4, daily_rate = $5`,
      [worker_id, thekedar_id, date, status, daily_rate]
    );

    return res.status(200).json({
      success: true,
      message: `Attendance marked: ${status} for ${date}`
    });

  } catch (err) {
    console.error('markAttendance error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// GET ATTENDANCE
// Kisi worker ki monthly attendance dekho
// =============================================
const getAttendance = async (req, res) => {
  try {
    const thekedar_id = req.user.user_id;
    const { worker_id, month } = req.params;
    // month format = "2025-05"

    const result = await pool.query(
      `SELECT
        a.attendance_id,
        a.date,
        a.status,
        a.daily_rate,
        u.name AS worker_name
       FROM attendance a
       JOIN users u ON a.worker_id = u.user_id
       WHERE a.worker_id = $1
         AND a.thekedar_id = $2
         AND TO_CHAR(a.date, 'YYYY-MM') = $3
       ORDER BY a.date ASC`,
      [worker_id, thekedar_id, month]
    );

    // Calculate summary
    const present = result.rows.filter(r => r.status === 'present').length;
    const absent = result.rows.filter(r => r.status === 'absent').length;
    const half_day = result.rows.filter(r => r.status === 'half_day').length;
    const total_days = present + (half_day * 0.5);
    const daily_rate = result.rows[0]?.daily_rate || 0;
    const total_salary = total_days * daily_rate;

    return res.status(200).json({
      success: true,
      attendance: result.rows,
      summary: {
        present,
        absent,
        half_day,
        total_days_counted: total_days,
        daily_rate,
        total_salary
      }
    });

  } catch (err) {
    console.error('getAttendance error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// GET MY TEAM ATTENDANCE SUMMARY
// Thekedar ke saare workers ki summary
// =============================================
const getTeamSummary = async (req, res) => {
  try {
    const thekedar_id = req.user.user_id;
    const { month } = req.params;

    const result = await pool.query(
      `SELECT
        u.user_id AS worker_id,
        u.name AS worker_name,
        u.photo_url,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) AS present_days,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) AS absent_days,
        COUNT(CASE WHEN a.status = 'half_day' THEN 1 END) AS half_days,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) +
        COUNT(CASE WHEN a.status = 'half_day' THEN 1 END) * 0.5 AS total_days,
        MAX(a.daily_rate) AS daily_rate,
        (COUNT(CASE WHEN a.status = 'present' THEN 1 END) +
        COUNT(CASE WHEN a.status = 'half_day' THEN 1 END) * 0.5) *
        MAX(a.daily_rate) AS total_salary
       FROM attendance a
       JOIN users u ON a.worker_id = u.user_id
       WHERE a.thekedar_id = $1
         AND TO_CHAR(a.date, 'YYYY-MM') = $2
       GROUP BY u.user_id, u.name, u.photo_url
       ORDER BY u.name ASC`,
      [thekedar_id, month]
    );

    return res.status(200).json({
      success: true,
      month,
      team: result.rows
    });

  } catch (err) {
    console.error('getTeamSummary error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { markAttendance, getAttendance, getTeamSummary };