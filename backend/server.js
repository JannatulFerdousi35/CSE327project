const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: __dirname + "/.env" });
const { Pool } = require("pg");
const { GoogleGenAI } = require("@google/genai");
const { OAuth2Client } = require("google-auth-library");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

app.get("/", (req, res) => {
  res.json({
    message: "Community Action Bridge backend is running!",
  });
});
app.get("/api/issues", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        user_id,
        title,
        description,
        category,
        division,
        district,
        upazila,
        union_name,
        village,
        image_url,
        priority,
        status,
        estimated_budget,
        estimated_volunteers,
        created_at
      FROM issues
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      issues: result.rows,
    });
  } catch (error) {
    console.error("Error fetching issues:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch issues.",
    });
  }
});

// My reports — authenticated user's own issues
app.get("/api/issues/my-reports", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, user_id, title, description, category, division, district, upazila,
              union_name, village, image_url, priority, status, created_at
       FROM issues
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, issues: result.rows });
  } catch (error) {
  console.error("MY REPORTS ERROR:", error);

  res.status(500).json({
    success: false,
    message: "Failed to fetch issue.",
    error: error.message
  });
}
});

// Issue stats — public counts for homepage
app.get("/api/issues/stats", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE LOWER(status) IN ('reported','new','active','pending','approved','in progress'))::int AS active,
        COUNT(*) FILTER (WHERE LOWER(status) IN ('completed','resolved'))::int AS resolved,
        COUNT(*) FILTER (WHERE LOWER(status) = 'cancelled')::int AS cancelled
      FROM issues
    `);
    const row = result.rows[0] || { total: 0, active: 0, resolved: 0, cancelled: 0 };
    res.json({ success: true, stats: { total: row.total, active: row.active, resolved: row.resolved, cancelled: row.cancelled } });
  } catch (error) {
    console.error("Error fetching issue stats:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stats." });
  }
});
app.get("/api/issues/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM issues WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Issue not found." });
    }

    res.json({ success: true, issue: result.rows[0] });
  } catch (error) {
    console.error("Error fetching issue:", error);
    res.status(500).json({ success: false, message: "Failed to fetch issue." });
  }
});

app.get("/api/admin/issues", requireAdmin, async (req, res) => {
  const { search = "", status = "", category = "", district = "", upazila = "" } = req.query;
  const values = [];
  const conditions = [];
  const addValue = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (String(search).trim()) {
    const searchParam = addValue(`%${String(search).trim()}%`);
    conditions.push(`(CAST(i.id AS TEXT) ILIKE ${searchParam} OR i.title ILIKE ${searchParam} OR i.description ILIKE ${searchParam} OR CONCAT_WS(' ', i.division, i.district, i.upazila, i.union_name, i.village) ILIKE ${searchParam})`);
  }

  for (const [field, value] of [["status", status], ["category", category], ["district", district], ["upazila", upazila]]) {
    if (String(value).trim() && !String(value).toLowerCase().startsWith("all ")) {
      conditions.push(`LOWER(i.${field}) = LOWER(${addValue(String(value).trim())})`);
    }
  }

  try {
    const result = await pool.query(
      `SELECT i.id, i.title, i.description, i.category, i.division, i.district, i.upazila, i.union_name, i.village, i.latitude, i.longitude, i.priority, i.status, i.created_at, a.recommended_priority, a.summary AS ai_summary, (a.id IS NOT NULL) AS ai_analyzed
       FROM issues i
       LEFT JOIN ai_analysis a ON a.issue_id = i.id
       ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
       ORDER BY i.created_at DESC`,
      values
    );

    res.json({ success: true, issues: result.rows });
  } catch (error) {
    console.error("Admin issue list error:", error);
    res.status(500).json({ success: false, message: "Unable to load issues." });
  }
});

app.patch("/api/admin/issues/:issueId/status", requireAdmin, async (req, res) => {
  const issueId = Number(req.params.issueId);
  const requestedStatus = String(req.body?.status || "").trim();
  const allowedStatuses = ["Reported", "Pending", "Approved", "In Progress", "Completed", "Rejected"];
  const nextStatus = allowedStatuses.find((status) => status.toLowerCase() === requestedStatus.toLowerCase());

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid issue ID." });
  }
  if (!nextStatus) {
    return res.status(400).json({ success: false, message: "Invalid issue status." });
  }

  try {
    const result = await pool.query(
      `UPDATE issues SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [nextStatus, issueId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Issue not found." });
    }
    res.json({ success: true, issue: result.rows[0] });
  } catch (error) {
    console.error("Admin issue status update error:", error);
    res.status(500).json({ success: false, message: "Unable to update issue status." });
  }
});

