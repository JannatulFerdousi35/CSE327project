const pool = require('../db/pg');

async function listIssues(req, res) {
  const result = await pool.query(`
    SELECT
      id,
      user_id,
      title,
      description,
      category,
      division,
      district,
      upazila,
      union_name,
      village,
      image_url,
      priority,
      status,
      estimated_budget,
      estimated_volunteers,
      created_at
    FROM issues
    ORDER BY created_at DESC
  `);

  res.json({ success: true, issues: result.rows });
}

async function getIssue(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid issue ID.' });
  }

  const result = await pool.query('SELECT * FROM issues WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Issue not found.' });
  }

  res.json({ success: true, issue: result.rows[0] });
}

async function myReports(req, res) {
  const userId = req.user?.id;
  if (!Number.isInteger(userId)) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const result = await pool.query(
    `SELECT id, user_id, title, description, category, division, district, upazila, union_name, village, image_url, priority, status, created_at
     FROM issues
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  res.json({ success: true, issues: result.rows });
}

async function stats(req, res) {
  const result = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE LOWER(status) IN ('reported','new','active','pending','approved','in progress'))::int AS active,
      COUNT(*) FILTER (WHERE LOWER(status) IN ('completed','resolved'))::int AS resolved,
      COUNT(*) FILTER (WHERE LOWER(status) = 'cancelled')::int AS cancelled
    FROM issues
  `);

  const row = result.rows[0] || { total: 0, active: 0, resolved: 0, cancelled: 0 };
  res.json({ success: true, stats: { total: row.total, active: row.active, resolved: row.resolved, cancelled: row.cancelled } });
}

module.exports = {
  listIssues,
  getIssue,
  myReports,
  stats,
};
