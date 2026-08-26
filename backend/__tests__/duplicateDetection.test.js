/**
 * Unit tests for Duplicate Detection (POST /api/issues/check-duplicate)
 *
 * Mocks: PostgreSQL (pg), Gemini AI (@google/genai)
 * Real code under test: backend/server.js route handler + normalizeDuplicateResult logic
 */

const mockGenerateContent = jest.fn();
const mockQuery = jest.fn();

jest.mock("pg", () => ({
  Pool: jest.fn(() => ({ query: mockQuery })),
}));

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

const request = require("supertest");

const app = require("../server");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NEW_ISSUE = {
  title: "Blocked drain near the school",
  description: "Waterlogging after every rainfall near the primary school",
  category: "Water",
  division: "Dhaka",
  district: "Dhaka",
  upazila: "Dhanmondi",
  union_name: "Dhanmondi Union",
  village: "Shankar",
};

function mockNoCandidates() {
  mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
}

function mockCandidates(candidates) {
  mockQuery.mockResolvedValueOnce({ rows: candidates, rowCount: candidates.length });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Duplicate Detection", () => {
  test("should return is_duplicate false when no similar issues exist", async () => {
    // Arrange — DB returns zero candidates
    mockNoCandidates();

    // Act
    const res = await request(app)
      .post("/api/issues/check-duplicate")
      .send(NEW_ISSUE);

    // Assert — no Gemini call made, immediate response
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.is_duplicate).toBe(false);
    expect(res.body.similar_issue_id).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  test("should detect a duplicate when Gemini identifies a match", async () => {
    // Arrange — DB returns a similar candidate
    const candidate = {
      id: 10,
      title: "Drainage blocked near primary school",
      description: "The drain is blocked causing waterlogging",
      category: "Water",
      division: "Dhaka",
      district: "Dhaka",
      upazila: "Dhanmondi",
      union_name: "Dhanmondi Union",
      village: "Shankar",
      latitude: null,
      longitude: null,
    };
    mockCandidates([candidate]);

    // Gemini says it IS a duplicate
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        is_duplicate: true,
        confidence_score: 0.88,
        reason: "Same blocked drain issue near the same school in the same area",
        similar_issue_id: 10,
      }),
    });

    // Act
    const res = await request(app)
      .post("/api/issues/check-duplicate")
      .send(NEW_ISSUE);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.is_duplicate).toBe(true);
    expect(res.body.confidence_score).toBe(0.88);
    expect(res.body.similar_issue_id).toBe(10);
    expect(res.body.similar_issue).not.toBeNull();
    expect(res.body.similar_issue.title).toBe("Drainage blocked near primary school");
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  test("should return is_duplicate false when Gemini finds no match", async () => {
    // Arrange — DB returns a candidate, but Gemini says not a duplicate
    const candidate = {
      id: 20,
      title: "Garbage collection needed in market area",
      description: "Piles of garbage near the bazar",
      category: "Garbage",
      division: "Dhaka",
      district: "Dhaka",
      upazila: "Dhanmondi",
      union_name: "Dhanmondi Union",
      village: "Shankar",
      latitude: null,
      longitude: null,
    };
    mockCandidates([candidate]);

    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        is_duplicate: false,
        confidence_score: 0.1,
        reason: "Different category and different problem entirely",
        similar_issue_id: null,
      }),
    });

    // Act
    const res = await request(app)
      .post("/api/issues/check-duplicate")
      .send(NEW_ISSUE);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.is_duplicate).toBe(false);
    expect(res.body.similar_issue_id).toBeNull();
  });

  test("should return 400 when title is missing", async () => {
    // Arrange — missing title

    // Act
    const res = await request(app)
      .post("/api/issues/check-duplicate")
      .send({
        description: "Some description",
        category: "Water",
      });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/required/i);
  });

  test("should return 500 when Gemini returns invalid JSON data", async () => {
    // Arrange — DB has candidates, but Gemini returns garbage
    const candidate = {
      id: 30,
      title: "Test issue",
      description: "Test",
      category: "Water",
      division: null,
      district: null,
      upazila: null,
      union_name: null,
      village: null,
      latitude: null,
      longitude: null,
    };
    mockCandidates([candidate]);

    // Gemini returns data that fails normalizeDuplicateResult
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ garbage: "not a valid result" }),
    });

    // Act
    const res = await request(app)
      .post("/api/issues/check-duplicate")
      .send(NEW_ISSUE);

    // Assert — route's catch block returns 500
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