app.post("/api/issues", requireAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      division,
      district,
      upazila,
      union_name,
      village,
      latitude,
      longitude,
      image_url,
    } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        message: "Title, description, and category are required.",
      });
    }

    const result = await pool.query(
      `INSERT INTO issues (
        user_id,
        title,
        description,
        category,
        division,
        district,
        upazila,
        union_name,
        village,
        latitude,
        longitude,
        image_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        req.user.id,
        title,
        description,
        category,
        division || null,
        district || null,
        upazila || null,
        union_name || null,
        village || null,
        latitude ?? null,
        longitude ?? null,
        image_url || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Issue reported successfully!",
      issue: result.rows[0],
    });
  } catch (error) {
    console.error("Issue creation error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to save issue.",
    });
  }
});

function normalizeDuplicateResult(value, candidateIds) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const similarIssueId = value.similar_issue_id === null ? null : Number(value.similar_issue_id);
  const confidenceScore = Number(value.confidence_score);

  if (
    typeof value.is_duplicate !== "boolean" ||
    !Number.isFinite(confidenceScore) ||
    confidenceScore < 0 ||
    confidenceScore > 1 ||
    typeof value.reason !== "string" ||
    !value.reason.trim() ||
    (similarIssueId !== null && (!Number.isInteger(similarIssueId) || !candidateIds.includes(similarIssueId)))
  ) {
    return null;
  }

  return {
    is_duplicate: value.is_duplicate,
    confidence_score: confidenceScore,
    reason: value.reason.trim(),
    similar_issue_id: similarIssueId,
  };
}

app.post("/api/issues/check-duplicate", async (req, res) => {
  const {
    title,
    description,
    category,
    division,
    district,
    upazila,
    union_name,
    village,
    latitude,
    longitude,
  } = req.body;

  if (!title || !description || !category) {
    return res.status(400).json({
      success: false,
      message: "Title, description, and category are required.",
    });
  }

  try {
    const candidatesResult = await pool.query(
      `SELECT id, title, description, category, division, district, upazila, union_name, village, latitude, longitude,
        (
          CASE WHEN LOWER(category) = LOWER($3) THEN 4 ELSE 0 END +
          CASE WHEN $1::text IS NOT NULL THEN 0 ELSE 0 END +
          CASE WHEN $2::text IS NOT NULL THEN 0 ELSE 0 END +
          CASE WHEN $4::text IS NOT NULL THEN 0 ELSE 0 END +
          CASE WHEN LOWER(COALESCE(district, '')) = LOWER(COALESCE($5, '')) AND NULLIF($5, '') IS NOT NULL THEN 3 ELSE 0 END +
          CASE WHEN LOWER(COALESCE(upazila, '')) = LOWER(COALESCE($6, '')) AND NULLIF($6, '') IS NOT NULL THEN 2 ELSE 0 END +
          CASE WHEN LOWER(COALESCE(union_name, '')) = LOWER(COALESCE($7, '')) AND NULLIF($7, '') IS NOT NULL THEN 2 ELSE 0 END +
          CASE WHEN LOWER(COALESCE(village, '')) = LOWER(COALESCE($8, '')) AND NULLIF($8, '') IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN $9::numeric IS NOT NULL AND $10::numeric IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
            AND ABS(latitude - $9::numeric) <= 0.1 AND ABS(longitude - $10::numeric) <= 0.1 THEN 3 ELSE 0 END
        ) AS match_score
       FROM issues
       WHERE LOWER(category) = LOWER($3)
         AND (
           (NULLIF($5, '') IS NOT NULL AND LOWER(COALESCE(district, '')) = LOWER($5)) OR
           (NULLIF($6, '') IS NOT NULL AND LOWER(COALESCE(upazila, '')) = LOWER($6)) OR
           (NULLIF($7, '') IS NOT NULL AND LOWER(COALESCE(union_name, '')) = LOWER($7)) OR
           (NULLIF($8, '') IS NOT NULL AND LOWER(COALESCE(village, '')) = LOWER($8)) OR
           ($9::numeric IS NOT NULL AND $10::numeric IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
             AND ABS(latitude - $9::numeric) <= 0.1 AND ABS(longitude - $10::numeric) <= 0.1)
         )
       ORDER BY match_score DESC, created_at DESC
       LIMIT 10`,
      [title, description, category, division || "", district || "", upazila || "", union_name || "", village || "", latitude ?? null, longitude ?? null]
    );

    const candidates = candidatesResult.rows;

    if (candidates.length === 0) {
      return res.json({
        success: true,
        is_duplicate: false,
        confidence_score: 0,
        reason: "No sufficiently similar issue found.",
        similar_issue_id: null,
      });
    }

    const candidateIds = candidates.map((candidate) => candidate.id);
    const prompt = `Compare this new community issue with the shortlisted existing issues and identify a possible duplicate. Treat this as a warning only. Return a duplicate only when the title, description, category, and location indicate the same underlying problem. Return ONLY valid JSON with no markdown.

{
  "is_duplicate": false,
  "confidence_score": 0.15,
  "reason": "No sufficiently similar issue found",
  "similar_issue_id": null
}

New issue:
${JSON.stringify({ title, description, category, division, district, upazila, union_name, village, latitude, longitude })}

Shortlisted existing issues:
${JSON.stringify(candidates.map(({ id, title: candidateTitle, description: candidateDescription, category: candidateCategory, division: candidateDivision, district: candidateDistrict, upazila: candidateUpazila, union_name: candidateUnion, village: candidateVillage, latitude: candidateLatitude, longitude: candidateLongitude }) => ({ id, title: candidateTitle, description: candidateDescription, category: candidateCategory, division: candidateDivision, district: candidateDistrict, upazila: candidateUpazila, union_name: candidateUnion, village: candidateVillage, latitude: candidateLatitude, longitude: candidateLongitude })) )}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });
    let parsed;

    try {
      parsed = JSON.parse(response.text.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ""));
    } catch {
      throw new Error("Gemini returned invalid duplicate detection JSON.");
    }

    const result = normalizeDuplicateResult(parsed, candidateIds);

    if (!result) {
      throw new Error("Gemini returned invalid duplicate detection data.");
    }

    const similarIssue = result.similar_issue_id === null
      ? null
      : candidates.find((candidate) => candidate.id === result.similar_issue_id);

    return res.json({
      success: true,
      ...result,
      similar_issue: similarIssue
        ? {
            title: similarIssue.title,
            division: similarIssue.division,
            district: similarIssue.district,
            upazila: similarIssue.upazila,
            union_name: similarIssue.union_name,
            village: similarIssue.village,
          }
        : null,
    });
  } catch (error) {
    console.error("Duplicate detection error:", error);

    return res.status(500).json({
      success: false,
      message: "Duplicate detection is temporarily unavailable.",
    });
  }
});

app.get("/api/issues/:issueId/images", async (req, res) => {
  const issueId = Number(req.params.issueId);

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid issue ID.",
    });
  }

  try {
    const issueResult = await pool.query(
      "SELECT id FROM issues WHERE id = $1",
      [issueId]
    );

    if (issueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Issue not found.",
      });
    }

    const result = await pool.query(
      `SELECT id, issue_id, uploaded_by, image_url, caption, is_primary, created_at
       FROM issue_images
       WHERE issue_id = $1
       ORDER BY is_primary DESC, id ASC`,
      [issueId]
    );

    res.json({
      success: true,
      images: result.rows,
    });
  } catch (error) {
    console.error("Error fetching issue images:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch issue images.",
    });
  }
});

