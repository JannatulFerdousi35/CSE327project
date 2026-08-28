const pool = require('../db/pg');

const VALID_STATUSES = new Set(['reported','new','active','pending','approved','in progress','completed','resolved','cancelled']);

function isNonEmptyString(v, maxLen = 10000) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= maxLen;
}

function isIntegerLike(v) {
  return Number.isInteger(v) || (typeof v === 'string' && /^\d+$/.test(v));
}

async function updateIssue(req, res) {
  const userId = req.user?.id;
  if (!Number.isInteger(userId)) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid issue id.' });
  }

  const body = req.body || {};

  // Allowed update fields and validations
  const updates = {};

  if (body.title !== undefined) {
    if (!isNonEmptyString(body.title, 200)) return res.status(400).json({ success: false, message: 'Invalid title.' });
    updates.title = body.title.trim();
  }
  if (body.description !== undefined) {
    if (!isNonEmptyString(body.description, 5000)) return res.status(400).json({ success: false, message: 'Invalid description.' });
    updates.description = body.description.trim();
  }
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !VALID_STATUSES.has(body.status.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    updates.status = body.status.toLowerCase();
  }
  if (body.priority !== undefined) {
    const p = Number(body.priority);
    if (!Number.isFinite(p) || p < 0 || p > 5) return res.status(400).json({ success: false, message: 'Invalid priority. Must be 0-5.' });
    updates.priority = p;
  }
  if (body.estimated_budget !== undefined) {
    const b = Number(body.estimated_budget);
    if (!Number.isFinite(b) || b < 0) return res.status(400).json({ success: false, message: 'Invalid estimated_budget.' });
    updates.estimated_budget = b;
  }
  if (body.estimated_volunteers !== undefined) {
    const v = Number(body.estimated_volunteers);
    if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0) return res.status(400).json({ success: false, message: 'Invalid estimated_volunteers.' });
    updates.estimated_volunteers = v;
  }

  // Nothing to update
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields to update.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const q = await client.query('SELECT id, user_id, status FROM issues WHERE id = $1 FOR UPDATE', [id]);
    if (q.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Issue not found.' });
    }

    const issue = q.rows[0];
    const isOwner = issue.user_id === userId;
    const isAdmin = req.user?.role === 'admin';
    if (!isOwner && !isAdmin) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Permission denied.' });
    }

    // Build update query
    const setClauses = [];
    const params = [];
    let idx = 1;
    for (const [k, v] of Object.entries(updates)) {
      setClauses.push(`${k} = $${idx}`);
      params.push(v);
      idx++;
    }
    params.push(id);

    const updateQuery = `UPDATE issues SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
    const updated = await client.query(updateQuery, params);

    await client.query('COMMIT');
    res.json({ success: true, issue: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('updateIssue error:', err.message || err);
    res.status(500).json({ success: false, message: 'Unable to update issue.' });
  } finally {
    client.release();
  }
}

module.exports = { updateIssue };
