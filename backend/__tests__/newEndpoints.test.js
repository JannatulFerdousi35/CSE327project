/**
 * Unit tests for newly added endpoints:
 *   - GET  /api/issues/my-reports        (authenticated)
 *   - GET  /api/issues/stats             (public)
 *   - GET  /api/issues/:id/joined-volunteers (public)
 *   - DELETE /api/issues/:id/volunteer   (authenticated — leave)
 *
 * Mocks: PostgreSQL (pg), Gemini AI (@google/genai)
 */

const mockQuery = jest.fn();

jest.mock("pg", () => ({
  Pool: jest.fn(() => ({ query: mockQuery })),
}));

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn(() => ({
    models: { generateContent: jest.fn() },
  })),
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../server");

const AUTH_SECRET = "dev-secret";

const USER = {
  id: 1,
  name: "Test User",
  email: "test@test.com",
  role: "citizen",
  division: "Dhaka",
  district: "Dhaka",
  upazila: "Mirzapur",
};

const OTHER_USER = {
  id: 2,
  name: "Other User",
  email: "other@test.com",
  role: "citizen",
  division: null,
  district: null,
  upazila: null,
};

function createToken(userId) {
  return jwt.sign({ userId }, AUTH_SECRET, { expiresIn: "1h" });
}

const userToken = createToken(USER.id);
const otherToken = createToken(OTHER_USER.id);

// ─── GET /api/issues/my-reports ────────────────────────────────────────────────

describe("GET /api/issues/my-reports", () => {
  test("returns 401 without auth cookie", async () => {
    const res = await request(app).get("/api/issues/my-reports");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("returns user's own issues when authenticated", async () => {
    const issues = [
      { id: 1, user_id: 1, title: "My issue", status: "Reported" },
      { id: 2, user_id: 1, title: "My other issue", status: "Active" },
    ];
    mockQuery
      .mockResolvedValueOnce({ rows: [USER], rowCount: 1 }) // auth
      .mockResolvedValueOnce({ rows: issues, rowCount: 2 }); // my-reports

    const res = await request(app)
      .get("/api/issues/my-reports")
      .set("Cookie", `cab_auth=${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.issues).toHaveLength(2);
    expect(res.body.issues[0].title).toBe("My issue");
  });

  test("returns empty array when user has no reports", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [USER], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .get("/api/issues/my-reports")
      .set("Cookie", `cab_auth=${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.issues).toHaveLength(0);
  });
});

// ─── GET /api/issues/stats ─────────────────────────────────────────────────────

describe("GET /api/issues/stats", () => {
  test("returns issue statistics", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ total: 25, active: 18, resolved: 5, cancelled: 2 }],
      rowCount: 1,
    });

    const res = await request(app).get("/api/issues/stats");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats).toEqual({ total: 25, active: 18, resolved: 5, cancelled: 2 });
  });

  test("returns zeroed stats when no issues exist", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ total: 0, active: 0, resolved: 0, cancelled: 0 }],
      rowCount: 1,
    });

    const res = await request(app).get("/api/issues/stats");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats).toEqual({ total: 0, active: 0, resolved: 0, cancelled: 0 });
  });
});

// ─── GET /api/issues/:id/joined-volunteers ─────────────────────────────────────

describe("GET /api/issues/:id/joined-volunteers", () => {
  test("returns list of volunteers for an issue", async () => {
    const volunteers = [
      { id: 1, name: "Alice", joined_at: "2025-01-01T00:00:00Z", volunteer_status: "active" },
      { id: 2, name: "Bob", joined_at: "2025-01-02T00:00:00Z", volunteer_status: "active" },
    ];
    mockQuery.mockResolvedValueOnce({ rows: volunteers, rowCount: 2 });

    const res = await request(app).get("/api/issues/10/joined-volunteers");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.volunteers).toHaveLength(2);
    expect(res.body.volunteers[0].name).toBe("Alice");
  });

  test("returns empty array when no volunteers joined", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app).get("/api/issues/10/joined-volunteers");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.volunteers).toHaveLength(0);
  });

  test("returns 400 for invalid issue ID", async () => {
    const res = await request(app).get("/api/issues/abc/joined-volunteers");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── DELETE /api/issues/:id/volunteer (leave) ──────────────────────────────────

describe("DELETE /api/issues/:id/volunteer (leave)", () => {
  test("returns 401 without auth cookie", async () => {
    const res = await request(app).delete("/api/issues/10/volunteer");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("returns 200 when volunteer successfully leaves", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [USER], rowCount: 1 }) // auth
      .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }); // delete

    const res = await request(app)
      .delete("/api/issues/10/volunteer")
      .set("Cookie", `cab_auth=${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/left/i);
  });

  test("returns 404 when user hasn't joined the issue", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [USER], rowCount: 1 }) // auth
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // nothing deleted

    const res = await request(app)
      .delete("/api/issues/10/volunteer")
      .set("Cookie", `cab_auth=${userToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test("returns 400 for invalid issue ID", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [USER], rowCount: 1 }); // auth

    const res = await request(app)
      .delete("/api/issues/abc/volunteer")
      .set("Cookie", `cab_auth=${userToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