app.post("/api/issues/:issueId/images", requireAuth, async (req, res) => {
  const issueId = Number(req.params.issueId);

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return res.status(404).json({
      success: false,
      message: "Issue not found.",
    });
  }

  const { image_url, caption, is_primary } = req.body;

  if (typeof image_url !== "string" || image_url.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "image_url is required.",
    });
  }

  try {
    const issueResult = await pool.query(
      "SELECT id FROM issues WHERE id = $1",
      [issueId]
    );

    if (issueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Issue not found.",
      });
    }

    const result = await pool.query(
      `INSERT INTO issue_images (
        issue_id,
        uploaded_by,
        image_url,
        caption,
        is_primary
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        issueId,
        req.user.id,
        image_url.trim(),
        caption || null,
        is_primary ?? false,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Issue image added successfully.",
      image: result.rows[0],
    });
  } catch (error) {
    console.error("Issue image creation error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add issue image.",
    });
  }
});

function profileValue(profile, keys) {
  for (const key of keys) {
    const value = profile[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function volunteerDistanceKm(latitude, longitude, volunteerLatitude, volunteerLongitude) {
  if (![latitude, longitude, volunteerLatitude, volunteerLongitude].every(Number.isFinite)) {
    return null;
  }

  const radians = (value) => value * Math.PI / 180;
  const latitudeDelta = radians(volunteerLatitude - latitude);
  const longitudeDelta = radians(volunteerLongitude - longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(volunteerLatitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

app.get("/api/issues/:issueId/recommended-volunteers", async (req, res) => {
  const issueId = Number(req.params.issueId);

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid issue ID." });
  }

  try {
    const issueResult = await pool.query(
      `SELECT id, category, division, district, upazila, union_name, village, latitude, longitude, priority
       FROM issues WHERE id = $1`,
      [issueId]
    );

    if (issueResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Issue not found." });
    }

    const issue = issueResult.rows[0];
    const usersResult = await pool.query("SELECT to_jsonb(users) AS profile FROM users LIMIT 500");
    const category = String(issue.category || "").toLowerCase();
    const candidates = usersResult.rows
      .map(({ profile }) => {
        const role = profileValue(profile, ["role", "user_type", "account_type", "type"]).toLowerCase();
        const skills = profileValue(profile, ["skills", "interests", "interest", "expertise", "bio"]);
        const availability = profileValue(profile, ["availability", "available", "availability_status", "status"]).toLowerCase();
        const division = profileValue(profile, ["division"]);
        const district = profileValue(profile, ["district"]);
        const upazila = profileValue(profile, ["upazila", "subdistrict"]);
        const village = profileValue(profile, ["village", "area", "location"]);
        const latitude = Number(profileValue(profile, ["latitude", "lat"]));
        const longitude = Number(profileValue(profile, ["longitude", "lng", "lon"]));
        const volunteerFlag = String(profile.is_volunteer ?? profile.volunteer ?? "").toLowerCase();
        const isVolunteer = role.includes("volunteer") || ["true", "yes", "1"].includes(volunteerFlag);
        const unavailable = ["unavailable", "inactive", "false", "no"].some((value) => availability === value);
        const skillMatch = skills.toLowerCase().includes(category);
        const locationMatches = [[issue.division, division], [issue.district, district], [issue.upazila, upazila], [issue.village, village]]
          .filter(([issueValue, volunteerValue]) => issueValue && volunteerValue && String(issueValue).toLowerCase() === String(volunteerValue).toLowerCase()).length;
        const distanceKm = volunteerDistanceKm(Number(issue.latitude), Number(issue.longitude), latitude, longitude);

        if (!isVolunteer || unavailable) return null;

        let score = 0;
        if (skillMatch) score += 5;
        score += locationMatches * 3;
        if (distanceKm !== null) score += Math.max(0, 4 - Math.min(distanceKm / 10, 4));
        if (["available", "yes", "true", "active"].includes(availability)) score += 2;

        return {
          volunteer_id: Number(profile.id),
          name: profileValue(profile, ["name", "full_name", "display_name"]) || "Volunteer",
          skills: skills || "Community support",
          location: [village, upazila, district, division].filter(Boolean).join(", ") || "Location not provided",
          reason: skillMatch ? `Relevant ${category} experience${distanceKm !== null ? " and nearby" : ""}` : locationMatches ? "Located in the issue area" : "Available community volunteer",
          match_score: Math.min(score / 14, 1),
          score,
        };
      })
      .filter(Boolean)
      .sort((first, second) => second.score - first.score)
      .slice(0, 5)
      .map(({ score, ...recommendation }) => recommendation);

    return res.json({ success: true, recommendations: candidates });
  } catch (error) {
    console.error("Volunteer recommendation error:", error);
    return res.status(500).json({ success: false, message: "Volunteer recommendations are currently unavailable." });
  }
});

app.get("/api/issue-images/:id", async (req, res) => {
  const imageId = Number(req.params.id);

  if (!Number.isInteger(imageId) || imageId <= 0) {
    return res.status(404).json({
      success: false,
      message: "Issue image not found.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT *
       FROM issue_images
       WHERE id = $1`,
      [imageId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Issue image not found.",
      });
    }

    res.json({
      success: true,
      image: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching issue image:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch issue image.",
    });
  }
});

