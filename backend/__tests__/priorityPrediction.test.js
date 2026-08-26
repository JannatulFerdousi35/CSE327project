/**
 * Unit tests for Priority Prediction (POST /api/ai/priority/:issueId)
 *
 * Mocks: PostgreSQL (pg), Gemini AI (@google/genai)
 * Real code under test: backend/server.js route handler + validation logic
 */

const mockGenerateContent = jest.fn();
const mockQuery = jest.fn();
const mockConnect = jest.fn();

jest.mock("pg", () => ({
  Pool: jest.fn(() => ({ query: mockQuery, connect: mockConnect })),
}));

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

const request = require("supertest");

// Require server AFTER mocks — routes get the shared mock references
const app = require("../server");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockGeminiPriority(overrides) {
  const data = {
    summary: "A critical drainage problem near the school.",
    recommended_priority: "High",
    estimated_budget: 8000,
    estimated_volunteers: 12,
    confidence_score: 0.92,
    ...overrides,
  };
  mockGenerateContent.mockResolvedValue({ text: JSON.stringify(data) });
}

function mockIssueFound(overrides = {}) {
  const issue = {
    id: 42,
    title: "Blocked drainage near school",
    description: "Waterlogging after rain",
    category: "Water",
    division: "Dhaka",
    district: "Dhaka",
    upazila: "Dhanmondi",
    union_name: "Dhanmondi Union",
    village: "Labaid",
    ...overrides,
  };
  // Call sequence: SELECT issue → (Gemini) → BEGIN → INSERT → UPDATE → COMMIT
  mockQuery
    .mockResolvedValueOnce({ rows: [issue], rowCount: 1 })     // SELECT issue
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })          // BEGIN
    .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // INSERT ai_analysis
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })          // UPDATE issues.priority
    .mockResolvedValueOnce({ rows: [], rowCount: 0 });         // COMMIT
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Priority Prediction", () => {
  beforeEach(() => {
    // Mock pool.connect for the transaction path (BEGIN/COMMIT/ROLLBACK)
    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: jest.fn(),
    });
  });

  test("should return 200 with High priority for a severe issue", async () => {
    // Arrange
    mockIssueFound();
    mockGeminiPriority({ recommended_priority: "High", confidence_score: 0.95 });

    // Act
    const res = await request(app).post("/api/ai/priority/42");

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.analysis).toBeDefined();
  });

  test("should return 200 with Low priority for a minor issue", async () => {
    // Arrange
    mockIssueFound();
    mockGeminiPriority({
      recommended_priority: "Low",
      estimated_budget: 1000,
      estimated_volunteers: 3,
      confidence_score: 0.7,
    });

    // Act
    const res = await request(app).post("/api/ai/priority/42");

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.analysis).toBeDefined();
  });

  test("should return 500 when Gemini returns invalid data", async () => {
    // Arrange — issue exists but Gemini returns bad data
    const issue = {
      id: 42,
      title: "Test",
      description: "Test",
      category: "Water",
    };
    mockQuery.mockResolvedValueOnce({ rows: [issue], rowCount: 1 });
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ summary: "", recommended_priority: "Ultra" }),
    });

    // Act
    const res = await request(app).post("/api/ai/priority/42");

    // Assert — route's own catch block returns 500
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  test("should return 404 when issue does not exist", async () => {
    // Arrange
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    // Act
    const res = await request(app).post("/api/ai/priority/999");

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  test("should return 400 for invalid issue ID", async () => {
    // Arrange — non-numeric ID

    // Act
    const res = await request(app).post("/api/ai/priority/abc");

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid/i);
  });
});
