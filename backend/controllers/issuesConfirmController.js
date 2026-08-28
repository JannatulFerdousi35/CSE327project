const pool = require('../db/pg');

async function confirmIssue(req, res) {
  const userId = req.user?.id;
  if (!Number.isInteger(userId)) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid issue id.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure issue exists
    const issueQ = await client.query('SELECT id FROM issues WHERE id = $1 FOR NO KEY UPDATE', [id]);
    if (issueQ.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Issue not found.' });
    }

    // Try to insert confirmation. Table expected: confirmations(user_id int, issue_id int, created_at timestamptz DEFAULT now())
    // Unique constraint on (user_id, issue_id) expected to prevent duplicates.
    let alreadyConfirmed = false;
    try {
      await client.query(
        'INSERT INTO confirmations (user_id, issue_id, created_at) VALUES ($1, $2, now())',
        [userId, id]
      );
    } catch (err) {
      // Unique violation => already confirmed by this user
      if (err && err.code === '23505') {
        alreadyConfirmed = true;
      } else {
        throw err;
      }
    }

    // Get current confirmation count
    const countQ = await client.query('SELECT COUNT(*)::int AS count FROM confirmations WHERE issue_id = $1', [id]);
    const count = countQ.rows[0]?.count || 0;

    await client.query('COMMIT');

    res.json({ success: true, issueId: id, confirmed: !alreadyConfirmed, alreadyConfirmed, count });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('confirmIssue error:', err.message || err);
    res.status(500).json({ success: false, message: 'Unable to confirm issue.' });
  } finally {
    client.release();
  }
}

module.exports = { confirmIssue };
