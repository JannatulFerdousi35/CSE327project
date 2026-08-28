function errorHandler(error, req, res, next) {
  if (error && error.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Image payload is too large. Please use an image up to 10MB.",
    });
  }

  if (error instanceof SyntaxError && error.status === 400 && error.body) {
    return res.status(400).json({
      success: false,
      message: "Request body is not valid JSON.",
    });
  }

  console.error("Unhandled request error:", error);
  return res.status(500).json({
    success: false,
    message: "Unexpected server error.",
  });
}

module.exports = { errorHandler };
