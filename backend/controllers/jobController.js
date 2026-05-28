const pool = require('../config/db');
require('dotenv').config();

// =============================================
// SEND JOB REQUEST
// Customer/Thekedar worker ko request bhejta hai
// =============================================
const sendJobRequest = async (req, res) => {
  try {
    const hired_by_id = req.user.user_id;
    const {
      worker_id,
      work_description,
      work_location,
      work_type,
      start_date
    } = req.body;

    if (!worker_id || !work_description || !work_type) {
      return res.status(400).json({
        success: false,
        message: 'worker_id, work_description and work_type are required'
      });
    }

    const result = await pool.query(
      `INSERT INTO job_requests
        (hired_by_id, worker_id, work_description, work_location, work_type, start_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [hired_by_id, worker_id, work_description, work_location, work_type, start_date]
    );

    return res.status(201).json({
      success: true,
      message: 'Job request sent successfully!',
      request: result.rows[0]
    });

  } catch (err) {
    console.error('sendJobRequest error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// ACCEPT JOB REQUEST
// Worker request accept karta hai
// =============================================
const acceptRequest = async (req, res) => {
  try {
    const worker_id = req.user.user_id;
    const { request_id } = req.params;

    // Check request exists and belongs to this worker
    const requestResult = await pool.query(
      `SELECT * FROM job_requests WHERE request_id = $1 AND worker_id = $2`,
      [request_id, worker_id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Update request status
    await pool.query(
      `UPDATE job_requests SET status = 'accepted' WHERE request_id = $1`,
      [request_id]
    );

    // Create active job
    const jobResult = await pool.query(
      `INSERT INTO active_jobs (request_id, worker_id, hired_by_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [request_id, worker_id, requestResult.rows[0].hired_by_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Job request accepted!',
      job: jobResult.rows[0]
    });

  } catch (err) {
    console.error('acceptRequest error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// REJECT JOB REQUEST
// Worker request reject karta hai
// =============================================
const rejectRequest = async (req, res) => {
  try {
    const worker_id = req.user.user_id;
    const { request_id } = req.params;

    await pool.query(
      `UPDATE job_requests SET status = 'rejected'
       WHERE request_id = $1 AND worker_id = $2`,
      [request_id, worker_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Job request rejected'
    });

  } catch (err) {
    console.error('rejectRequest error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// UPDATE JOB STATUS
// Worker status update karta hai:
// accepted → traveling → working → completed
// =============================================
const updateJobStatus = async (req, res) => {
  try {
    const worker_id = req.user.user_id;
    const { job_id } = req.params;
    const { job_status, latitude, longitude } = req.body;

    const validStatuses = ['traveling', 'working', 'completed'];
    if (!validStatuses.includes(job_status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Location sharing — ON during traveling/working, OFF when completed
    const location_sharing = job_status !== 'completed';

    const updateData = {
      job_status,
      location_sharing,
      worker_latitude: latitude,
      worker_longitude: longitude,
      last_location_update: new Date()
    };

    // If work started
    if (job_status === 'working') {
      updateData.started_at = new Date();
    }

    // If completed
    if (job_status === 'completed') {
      updateData.completed_at = new Date();
      updateData.worker_latitude = null;
      updateData.worker_longitude = null;
    }

    await pool.query(
      `UPDATE active_jobs SET
        job_status = $1,
        location_sharing = $2,
        worker_latitude = $3,
        worker_longitude = $4,
        last_location_update = $5,
        started_at = COALESCE(started_at, $6),
        completed_at = $7
       WHERE job_id = $8 AND worker_id = $9`,
      [
        updateData.job_status,
        updateData.location_sharing,
        updateData.worker_latitude,
        updateData.worker_longitude,
        updateData.last_location_update,
        job_status === 'working' ? new Date() : null,
        job_status === 'completed' ? new Date() : null,
        job_id,
        worker_id
      ]
    );

    return res.status(200).json({
      success: true,
      message: `Status updated to: ${job_status}`,
      location_sharing
    });

  } catch (err) {
    console.error('updateJobStatus error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// GET MY JOBS
// Apni saari jobs dekho
// =============================================
const getMyJobs = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const role = req.user.role;

    let result;

    if (role === 'worker') {
      // Worker — apni saari jobs
      result = await pool.query(`
        SELECT
          jr.request_id, jr.work_description, jr.work_type,
          jr.work_location, jr.start_date, jr.status,
          aj.job_id, aj.job_status, aj.started_at, aj.completed_at,
          u.name AS hired_by_name, u.role AS hired_by_role
        FROM job_requests jr
        LEFT JOIN active_jobs aj ON jr.request_id = aj.request_id
        JOIN users u ON jr.hired_by_id = u.user_id
        WHERE jr.worker_id = $1
        ORDER BY jr.created_at DESC
      `, [user_id]);
    } else {
      // Customer/Thekedar — unhone jo jobs di hain
      result = await pool.query(`
        SELECT
          jr.request_id, jr.work_description, jr.work_type,
          jr.work_location, jr.start_date, jr.status,
          aj.job_id, aj.job_status, aj.started_at, aj.completed_at,
          aj.location_sharing, aj.worker_latitude, aj.worker_longitude,
          u.name AS worker_name, u.photo_url AS worker_photo,
          wp.category, wp.avg_rating
        FROM job_requests jr
        LEFT JOIN active_jobs aj ON jr.request_id = aj.request_id
        JOIN users u ON jr.worker_id = u.user_id
        JOIN worker_profiles wp ON jr.worker_id = wp.worker_id
        WHERE jr.hired_by_id = $1
        ORDER BY jr.created_at DESC
      `, [user_id]);
    }

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      jobs: result.rows
    });

  } catch (err) {
    console.error('getMyJobs error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// ADD REVIEW
// Job complete hone ke baad rating do
// =============================================
const addReview = async (req, res) => {
  try {
    const reviewed_by_id = req.user.user_id;
    const reviewer_type = req.user.role;
    const { worker_id, job_id, rating, review_text } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Save review
    await pool.query(
      `INSERT INTO reviews
        (worker_id, reviewed_by_id, reviewer_type, job_id, rating, review_text)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [worker_id, reviewed_by_id, reviewer_type, job_id, rating, review_text]
    );

    // Update worker average rating
    await pool.query(
      `UPDATE worker_profiles SET
        avg_rating = (
          SELECT ROUND(AVG(rating)::numeric, 2)
          FROM reviews WHERE worker_id = $1
        ),
        total_reviews = (
          SELECT COUNT(*) FROM reviews WHERE worker_id = $1
        )
       WHERE worker_id = $1`,
      [worker_id]
    );

    return res.status(201).json({
      success: true,
      message: 'Review added successfully!'
    });

  } catch (err) {
    console.error('addReview error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  sendJobRequest,
  acceptRequest,
  rejectRequest,
  updateJobStatus,
  getMyJobs,
  addReview
};