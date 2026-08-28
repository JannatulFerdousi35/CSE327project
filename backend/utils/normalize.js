// Validates/normalizes the shape Gemini is expected to return for duplicate
// issue detection. Returns null if the shape is untrustworthy.
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

// Validates/normalizes an AI-generated (or stored) action plan.
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

const IMAGE_ANALYSIS_CATEGORIES = [
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
const IMAGE_ANALYSIS_SEVERITIES = ["Low", "Medium", "High"];

// Validates/normalizes an AI-generated image analysis result.
function normalizeImageAnalysisResult(result) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const detectedIssue = typeof result.detected_issue === "string" ? result.detected_issue.trim() : "";
  const category = result.category;
  const severity = result.severity;
  const description = typeof result.description === "string" ? result.description.trim() : "";
  const confidenceScore = Number(result.confidence_score);
  const matchesReport = Boolean(result.matches_report);

  if (
    !detectedIssue ||
    !IMAGE_ANALYSIS_CATEGORIES.includes(category) ||
    !IMAGE_ANALYSIS_SEVERITIES.includes(severity) ||
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

// Pulls the first non-empty value out of a loosely-typed user profile object,
// trying each candidate key in turn (profiles come from `to_jsonb(users)`,
// so field names aren't guaranteed).
function profileValue(profile, keys) {
  for (const key of keys) {
    const value = profile[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

module.exports = {
  normalizeDuplicateResult,
  normalizeActionPlan,
  normalizeImageAnalysisResult,
  IMAGE_ANALYSIS_CATEGORIES,
  IMAGE_ANALYSIS_SEVERITIES,
  profileValue,
};