app.delete("/api/issue-images/:id", async (req, res) => {
  const imageId = Number(req.params.id);

  if (!Number.isInteger(imageId) || imageId <= 0) {
    return res.status(404).json({
      success: false,
      message: "Issue image not found.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM issue_images
       WHERE id = $1
       RETURNING id`,
      [imageId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Issue image not found.",
      });
    }

    res.json({
      success: true,
      message: "Issue image deleted successfully.",
    });
  } catch (error) {
    console.error("Issue image deletion error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete issue image.",
    });
  }
});

app.get("/api/ai/test", async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      success: false,
      message: "GEMINI_API_KEY is not configured on the backend.",
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: "Reply with a short greeting confirming that Gemini is working.",
    });

    res.json({
      success: true,
      message: "Gemini is working",
      response: response.text,
    });
  } catch (error) {
    console.error("Gemini test error:", error);

    res.status(500).json({
      success: false,
      message: "Gemini AI request failed.",
      error: error.message || "Unknown Gemini error",
    });
  }
});

app.post("/api/ai/planner", async (req, res) => {
  const { message } = req.body || {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      success: false,
      message: "A non-empty message is required.",
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      success: false,
      message: "AI service is not configured on the server.",
    });
  }

  try {
    const systemInstruction = `You are the Community Action Bridge AI Planner for Bangladesh. Your role is to help community members plan practical solutions to local problems such as flooding, drainage issues, road damage, sanitation, garbage collection, school repairs, electricity outages, and environmental concerns.

You MUST respond with valid JSON matching this exact schema. Do not include any text outside the JSON object:

{
  "response": "<A friendly conversational message summarizing the plan in 2-4 sentences>",
  "plan": {
    "problem": "<One-line description of the community problem>",
    "steps": [
      {
        "title": "<Short step title>",
        "description": "<Brief description of what to do>",
        "timeframe": "<When to do it, e.g. 'Day 1-2', 'Week 1'>"
      }
    ],
    "volunteers": "<Number or range of volunteers needed>",
    "duration": "<Total estimated duration of the project>",
    "materials": ["<material 1>", "<material 2>"],
    "budget": "<Estimated cost in Taka (৳)>",
    "safety": "<Key safety precautions>",
    "expectedOutcome": "<What the community can expect after completing the plan>"
  }
}

Guidelines:
- Give practical, actionable advice suited to Bangladesh communities and Union Parishad governance.
- Use simple, clear language. Use Taka (৳) for any cost estimates.
- Suggest realistic volunteer counts, timelines, materials, and budgets (3-8 steps).
- Where appropriate, mention coordination with local authorities (Union Parishad, Ward Councillor, Upazila engineers).
- Do not invent facts. Base advice on general best practices for community development in Bangladesh.
- The "response" field should be a warm, conversational summary. The "plan" field should contain the structured details.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: message.trim(),
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            response: { type: "string" },
            plan: {
              type: "object",
              properties: {
                problem: { type: "string" },
                steps: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      timeframe: { type: "string" },
                    },
                    required: ["title", "description", "timeframe"],
                  },
                },
                volunteers: { type: "string" },
                duration: { type: "string" },
                materials: { type: "array", items: { type: "string" } },
                budget: { type: "string" },
                safety: { type: "string" },
                expectedOutcome: { type: "string" },
              },
              required: [
                "problem",
                "steps",
                "volunteers",
                "duration",
                "materials",
                "budget",
                "safety",
                "expectedOutcome",
              ],
            },
          },
          required: ["response", "plan"],
        },
      },
    });

    const rawText = response.text;

    if (!rawText || !rawText.trim()) {
      throw new Error("Gemini returned an empty response.");
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      console.error("Failed to parse Gemini JSON:", rawText);
      throw new Error("Gemini returned invalid JSON.");
    }

    if (!parsed.response || !parsed.plan) {
      throw new Error("Gemini response missing required fields.");
    }

    res.json({
      success: true,
      response: parsed.response,
      plan: parsed.plan,
    });
  } catch (error) {
    console.error("AI planner error:", error);

    res.status(500).json({
      success: false,
      message: "AI planner is temporarily unavailable. Please try again.",
    });
  }
});

app.post("/api/ai/priority/:issueId", async (req, res) => {
  const issueId = Number(req.params.issueId);

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid issue ID.",
    });
  }

  let client;

  try {
    const issueResult = await pool.query(
      `SELECT id, title, description, category, division, district, upazila, union_name, village
       FROM issues
       WHERE id = $1`,
      [issueId]
    );

    if (issueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Issue not found.",
      });
    }

    const issue = issueResult.rows[0];
    const prompt = `Analyze this community issue and predict its priority based on severity, impact on the community, urgency, category, and location/context.

Return ONLY valid JSON with this exact structure. Do not include markdown or code fences.
recommended_priority must be exactly High, Medium, or Low. estimated_budget must be a number. estimated_volunteers must be an integer. confidence_score must be between 0 and 1.

{
  "summary": "short summary of the issue",
  "recommended_priority": "High",
  "estimated_budget": 5000,
  "estimated_volunteers": 10,
  "confidence_score": 0.90
}

Issue:
${JSON.stringify(issue)}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const analysis = JSON.parse(response.text.trim());
    const validPriorities = ["High", "Medium", "Low"];

    if (
      typeof analysis.summary !== "string" ||
      analysis.summary.trim() === "" ||
      !validPriorities.includes(analysis.recommended_priority) ||
      typeof analysis.estimated_budget !== "number" ||
      !Number.isFinite(analysis.estimated_budget) ||
      analysis.estimated_budget < 0 ||
      !Number.isInteger(analysis.estimated_volunteers) ||
      analysis.estimated_volunteers < 0 ||
      typeof analysis.confidence_score !== "number" ||
      !Number.isFinite(analysis.confidence_score) ||
      analysis.confidence_score < 0 ||
      analysis.confidence_score > 1
    ) {
      throw new Error("Gemini returned invalid priority analysis data.");
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const analysisResult = await client.query(
      `INSERT INTO ai_analysis (
        issue_id,
        summary,
        recommended_priority,
        estimated_budget,
        estimated_volunteers,
        confidence_score,
        raw_result,
        analyzed_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (issue_id)
      DO UPDATE SET
        summary = EXCLUDED.summary,
        recommended_priority = EXCLUDED.recommended_priority,
        estimated_budget = EXCLUDED.estimated_budget,
        estimated_volunteers = EXCLUDED.estimated_volunteers,
        confidence_score = EXCLUDED.confidence_score,
        raw_result = EXCLUDED.raw_result,
        analyzed_at = EXCLUDED.analyzed_at,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        issueId,
        analysis.summary.trim(),
        analysis.recommended_priority,
        analysis.estimated_budget,
        analysis.estimated_volunteers,
        analysis.confidence_score,
        analysis,
      ]
    );

    await client.query(
      "UPDATE issues SET priority = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [analysis.recommended_priority, issueId]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "AI priority prediction completed.",
      analysis: analysisResult.rows[0],
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("AI priority prediction error:", error);

    res.status(500).json({
      success: false,
      message: "AI priority prediction failed.",
    });
  } finally {
    client?.release();
  }
});

