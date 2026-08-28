const pool = require('../db/pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { isValidEmail, isValidPassword } = require('../utils/validators');

const AUTH_COOKIE = 'cab_auth';
const getAuthSecret = () => process.env.AUTH_SECRET || 'dev-secret';

async function signup(req, res) {
  const { name, email, password } = req.body || {};
  if (!name || !isValidEmail(email) || !isValidPassword(password)) {
    return res.status(400).json({ success: false, message: 'Invalid signup details.' });
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ success: false, message: 'Email already in use.' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     RETURNING id, name, email, role, division, district, upazila`,
    [name, email, hashed]
  );

  const user = result.rows[0];
  const token = jwt.sign({ userId: user.id }, getAuthSecret(), { expiresIn: '7d' });
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
  };

  res.cookie(AUTH_COOKIE, token, cookieOptions);
  res.json({ success: true, user });
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ success: false, message: 'Invalid credentials.' });
  }

  const result = await pool.query(
    'SELECT id, password_hash, password, name, email, role, division, district, upazila FROM users WHERE email = $1',
    [email]
  );
  if (result.rows.length === 0) {
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }

  const user = result.rows[0];
  const storedHash = user.password_hash || user.password;
  const match = storedHash ? await bcrypt.compare(password, storedHash) : false;
  if (!match) {
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }

  const token = jwt.sign({ userId: user.id }, getAuthSecret(), { expiresIn: '7d' });
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
  };

  res.cookie(AUTH_COOKIE, token, cookieOptions);

  // remove sensitive fields
  delete user.password_hash;
  delete user.password;

  res.json({ success: true, user });
}

function logout(req, res) {
  res.clearCookie(AUTH_COOKIE, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.json({ success: true });
}

module.exports = { signup, login, logout };
