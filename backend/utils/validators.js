const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ISSUE_STATUSES = ["Reported", "Pending", "Approved", "In Progress", "Completed", "Rejected"];
const EVENT_STATUSES = ["planned", "approved", "active", "completed", "rejected"];

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isValidEmail(email) {
  return typeof email === "string" && EMAIL_PATTERN.test(email);
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

// Case-insensitively resolves a requested status against an allow-list,
// returning the canonically-cased value or undefined if it isn't allowed.
function resolveStatus(requestedStatus, allowedStatuses) {
  const normalized = String(requestedStatus || "").trim().toLowerCase();
  return allowedStatuses.find((status) => status.toLowerCase() === normalized);
}

module.exports = {
  ISSUE_STATUSES,
  EVENT_STATUSES,
  isPositiveInteger,
  isValidEmail,
  isValidPassword,
  resolveStatus,
};