app.get("/api/issues/:issueId/ai-analysis", async (req, res) => {
  const issueId = Number(req.params.issueId);

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid issue ID.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT *
       FROM ai_analysis
       WHERE issue_id = $1`,
      [issueId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "AI analysis not available.",
      });
    }

    res.json({
      success: true,
      analysis: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching AI analysis:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch AI analysis.",
    });
  }
});

function normalizeActionPlan(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const actionPlan = Array.isArray(value.action_plan)
    ? value.action_plan.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];
  const requiredResources = Array.isArray(value.required_resources)
    ? value.required_resources.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];

  if (
    actionPlan.length === 0 ||
    actionPlan.length > 8 ||
    requiredResources.length > 8 ||
    typeof value.estimated_time !== "string" ||
    !value.estimated_time.trim() ||
    typeof value.notes !== "string" ||
    !value.notes.trim()
  ) {
    return null;
  }

  return {
    action_plan: actionPlan,
    required_resources: requiredResources,
    estimated_time: value.estimated_time.trim(),
    notes: value.notes.trim(),
  };
}

// Load a previously generated action plan without triggering generation
app.get("/api/issues/:issueId/action-plan", async (req, res) => {
  const issueId = Number(req.params.issueId);

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid issue ID.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT raw_result
       FROM ai_analysis
       WHERE issue_id = $1`,
      [issueId]
    );

    const storedPlan = normalizeActionPlan(result.rows[0]?.raw_result?.action_plan);

    if (!storedPlan) {
      return res.status(404).json({
        success: false,
        message: "Action plan not available.",
      });
    }

    return res.json({
      success: true,
      action_plan: storedPlan,
    });
  } catch (error) {
    console.error("Error fetching action plan:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch action plan.",
    });
  }
});

app.post("/api/ai/action-plan/:issueId", async (req, res) => {
  const issueId = Number(req.params.issueId);

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid issue ID.",
    });
  }

  let client;

  try {
    const issueResult = await pool.query(
      `SELECT id, title, description, category, division, district, upazila, union_name, village, priority
       FROM issues
       WHERE id = $1`,
      [issueId]
    );

    if (issueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Issue not found.",
      });
    }

    const analysisResult = await pool.query(
      `SELECT id, summary, recommended_priority, estimated_budget, estimated_volunteers, raw_result
       FROM ai_analysis
       WHERE issue_id = $1`,
      [issueId]
    );
    const existingAnalysis = analysisResult.rows[0] || null;
    const storedPlan = normalizeActionPlan(existingAnalysis?.raw_result?.action_plan);

    if (storedPlan) {
      return res.json({
        success: true,
        cached: true,
        action_plan: storedPlan,
      });
    }

    const issue = issueResult.rows[0];
    const analysis = existingAnalysis
      ? {
          summary: existingAnalysis.summary,
          recommended_priority: existingAnalysis.recommended_priority,
          estimated_budget: existingAnalysis.estimated_budget,
          estimated_volunteers: existingAnalysis.estimated_volunteers,
        }
      : null;
    const imageAnalysis = existingAnalysis?.raw_result?.image_analysis || null;
    const prompt = `Create a practical, general action plan for this community issue. Do not give dangerous instructions or pretend to be a local authority.

Return ONLY valid JSON with this exact structure. Do not include markdown or code fences.
{
  "action_plan": ["Action 1", "Action 2", "Action 3"],
  "required_resources": ["Resource 1", "Resource 2"],
  "estimated_time": "1-2 days",
  "notes": "Short practical note"
}

Issue:
${JSON.stringify({ ...issue, ai_analysis: analysis, image_analysis: imageAnalysis })}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });
    let parsed;

    try {
      parsed = JSON.parse(response.text.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ""));
    } catch {
      throw new Error("Gemini returned invalid action plan JSON.");
    }

    const actionPlan = normalizeActionPlan(parsed);

    if (!actionPlan) {
      throw new Error("Gemini returned invalid action plan data.");
    }

    const rawResult = {
      ...(existingAnalysis?.raw_result || {}),
      action_plan: actionPlan,
    };

    client = await pool.connect();
    await client.query("BEGIN");

    const savedResult = existingAnalysis
      ? await client.query(
          `UPDATE ai_analysis
           SET raw_result = $1, updated_at = CURRENT_TIMESTAMP
           WHERE issue_id = $2
           RETURNING raw_result`,
          [rawResult, issueId]
        )
      : await client.query(
          `INSERT INTO ai_analysis (issue_id, raw_result, analyzed_at, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING raw_result`,
          [issueId, rawResult]
        );
    const savedPlan = savedResult.rows[0].raw_result.action_plan;

    const planResult = await client.query(
      `INSERT INTO action_plans (issue_id, title, description, status)
       VALUES ($1, $2, $3, 'draft')
       ON CONFLICT (issue_id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [issueId, String(issue.title || "Community issue").slice(0, 255), actionPlan.notes]
    );
    const actionPlanId = planResult.rows[0].id;

    await client.query("DELETE FROM action_plan_steps WHERE action_plan_id = $1", [actionPlanId]);
    for (const [index, stepTitle] of actionPlan.action_plan.entries()) {
      await client.query(
        `INSERT INTO action_plan_steps (action_plan_id, step_order, title, status)
         VALUES ($1, $2, $3, 'pending')`,
        [actionPlanId, index + 1, stepTitle.slice(0, 255)]
      );
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      cached: false,
      action_plan: savedPlan,
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("AI action plan error:", error);

    return res.status(500).json({
      success: false,
      message: "AI action plan is temporarily unavailable.",
    });
  } finally {
    client?.release();
  }
});

function normalizeImageAnalysisResult(result) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const validCategories = [
    "Road",
    "Water",
    "Flood",
    "Garbage",
    "School",
    "Electricity",
    "Sanitation",
    "Environment",
    "Other",
  ];
  const validSeverities = ["Low", "Medium", "High"];

  const detectedIssue = typeof result.detected_issue === "string" ? result.detected_issue.trim() : "";
  const category = result.category;
  const severity = result.severity;
  const description = typeof result.description === "string" ? result.description.trim() : "";
  const confidenceScore = Number(result.confidence_score);
  const matchesReport = Boolean(result.matches_report);

  if (
    !detectedIssue ||
    !validCategories.includes(category) ||
    !validSeverities.includes(severity) ||
    !description ||
    !Number.isFinite(confidenceScore) ||
    confidenceScore < 0 ||
    confidenceScore > 1 ||
    typeof result.matches_report !== "boolean"
  ) {
    return null;
  }

  return {
    detected_issue: detectedIssue,
    category,
    severity,
    confidence_score: confidenceScore,
    description,
    matches_report: matchesReport,
  };
}

