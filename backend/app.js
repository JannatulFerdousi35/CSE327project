require("dotenv").config({ path: __dirname + "/.env" });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

// Creating the pool here (rather than lazily inside a repo) makes sure the
// DB connection check runs once, at boot, exactly like the original file.
require("./db/pg");

const rateLimiter = require("./middleware/rateLimiter");
const { errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const issuesRoutes = require("./routes/issuesRoutes");
const issueImagesRoutes = require("./routes/issueImagesRoutes");
const eventsRoutes = require("./routes/eventsRoutes");
const aiRoutes = require("./routes/aiRoutes");
const usersRoutes = require("./routes/usersRoutes");

const app = express();

// --- Security & core middleware -------------------------------------------------
app.use(
  cors({
    origin: /^http:\/\/localhost(?::\d+)?$/,
    credentials: true,
  })
);

// A 10 MB image becomes roughly 13.4 MB when base64 encoded as a data URL.
app.use(express.json({ limit: "15mb" }));

app.use(cookieParser());
app.use(rateLimiter);

// --- Health check -----------------------------------------------------------
app.get("/", (req, res) => {
  res.json({
    message: "Community Action Bridge backend is running!",
  });
});

// --- Feature routers ---------------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/issue-images", issueImagesRoutes);
app.use("/api", issuesRoutes); // /api/issues*, /api/admin/issues*
app.use("/api", eventsRoutes); // /api/events*, /api/admin/events*
app.use("/api", usersRoutes); // /api/users/become-volunteer, /api/volunteer/my-issues

// --- Error handling (must be last) -------------------------------------------
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
