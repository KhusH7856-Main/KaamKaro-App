const pool = require('../config/db');
require('dotenv').config();

// =============================================
// WORKER PROFILE SETUP
// Worker apna profile complete karta hai
// =============================================
const setupProfile = async (req, res) => {
  try {
    const worker_id = req.user.user_id;
    const {
      category,
      worker_type,
      daily_rate,
      experience_years,
      skills,
      latitude,
      longitude
    } = req.body;

    await pool.query(
      `UPDATE worker_profiles SET
        category = $1,
        worker_type = $2,
        daily_rate = $3,
        experience_years = $4,
        skills = $5,
        latitude = $6,
        longitude = $7,
        updated_at = NOW()
       WHERE worker_id = $8`,
      [category, worker_type, daily_rate, experience_years, skills, latitude, longitude, worker_id]
    );

    await pool.query(
      `UPDATE users SET name = $1, updated_at = NOW() WHERE user_id = $2`,
      [req.body.name, worker_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully!'
    });

  } catch (err) {
    console.error('setupProfile error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// SEARCH WORKERS
// Location + Category se workers dhundho
// =============================================
const searchWorkers = async (req, res) => {
  try {
    const { category, latitude, longitude, radius = 10 } = req.query;
    // radius = km mein, default 10km

    let query = `
      SELECT
        u.user_id,
        u.name,
        u.photo_url,
        wp.category,
        wp.worker_type,
        wp.daily_rate,
        wp.experience_years,
        wp.skills,
        wp.avg_rating,
        wp.total_reviews,
        wp.is_available,
        wp.latitude,
        wp.longitude,
        -- Distance calculate karo in km
        ROUND(
          CAST(
            6371 * acos(
              cos(radians($1)) * cos(radians(wp.latitude)) *
              cos(radians(wp.longitude) - radians($2)) +
              sin(radians($1)) * sin(radians(wp.latitude))
            ) AS numeric
          ), 2
        ) AS distance_km
      FROM users u
      JOIN worker_profiles wp ON u.user_id = wp.worker_id
      WHERE u.role = 'worker'
        AND wp.is_available = true
        AND wp.latitude IS NOT NULL
        AND wp.longitude IS NOT NULL
    `;

    const params = [latitude, longitude];

    // Category filter
    if (category) {
      params.push(category);
      query += ` AND wp.category = $${params.length}`;
    }

    // Radius filter
    query += `
      HAVING 6371 * acos(
        cos(radians($1)) * cos(radians(wp.latitude)) *
        cos(radians(wp.longitude) - radians($2)) +
        sin(radians($1)) * sin(radians(wp.latitude))
      ) <= ${radius}
      ORDER BY distance_km ASC
    `;

    // GROUP BY required for HAVING
    query = query.replace(
      'WHERE u.role',
      'GROUP BY u.user_id, u.name, u.photo_url, wp.category, wp.worker_type, wp.daily_rate, wp.experience_years, wp.skills, wp.avg_rating, wp.total_reviews, wp.is_available, wp.latitude, wp.longitude\nHAVING 6371 * acos(\n        cos(radians($1)) * cos(radians(wp.latitude)) *\n        cos(radians(wp.longitude) - radians($2)) +\n        sin(radians($1)) * sin(radians(wp.latitude))\n      ) <= ' + radius + '\n ORDER BY distance_km ASC -- \nWHERE u.role'
    );

    const result = await pool.query(`
      SELECT
        u.user_id,
        u.name,
        u.photo_url,
        wp.category,
        wp.worker_type,
        wp.daily_rate,
        wp.experience_years,
        wp.skills,
        wp.avg_rating,
        wp.total_reviews,
        wp.is_available,
        wp.latitude,
        wp.longitude,
        ROUND(CAST(6371 * acos(
          GREATEST(-1, LEAST(1,
            cos(radians($1)) * cos(radians(wp.latitude)) *
            cos(radians(wp.longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(wp.latitude))
          ))
        ) AS numeric), 2) AS distance_km
      FROM users u
      JOIN worker_profiles wp ON u.user_id = wp.worker_id
      WHERE u.role = 'worker'
        AND wp.is_available = true
        AND wp.latitude IS NOT NULL
        AND wp.longitude IS NOT NULL
        ${category ? `AND wp.category = $3` : ''}
      ORDER BY distance_km ASC
      LIMIT 50
    `, params);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      workers: result.rows
    });

  } catch (err) {
    console.error('searchWorkers error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// GET WORKER PROFILE
// Kisi bhi worker ki profile dekho
// =============================================
const getWorkerProfile = async (req, res) => {
  try {
    const { worker_id } = req.params;

    // Worker basic info
    const workerResult = await pool.query(`
      SELECT
        u.user_id, u.name, u.photo_url, u.created_at,
        wp.category, wp.worker_type, wp.daily_rate,
        wp.experience_years, wp.skills, wp.avg_rating,
        wp.total_reviews, wp.is_available, wp.is_id_verified
      FROM users u
      JOIN worker_profiles wp ON u.user_id = wp.worker_id
      WHERE u.user_id = $1
    `, [worker_id]);

    if (workerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Working history
    const historyResult = await pool.query(`
      SELECT
        jr.request_id,
        jr.work_description,
        jr.work_type,
        jr.start_date,
        aj.completed_at,
        aj.job_status,
        u.name AS hired_by_name,
        u.role AS hired_by_role,
        r.rating,
        r.review_text
      FROM job_requests jr
      JOIN active_jobs aj ON jr.request_id = aj.request_id
      JOIN users u ON jr.hired_by_id = u.user_id
      LEFT JOIN reviews r ON aj.job_id = r.job_id
      WHERE jr.worker_id = $1
        AND aj.job_status = 'completed'
      ORDER BY aj.completed_at DESC
      LIMIT 20
    `, [worker_id]);

    // Reviews
    const reviewsResult = await pool.query(`
      SELECT
        r.rating, r.review_text, r.created_at,
        u.name AS reviewer_name,
        u.role AS reviewer_role
      FROM reviews r
      JOIN users u ON r.reviewed_by_id = u.user_id
      WHERE r.worker_id = $1
      ORDER BY r.created_at DESC
      LIMIT 10
    `, [worker_id]);

    return res.status(200).json({
      success: true,
      worker: workerResult.rows[0],
      working_history: historyResult.rows,
      reviews: reviewsResult.rows
    });

  } catch (err) {
    console.error('getWorkerProfile error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// UPDATE AVAILABILITY
// Worker available/unavailable toggle kare
// =============================================
const updateAvailability = async (req, res) => {
  try {
    const worker_id = req.user.user_id;
    const { is_available } = req.body;

    await pool.query(
      `UPDATE worker_profiles SET is_available = $1 WHERE worker_id = $2`,
      [is_available, worker_id]
    );

    return res.status(200).json({
      success: true,
      message: `You are now ${is_available ? 'Available' : 'Unavailable'}`
    });

  } catch (err) {
    console.error('updateAvailability error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { setupProfile, searchWorkers, getWorkerProfile, updateAvailability };