async function analyzeIssueImagesWithGemini(issue, images) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  if (!images || images.length === 0) {
    throw new Error("No images available for analysis.");
  }

  const prompt = `Analyze the uploaded issue images for a Bangladesh community reporting app. Determine what is actually visible in the images and compare it to the submitted issue description and category.

Return ONLY valid JSON in this exact structure and do not include markdown or code fences.
{
  "detected_issue": "short description of what is visible in the image",
  "category": "Road|Water|Flood|Garbage|School|Electricity|Sanitation|Environment|Other",
  "severity": "Low|Medium|High",
  "confidence_score": 0.0,
  "description": "brief explanation of the image evidence and relevant context",
  "matches_report": true
}

Issue details:
${JSON.stringify({
  title: issue.title,
  description: issue.description,
  category: issue.category,
  division: issue.division,
  district: issue.district,
  upazila: issue.upazila,
  union_name: issue.union_name,
  village: issue.village,
})}`;

  const parts = [{ text: prompt }];

  for (const image of images) {
    const response = await fetch(image.image_url);

    if (!response.ok) {
      throw new Error("Failed to fetch image for AI analysis.");
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    parts.push({
      inlineData: {
        mimeType: contentType,
        data: base64Data,
      },
    });
  }

  const result = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts }],
  });

  const parsed = JSON.parse(result.text.trim());
  const normalized = normalizeImageAnalysisResult(parsed);

  if (!normalized) {
    throw new Error("Gemini returned invalid image analysis data.");
  }

  return normalized;
}

app.post("/api/ai/image-analysis/:issueId", async (req, res) => {
  const issueId = Number(req.params.issueId);

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid issue ID.",
    });
  }

  try {
    const issueResult = await pool.query(
      `SELECT *
       FROM issues
       WHERE id = $1`,
      [issueId]
    );

    if (issueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Issue not found.",
      });
    }

    const issue = issueResult.rows[0];
    const imageResult = await pool.query(
      `SELECT *
       FROM issue_images
       WHERE issue_id = $1
       ORDER BY is_primary DESC, id ASC`,
      [issueId]
    );

    if (imageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No images available for this issue.",
      });
    }

    const analysis = await analyzeIssueImagesWithGemini(issue, imageResult.rows);
    const imageAnalysisPayload = {
      provider: "gemini",
      ...analysis,
    };

    const existingRow = await pool.query(
      `SELECT *
       FROM ai_analysis
       WHERE issue_id = $1`,
      [issueId]
    );

    if (existingRow.rows.length > 0) {
      const currentRawResult = existingRow.rows[0].raw_result || {};
      const mergedRawResult = {
        ...currentRawResult,
        image_analysis: imageAnalysisPayload,
      };

      const result = await pool.query(
        `UPDATE ai_analysis
         SET raw_result = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE issue_id = $2
         RETURNING *`,
        [mergedRawResult, issueId]
      );

      return res.json({
        success: true,
        message: "AI image analysis completed.",
        analysis: result.rows[0],
      });
    }

    const result = await pool.query(
      `INSERT INTO ai_analysis (
        issue_id,
        summary,
        recommended_priority,
        estimated_budget,
        estimated_volunteers,
        confidence_score,
        raw_result,
        analyzed_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        issueId,
        null,
        null,
        null,
        null,
        null,
        { image_analysis: imageAnalysisPayload },
      ]
    );

    res.json({
      success: true,
      message: "AI image analysis completed.",
      analysis: result.rows[0],
    });
  } catch (error) {
    console.error("AI image analysis error:", error);

    res.status(500).json({
      success: false,
      message: "AI image analysis is temporarily unavailable.",
    });
  }
});

app.get("/api/issues/:issueId/image-analysis", async (req, res) => {
  const issueId = Number(req.params.issueId);

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid issue ID.",
    });
  }

  try {
    const issueResult = await pool.query(
      `SELECT id
       FROM issues
       WHERE id = $1`,
      [issueId]
    );

    if (issueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Issue not found.",
      });
    }

    const result = await pool.query(
      `SELECT raw_result
       FROM ai_analysis
       WHERE issue_id = $1`,
      [issueId]
    );

    if (result.rows.length === 0 || !result.rows[0].raw_result) {
      return res.status(404).json({
        success: false,
        message: "AI image analysis not available.",
      });
    }

    const imageAnalysis = result.rows[0].raw_result.image_analysis || result.rows[0].raw_result;

    if (!imageAnalysis || typeof imageAnalysis !== "object") {
      return res.status(404).json({
        success: false,
        message: "AI image analysis not available.",
      });
    }

    res.json({
      success: true,
      analysis: imageAnalysis,
    });
  } catch (error) {
    console.error("Error fetching image analysis:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch AI image analysis.",
    });
  }
});

// Cancel (withdraw) an issue — owner only
app.patch("/api/issues/:issueId/cancel", requireAuth, async (req, res) => {
  const issueId = Number(req.params.issueId);

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid issue ID." });
  }

  try {
    const existing = await pool.query(
      "SELECT id, user_id, status FROM issues WHERE id = $1",
      [issueId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Issue not found." });
    }

    const issue = existing.rows[0];

    if (issue.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Only the issue reporter can cancel this issue." });
    }

    const currentStatus = (issue.status || "").toLowerCase();
    if (currentStatus === "completed" || currentStatus === "cancelled") {
      return res.status(400).json({ success: false, message: "This issue cannot be cancelled." });
    }

    const result = await pool.query(
      `UPDATE issues SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [issueId]
    );

    res.json({ success: true, message: "Issue cancelled successfully.", issue: result.rows[0] });
  } catch (error) {
    console.error("Issue cancel error:", error);
    res.status(500).json({ success: false, message: "Unable to cancel issue." });
  }
});

// ── Events ───────────────────────────────────────────────────────────────────

// List all events with participant counts
app.get("/api/events", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        ve.*,
        COALESCE(pc.participant_count, 0)::int AS participant_count
       FROM volunteer_events ve
       LEFT JOIN (
         SELECT event_id, COUNT(*)::int AS participant_count
         FROM event_participation
         WHERE participation_status = 'registered'
         GROUP BY event_id
       ) pc ON pc.event_id = ve.id
       WHERE LOWER(ve.status) = 'approved'
       ORDER BY ve.starts_at ASC`
    );
    res.json({ success: true, events: result.rows });
  } catch (error) {
    console.error("List events error:", error);
    res.status(500).json({ success: false, message: "Unable to load events." });
  }
});

// Get events the authenticated user has joined
app.get("/api/events/my-events", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ve.*, COALESCE(pc.participant_count, 0)::int AS participant_count, ep.joined_at
       FROM event_participation ep
       INNER JOIN volunteer_events ve ON ve.id = ep.event_id
       LEFT JOIN (
         SELECT event_id, COUNT(*)::int AS participant_count
         FROM event_participation
         WHERE participation_status = 'registered'
         GROUP BY event_id
       ) pc ON pc.event_id = ve.id
       WHERE ep.user_id = $1 AND ep.participation_status = 'registered'
       ORDER BY ve.starts_at ASC`,
      [req.user.id]
    );
    res.json({ success: true, events: result.rows });
  } catch (error) {
    console.error("My events error:", error);
    res.status(500).json({ success: false, message: "Unable to load your events." });
  }
});

