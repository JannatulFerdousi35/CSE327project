const jwt = require("jsonwebtoken");
const pool = require("../db/pg");

const AUTH_COOKIE = "cab_auth";
const getAuthSecret = () => process.env.AUTH_SECRET || "dev-secret";

module.exports = async function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE];

  if (!getAuthSecret() || !token) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, getAuthSecret());
    if (!payload || typeof payload !== "object" || !Number.isInteger(payload.userId)) {
      throw new Error("Invalid authentication token.");
    }

    const result = await pool.query(
      "SELECT id, name, email, role, division, district, upazila FROM users WHERE id = $1",
      [payload.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    console.error("Authentication error:", err.message || err);
    return res.status(401).json({ success: false, message: "Authentication required." });
  }
};
