/**
 * Unit tests for Issue Cancellation (PATCH /api/issues/:issueId/cancel)
 *
 * Mocks: PostgreSQL (pg), Gemini AI (@google/genai)
 * Real code under test: backend/server.js route handler + requireAuth middleware
 *
 * Authentication: We create a real JWT using the same secret ("dev-secret")
 * that requireAuth uses, and send it as the cab_auth cookie.
 * No real database or network calls are made.
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

// ─── Test data ────────────────────────────────────────────────────────────────

const OWNER_USER = {
  id: 1,
  name: "Rahim Uddin",
  email: "rahim@test.com",
  role: "citizen",
  division: "Dhaka",
  district: "Dhaka",
  upazila: "Dhanmondi",
};

const OTHER_USER = {
  id: 99,
  name: "Other Person",
  email: "other@test.com",
  role: "citizen",
  division: null,
  district: null,
  upazila: null,
};

const REPORTED_ISSUE = {
  id: 10,
  user_id: 1,
  status: "Reported",
  title: "Pothole on main road",
};

const ACTIVE_ISSUE = {
  id: 11,
  user_id: 1,
  status: "Active",
  title: "Street light not working",
};

const COMPLETED_ISSUE = {
  id: 12,
  user_id: 1,
  status: "completed",
  title: "Fixed drainage",
};

const CANCELLED_ISSUE = {
  id: 13,
  user_id: 1,
  status: "cancelled",
  title: "Already cancelled issue",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createToken(userId) {
  return jwt.sign({ userId }, AUTH_SECRET, { expiresIn: "1h" });
}

const ownerToken = createToken(OWNER_USER.id);
const otherToken = createToken(OTHER_USER.id);

/**
 * Mock pool.query for the cancel flow.
 *
 * Call order:
 *   1. requireAuth → SELECT user WHERE id = $1
 *   2. Cancel route → SELECT id, user_id, status FROM issues WHERE id = $1
 *   3. Cancel route → UPDATE issues SET status = 'Cancelled' ... (if all checks pass)
 */
function mockAuthThenIssueThenUpdate(user, issue, updatedIssue) {
  mockQuery
    .mockResolvedValueOnce({ rows: [user], rowCount: 1 })       // 1. auth: SELECT user
    .mockResolvedValueOnce({ rows: [issue], rowCount: 1 })      // 2. route: SELECT issue
    .mockResolvedValueOnce({ rows: [updatedIssue], rowCount: 1 }); // 3. route: UPDATE
}

function mockAuthThenIssue(user, issue) {
  mockQuery
    .mockResolvedValueOnce({ rows: [user], rowCount: 1 })       // 1. auth: SELECT user
    .mockResolvedValueOnce({ rows: [issue], rowCount: 1 });     // 2. route: SELECT issue
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Issue Cancellation", () => {
  test("should return 200 when owner cancels a Reported issue", async () => {
    // Arrange
    const updatedIssue = { ...REPORTED_ISSUE, status: "Cancelled" };
    mockAuthThenIssueThenUpdate(OWNER_USER, REPORTED_ISSUE, updatedIssue);

    // Act
    const res = await request(app)
      .patch(`/api/issues/${REPORTED_ISSUE.id}/cancel`)
      .set("Cookie", `cab_auth=${ownerToken}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.issue).toBeDefined();
    expect(res.body.issue.status).toBe("Cancelled");
  });

  test("should return 200 when owner cancels an Active issue", async () => {
    // Arrange
    const updatedIssue = { ...ACTIVE_ISSUE, status: "Cancelled" };
    mockAuthThenIssueThenUpdate(OWNER_USER, ACTIVE_ISSUE, updatedIssue);

    // Act
    const res = await request(app)
      .patch(`/api/issues/${ACTIVE_ISSUE.id}/cancel`)
      .set("Cookie", `cab_auth=${ownerToken}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.issue.status).toBe("Cancelled");
  });

  test("should return 403 when a non-owner tries to cancel", async () => {
    // Arrange — issue belongs to user 1, request from user 99
    mockAuthThenIssue(OTHER_USER, REPORTED_ISSUE);

    // Act
    const res = await request(app)
      .patch(`/api/issues/${REPORTED_ISSUE.id}/cancel`)
      .set("Cookie", `cab_auth=${otherToken}`);

    // Assert
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/only the issue reporter/i);
  });

  test("should return 400 when issue is already completed", async () => {
    // Arrange — status is "completed", owner is requesting
    mockAuthThenIssue(OWNER_USER, COMPLETED_ISSUE);

    // Act
    const res = await request(app)
      .patch(`/api/issues/${COMPLETED_ISSUE.id}/cancel`)
      .set("Cookie", `cab_auth=${ownerToken}`);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/cannot be cancelled/i);
  });

  test("should return 400 when issue is already cancelled", async () => {
    // Arrange — status is "cancelled", owner is requesting
    mockAuthThenIssue(OWNER_USER, CANCELLED_ISSUE);

    // Act
    const res = await request(app)
      .patch(`/api/issues/${CANCELLED_ISSUE.id}/cancel`)
      .set("Cookie", `cab_auth=${ownerToken}`);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/cannot be cancelled/i);
  });

  test("should return 404 when issue does not exist", async () => {
    // Arrange — auth succeeds, but issue not found
    mockQuery
      .mockResolvedValueOnce({ rows: [OWNER_USER], rowCount: 1 })  // auth
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });            // issue not found

    // Act
    const res = await request(app)
      .patch("/api/issues/9999/cancel")
      .set("Cookie", `cab_auth=${ownerToken}`);

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });
});