// Join an event
app.post("/api/events/:eventId/join", requireAuth, async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isInteger(eventId) || eventId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid event ID." });
    }

    const eventResult = await pool.query(
      "SELECT id, volunteer_capacity FROM volunteer_events WHERE id = $1",
      [eventId]
    );
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    const event = eventResult.rows[0];

    if (event.volunteer_capacity) {
      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM event_participation
         WHERE event_id = $1 AND participation_status = 'registered'`,
        [eventId]
      );
      if (countResult.rows[0].cnt >= event.volunteer_capacity) {
        return res.status(409).json({ success: false, message: "This event is full." });
      }
    }

    const result = await pool.query(
      `INSERT INTO event_participation (event_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (event_id, user_id)
       DO UPDATE SET participation_status = 'registered', completed_at = NULL
       RETURNING id, event_id, user_id, participation_status, joined_at`,
      [eventId, req.user.id]
    );

    res.status(201).json({ success: true, message: "You joined this event.", participation: result.rows[0] });
  } catch (error) {
    console.error("Event join error:", error);
    res.status(500).json({ success: false, message: "Unable to join event." });
  }
});

// Leave an event
app.delete("/api/events/:eventId/leave", requireAuth, async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isInteger(eventId) || eventId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid event ID." });
    }

    const result = await pool.query(
      `DELETE FROM event_participation
       WHERE event_id = $1 AND user_id = $2 AND participation_status = 'registered'
       RETURNING id`,
      [eventId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "You are not registered for this event." });
    }

    res.json({ success: true, message: "You left this event." });
  } catch (error) {
    console.error("Event leave error:", error);
    res.status(500).json({ success: false, message: "Unable to leave event." });
  }
});

// Check if authenticated user has joined an event
app.get("/api/events/:eventId/join-status", requireAuth, async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isInteger(eventId) || eventId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid event ID." });
    }

    const result = await pool.query(
      `SELECT id, participation_status, joined_at
       FROM event_participation
       WHERE event_id = $1 AND user_id = $2 AND participation_status = 'registered'`,
      [eventId, req.user.id]
    );

    res.json({ success: true, joined: result.rows.length > 0, participation: result.rows[0] || null });
  } catch (error) {
    console.error("Event join-status error:", error);
    res.status(500).json({ success: false, message: "Unable to check event status." });
  }
});

// ── Propose a new event ─────────────────────────────────────────────────────
app.post("/api/events", requireAuth, async (req, res) => {
  try {
    const { title, description, location_name, division, district, upazila, union_name, village, starts_at, ends_at, volunteer_capacity, issue_id } = req.body || {};

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ success: false, message: "Event title is required." });
    }
    if (!starts_at) {
      return res.status(400).json({ success: false, message: "Event start date/time is required." });
    }

    const result = await pool.query(
      `INSERT INTO volunteer_events (organizer_id, issue_id, title, description, location_name, division, district, upazila, union_name, village, starts_at, ends_at, volunteer_capacity, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'planned')
       RETURNING *`,
      [
        req.user.id,
        issue_id || null,
        title.trim(),
        description || null,
        location_name || null,
        division || null,
        district || null,
        upazila || null,
        union_name || null,
        village || null,
        starts_at,
        ends_at || null,
        volunteer_capacity || null,
      ]
    );

    res.status(201).json({ success: true, event: result.rows[0] });
  } catch (error) {
    console.error("Propose event error:", error);
    res.status(500).json({ success: false, message: "Unable to create event proposal." });
  }
});

// ── Admin: List all events (any status) ─────────────────────────────────────
app.get("/api/admin/events", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ve.*, COALESCE(pc.participant_count, 0)::int AS participant_count, u.name AS organizer_name
       FROM volunteer_events ve
       LEFT JOIN (
         SELECT event_id, COUNT(*)::int AS participant_count
         FROM event_participation
         WHERE participation_status = 'registered'
         GROUP BY event_id
       ) pc ON pc.event_id = ve.id
       LEFT JOIN users u ON u.id = ve.organizer_id
       ORDER BY ve.created_at DESC`
    );
    res.json({ success: true, events: result.rows });
  } catch (error) {
    console.error("Admin event list error:", error);
    res.status(500).json({ success: false, message: "Unable to load events." });
  }
});

