const pool = require('../db/pg');

async function createIssue(req, res) {
  const userId = req.user?.id;
  if (!Number.isInteger(userId)) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const { title, description, category, division, district, upazila, union_name, village, image_url, priority, estimated_budget, estimated_volunteers } = req.body || {};

  if (!title || !description) {
    return res.status(400).json({ success: false, message: 'Title and description are required.' });
  }

  const result = await pool.query(
    `INSERT INTO issues (user_id, title, description, category, division, district, upazila, union_name, village, image_url, priority, estimated_budget, estimated_volunteers, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'reported',now()) RETURNING id, user_id, title, description, category, division, district, upazila, union_name, village, image_url, priority, estimated_budget, estimated_volunteers, status, created_at`,
    [userId, title, description, category || null, division || null, district || null, upazila || null, union_name || null, village || null, image_url || null, priority || null, estimated_budget || null, estimated_volunteers || null]
  );

  res.status(201).json({ success: true, issue: result.rows[0] });
}

module.exports = { createIssue };
