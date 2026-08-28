// Original server implementation preserved for reference.

const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: __dirname + "/.env" });
const { Pool } = require("pg");
const { GoogleGenAI } = require("@google/genai");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.use(cors({
  origin: /^http:\/\/localhost(?::\d+)?$/,
  credentials: true,
}));
// A 10 MB image becomes roughly 13.4 MB when base64 encoded as a data URL.
app.use(express.json({ limit: "15mb" }));

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

pool.query("SELECT NOW()", (err) => {
  if (err) {
    console.error("PostgreSQL connection failed:", err.message);
  } else {
    console.log("PostgreSQL connected successfully!");
  }
});

// ... (omitted for brevity) Original server.js preserved in full in the branch

module.exports = app;