// ── Admin: Update event status (approve / reject) ──────────────────────────
app.patch("/api/admin/events/:eventId/status", requireAdmin, async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    const requestedStatus = String(req.body?.status || "").trim();
    const allowedStatuses = ["planned", "approved", "active", "completed", "rejected"];
    const nextStatus = allowedStatuses.find((s) => s.toLowerCase() === requestedStatus.toLowerCase());

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid event ID." });
    }
    if (!nextStatus) {
      return res.status(400).json({ success: false, message: "Invalid event status." });
    }

    const existing = await pool.query("SELECT id FROM volunteer_events WHERE id = $1", [eventId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    const result = await pool.query(
      `UPDATE volunteer_events SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [nextStatus, eventId]
    );

    res.json({ success: true, event: result.rows[0] });
  } catch (error) {
    console.error("Admin event status update error:", error);
    res.status(500).json({ success: false, message: "Unable to update event status." });
  }
});

// ── Become a volunteer ──────────────────────────────────────────────────────
app.post("/api/users/become-volunteer", requireAuth, async (req, res) => {
  try {
    await pool.query("UPDATE users SET is_volunteer = true WHERE id = $1", [req.user.id]);
    res.json({ success: true, message: "You are now a volunteer!" });
  } catch (error) {
    console.error("Become volunteer error:", error);
    res.status(500).json({ success: false, message: "Unable to update volunteer status." });
  }
});

app.use((error, req, res, next) => {
  if (error.type === "entity.too.large") {
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
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;

const AUTH_COOKIE = "cab_auth";
const getAuthSecret = () => process.env.AUTH_SECRET || "dev-secret";

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.cookie || "").split(";").filter(Boolean).map((cookie) => {
      const [name, ...value] = cookie.trim().split("=");
      return [name, decodeURIComponent(value.join("="))];
    })
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || "citizen",
    division: user.division || null,
    district: user.district || null,
    upazila: user.upazila || null,
  };
}

function createAuthToken(user) {
  const secret = getAuthSecret();
  if (!secret) throw new Error("AUTH_SECRET is not configured.");
  return jwt.sign({ userId: user.id }, secret, { expiresIn: "7d" });
}

function requireAuth(req, res, next) {
  const secret = getAuthSecret();
  const token = parseCookies(req)[AUTH_COOKIE];

  if (!secret || !token) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, secret);
    if (!payload || typeof payload !== "object" || !Number.isInteger(payload.userId)) {
      throw new Error("Invalid authentication token.");
    }

    pool.query("SELECT id, name, email, role, division, district, upazila FROM users WHERE id = $1", [payload.userId])
      .then((result) => {
        if (result.rows.length === 0) {
          return res.status(401).json({ success: false, message: "Authentication required." });
        }
        req.user = result.rows[0];
        next();
      })
      .catch((error) => {
        console.error("Authentication lookup error:", error.message);
        res.status(401).json({ success: false, message: "Authentication required." });
      });
  } catch {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Administrator access required." });
    }
    next();
  });
}

app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password, phone, division, district, upazila, union_name, village } = req.body || {};
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (typeof name !== "string" || !name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ success: false, message: "Name, valid email, and a password of at least 8 characters are required." });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, phone, division, district, upazila, union_name, village)
       VALUES ($1, $2, $3, 'citizen', $4, $5, $6, $7, $8, $9)
       RETURNING id, name, email, role`,
      [name.trim(), normalizedEmail, passwordHash, phone?.trim() || null, division?.trim() || null, district?.trim() || null, upazila?.trim() || null, union_name?.trim() || null, village?.trim() || null]
    );

    const user = result.rows[0];
    res.status(201).json({ success: true, user: publicUser(user) });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }
    console.error("Signup error:", error.message);
    res.status(500).json({ success: false, message: "Unable to create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  try {
    const result = await pool.query("SELECT id, name, email, password_hash, role, division, district, upazila FROM users WHERE LOWER(email) = $1", [email]);
    const user = result.rows[0];
    const validPassword = user?.password_hash ? await bcrypt.compare(password, user.password_hash) : false;

    if (!user || !validPassword) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const token = createAuthToken(user);
    res.cookie(AUTH_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 24 * 60 * 60 * 1000, path: "/" });
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ success: false, message: "Unable to sign in." });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(AUTH_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  res.json({ success: true });
});
// Join an issue as a volunteer
app.post("/api/issues/:issueId/volunteer", requireAuth, async (req, res) => {
  try {
    const issueId = Number(req.params.issueId);

    if (!Number.isInteger(issueId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid issue ID."
      });
    }

    const issueResult = await pool.query(
      "SELECT id FROM issues WHERE id = $1",
      [issueId]
    );

    if (issueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Issue not found."
      });
    }

    const result = await pool.query(
      `INSERT INTO issue_volunteers (issue_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (issue_id, user_id) DO NOTHING
       RETURNING id, issue_id, user_id, status, joined_at`,
      [issueId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        success: false,
        message: "You have already joined this issue."
      });
    }

    res.status(201).json({
      success: true,
      message: "You joined this issue as a volunteer.",
      participation: result.rows[0]
    });
  } catch (error) {
    console.error("Volunteer join error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to join issue."
    });
  }
});


// Check whether current user joined an issue
app.get("/api/issues/:issueId/volunteer-status", requireAuth, async (req, res) => {
  try {
    const issueId = Number(req.params.issueId);

    const result = await pool.query(
      `SELECT id, status, joined_at
       FROM issue_volunteers
       WHERE issue_id = $1 AND user_id = $2`,
      [issueId, req.user.id]
    );

    res.json({
      success: true,
      joined: result.rows.length > 0,
      participation: result.rows[0] || null
    });
  } catch (error) {
    console.error("Volunteer status error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to check volunteer status."
    });
  }
});

// List volunteers who joined a specific issue
app.get("/api/issues/:issueId/joined-volunteers", async (req, res) => {
  try {
    const issueId = Number(req.params.issueId);
    if (!Number.isInteger(issueId) || issueId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid issue ID." });
    }

    const result = await pool.query(
      `SELECT u.id, u.name, iv.joined_at, iv.status AS volunteer_status
       FROM issue_volunteers iv
       INNER JOIN users u ON u.id = iv.user_id
       WHERE iv.issue_id = $1
       ORDER BY iv.joined_at ASC`,
      [issueId]
    );

    res.json({ success: true, volunteers: result.rows });
  } catch (error) {
    console.error("Joined volunteers error:", error);
    res.status(500).json({ success: false, message: "Unable to load volunteers." });
  }
});

// Leave an issue as a volunteer
app.delete("/api/issues/:issueId/volunteer", requireAuth, async (req, res) => {
  try {
    const issueId = Number(req.params.issueId);
    if (!Number.isInteger(issueId) || issueId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid issue ID." });
    }

    const result = await pool.query(
      `DELETE FROM issue_volunteers
       WHERE issue_id = $1 AND user_id = $2
       RETURNING id`,
      [issueId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "You have not joined this issue." });
    }

    res.json({ success: true, message: "You left this issue." });
  } catch (error) {
    console.error("Volunteer leave error:", error);
    res.status(500).json({ success: false, message: "Unable to leave issue." });
  }
});

// List all issues the authenticated user has joined as a volunteer
app.get("/api/volunteer/my-issues", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        i.id,
        i.title,
        i.description,
        i.category,
        i.division,
        i.district,
        i.upazila,
        i.union_name,
        i.village,
        i.priority,
        i.status,
        i.created_at,
        iv.joined_at,
        iv.status AS volunteer_status
       FROM issue_volunteers iv
       INNER JOIN issues i ON i.id = iv.issue_id
       WHERE iv.user_id = $1
       ORDER BY iv.joined_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      issues: result.rows
    });
  } catch (error) {
    console.error("My joined issues error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to load your joined issues."
    });
  }
});
