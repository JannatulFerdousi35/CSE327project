const requireAuth = require("./auth");

module.exports = function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Administrator access required." });
    }
    next();
  });
};
