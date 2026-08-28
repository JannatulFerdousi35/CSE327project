// Wrap async route handlers to catch errors and forward to the error handler
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
