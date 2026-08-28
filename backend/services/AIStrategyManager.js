/**
 * AIStrategyManager.js
 * Implements the Strategy Pattern for AI provider management with automatic fallback
 * Supports multiple AI providers (Gemini, OpenAI, Claude) with graceful degradation
 */

const { GoogleGenAI } = require("@google/genai");
const OpenAI = require("openai");
const Anthropic = require("@anthropic-ai/sdk");

/**
 * Base interface for all AI providers
 * Each provider must implement these methods
 */
class AIProvider {
  get name() {
    throw new Error("Provider must implement name getter");
  }

  isConfigured() {
    throw new Error("Provider must implement isConfigured()");
  }

  async isAvailable() {
    throw new Error("Provider must implement isAvailable()");
  }

  async generatePriority(issue) {
    throw new Error("Provider must implement generatePriority()");
  }

  async generatePlan(message) {
    throw new Error("Provider must implement generatePlan()");
  }

  async checkDuplicate(title, description, category, candidates) {
    throw new Error("Provider must implement checkDuplicate()");
  }

  async analyzeImages(issue, images) {
    throw new Error("Provider must implement analyzeImages()");
  }

  async testConnection() {
    throw new Error("Provider must implement testConnection()");
  }
}

/**
 * Google Gemini AI Provider
 */
class GeminiProvider extends AIProvider {
  constructor() {
    super();
    this.apiKey = process.env.GEMINI_API_KEY || "";
    this.client = new GoogleGenAI({ apiKey: this.apiKey });
  }

  get name() {
    return "Gemini";
  }

  isConfigured() {
    return !!this.apiKey;
  }

  async isAvailable() {
    try {
      return await this.testConnection();
    } catch {
      return false;
    }
  }

  async testConnection() {
    if (!this.isConfigured()) return false;

    try {
      const response = await this.client.models.generateContent({
        model: "gemini-1.5-flash",
        contents: "ping",
      });
      return !!response?.text;
    } catch (error) {
      console.warn(`Gemini connection test failed: ${error.message}`);
      return false;
    }
  }

  async generatePriority(issue) {
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

    const response = await this.client.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });

    const analysis = JSON.parse(response.text.trim());
    this.validatePriorityAnalysis(analysis);
    return analysis;
  }

  async generatePlan(message) {
    const systemInstruction = `You are the Community Action Bridge AI Planner for Bangladesh. Your role is to help community members plan practical solutions to local problems such as flooding, drainage, roads, water supply, sanitation, education, electricity, and environmental issues.

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

    const response = await this.client.models.generateContent({
      model: "gemini-1.5-flash",
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

    const parsed = JSON.parse(rawText.trim());
    if (!parsed.response || !parsed.plan) {
      throw new Error("Gemini response missing required fields.");
    }

    return parsed;
  }

  async checkDuplicate(title, description, category, candidates) {
    const prompt = `Compare this new community issue with the shortlisted existing issues and identify a possible duplicate. Treat this as a warning only. Return a duplicate only when the title, description, and context are very similar.

Return ONLY valid JSON. Do not include markdown or code fences. similar_issue_id must be null or a valid integer from the candidate IDs.

{
  "is_duplicate": false,
  "confidence_score": 0.15,
  "reason": "No sufficiently similar issue found",
  "similar_issue_id": null
}

New issue:
${JSON.stringify({ title, description, category })}

Shortlisted existing issues:
${JSON.stringify(candidates.map((c) => ({ id: c.id, title: c.title, description: c.description, category: c.category })))}`;

    const response = await this.client.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });

    const parsed = JSON.parse(response.text.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ""));
    this.validateDuplicateResult(parsed, candidates.map((c) => c.id));
    return parsed;
  }

  async analyzeImages(issue, images) {
    if (!images || images.length === 0) {
      throw new Error("No images available for analysis.");
    }

    const prompt = `Analyze the uploaded issue images for a Bangladesh community reporting app. Determine what is actually visible in the images and compare it to the submitted issue description and category. Return a brief assessment of severity and whether the images match the reported issue.

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
})}`;

    const parts = [{ text: prompt }];

    for (const image of images) {
      try {
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
      } catch (error) {
        console.error(`Failed to process image from ${image.image_url}:`, error.message);
        throw new Error("Failed to process image for analysis.");
      }
    }

    const result = await this.client.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts }],
    });

    const parsed = JSON.parse(result.text.trim());
    this.validateImageAnalysis(parsed);
    return parsed;
  }

  validatePriorityAnalysis(analysis) {
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
  }

  validateDuplicateResult(result, candidateIds) {
    if (
      typeof result.is_duplicate !== "boolean" ||
      typeof result.confidence_score !== "number" ||
      result.confidence_score < 0 ||
      result.confidence_score > 1 ||
      typeof result.reason !== "string" ||
      !result.reason.trim() ||
      (result.similar_issue_id !== null &&
        (!Number.isInteger(result.similar_issue_id) ||
          !candidateIds.includes(result.similar_issue_id)))
    ) {
      throw new Error("Gemini returned invalid duplicate detection data.");
    }
  }

  validateImageAnalysis(result) {
    const validCategories = ["Road", "Water", "Flood", "Garbage", "School", "Electricity", "Sanitation", "Environment", "Other"];
    const validSeverities = ["Low", "Medium", "High"];

    if (
      typeof result.detected_issue !== "string" ||
      !result.detected_issue.trim() ||
      !validCategories.includes(result.category) ||
      !validSeverities.includes(result.severity) ||
      typeof result.description !== "string" ||
      !result.description.trim() ||
      typeof result.confidence_score !== "number" ||
      !Number.isFinite(result.confidence_score) ||
      result.confidence_score < 0 ||
      result.confidence_score > 1 ||
      typeof result.matches_report !== "boolean"
    ) {
      throw new Error("Gemini returned invalid image analysis data.");
    }
  }
}

/**
 * OpenAI Provider (GPT-4 / GPT-3.5-turbo)
 */
class OpenAIProvider extends AIProvider {
  constructor() {
    super();
    this.apiKey = process.env.OPENAI_API_KEY || "";
    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  get name() {
    return "OpenAI";
  }

  isConfigured() {
    return !!this.apiKey;
  }

  async isAvailable() {
    try {
      return await this.testConnection();
    } catch {
      return false;
    }
  }

  async testConnection() {
    if (!this.isConfigured()) return false;

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      });
      return !!response?.choices?.[0]?.message?.content;
    } catch (error) {
      console.warn(`OpenAI connection test failed: ${error.message}`);
      return false;
    }
  }

  async generatePriority(issue) {
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

    const response = await this.client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned empty response");

    const analysis = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ""));
    this.validatePriorityAnalysis(analysis);
    return analysis;
  }

  async generatePlan(message) {
    const systemInstruction = `You are the Community Action Bridge AI Planner for Bangladesh. Your role is to help community members plan practical solutions to local problems such as flooding, drainage, roads, water supply, sanitation, education, electricity, and environmental issues.

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
}`;

    const response = await this.client.chat.completions.create({
      model: "gpt-3.5-turbo",
      system: systemInstruction,
      messages: [{ role: "user", content: message.trim() }],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned empty response");

    const parsed = JSON.parse(content.trim());
    if (!parsed.response || !parsed.plan) {
      throw new Error("OpenAI response missing required fields.");
    }

    return parsed;
  }

  async checkDuplicate(title, description, category, candidates) {
    const prompt = `Compare this new community issue with the shortlisted existing issues and identify a possible duplicate. Treat this as a warning only. Return a duplicate only when the title, description, and context are very similar.

Return ONLY valid JSON. Do not include markdown or code fences. similar_issue_id must be null or a valid integer from the candidate IDs.

{
  "is_duplicate": false,
  "confidence_score": 0.15,
  "reason": "No sufficiently similar issue found",
  "similar_issue_id": null
}

New issue:
${JSON.stringify({ title, description, category })}

Shortlisted existing issues:
${JSON.stringify(candidates.map((c) => ({ id: c.id, title: c.title, description: c.description, category: c.category })))}`;

    const response = await this.client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned empty response");

    const parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ""));
    this.validateDuplicateResult(parsed, candidates.map((c) => c.id));
    return parsed;
  }

  async analyzeImages(issue, images) {
    if (!images || images.length === 0) {
      throw new Error("No images available for analysis.");
    }

    const prompt = `Analyze the uploaded issue images for a Bangladesh community reporting app. Determine what is actually visible in the images and compare it to the submitted issue description and category. Return a brief assessment of severity and whether the images match the reported issue.

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
})}`;

    const imageContent = [];

    for (const image of images) {
      try {
        const response = await fetch(image.image_url);
        if (!response.ok) {
          throw new Error("Failed to fetch image for AI analysis.");
        }

        const contentType = response.headers.get("content-type") || "image/jpeg";
        const arrayBuffer = await response.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");

        imageContent.push({
          type: "image_url",
          image_url: {
            url: `data:${contentType};base64,${base64Data}`,
          },
        });
      } catch (error) {
        console.error(`Failed to process image from ${image.image_url}:`, error.message);
        throw new Error("Failed to process image for analysis.");
      }
    }

    const result = await this.client.chat.completions.create({
      model: "gpt-4-vision",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...imageContent,
          ],
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = result.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned empty response");

    const parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ""));
    this.validateImageAnalysis(parsed);
    return parsed;
  }

  validatePriorityAnalysis(analysis) {
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
      throw new Error("OpenAI returned invalid priority analysis data.");
    }
  }

  validateDuplicateResult(result, candidateIds) {
    if (
      typeof result.is_duplicate !== "boolean" ||
      typeof result.confidence_score !== "number" ||
      result.confidence_score < 0 ||
      result.confidence_score > 1 ||
      typeof result.reason !== "string" ||
      !result.reason.trim() ||
      (result.similar_issue_id !== null &&
        (!Number.isInteger(result.similar_issue_id) ||
          !candidateIds.includes(result.similar_issue_id)))
    ) {
      throw new Error("OpenAI returned invalid duplicate detection data.");
    }
  }

  validateImageAnalysis(result) {
    const validCategories = ["Road", "Water", "Flood", "Garbage", "School", "Electricity", "Sanitation", "Environment", "Other"];
    const validSeverities = ["Low", "Medium", "High"];

    if (
      typeof result.detected_issue !== "string" ||
      !result.detected_issue.trim() ||
      !validCategories.includes(result.category) ||
      !validSeverities.includes(result.severity) ||
      typeof result.description !== "string" ||
      !result.description.trim() ||
      typeof result.confidence_score !== "number" ||
      !Number.isFinite(result.confidence_score) ||
      result.confidence_score < 0 ||
      result.confidence_score > 1 ||
      typeof result.matches_report !== "boolean"
    ) {
      throw new Error("OpenAI returned invalid image analysis data.");
    }
  }
}

/**
 * Claude (Anthropic) Provider
 */
class ClaudeProvider extends AIProvider {
  constructor() {
    super();
    this.apiKey = process.env.ANTHROPIC_API_KEY || "";
    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  get name() {
    return "Claude";
  }

  isConfigured() {
    return !!this.apiKey;
  }

  async isAvailable() {
    try {
      return await this.testConnection();
    } catch {
      return false;
    }
  }

  async testConnection() {
    if (!this.isConfigured()) return false;

    try {
      const response = await this.client.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 10,
        messages: [{ role: "user", content: "ping" }],
      });
      return !!response?.content?.[0]?.text;
    } catch (error) {
      console.warn(`Claude connection test failed: ${error.message}`);
      return false;
    }
  }

  async generatePriority(issue) {
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

    const response = await this.client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0]?.type === "text" ? response.content[0].text : "";
    if (!content) throw new Error("Claude returned empty response");

    const analysis = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ""));
    this.validatePriorityAnalysis(analysis);
    return analysis;
  }

  async generatePlan(message) {
    const systemInstruction = `You are the Community Action Bridge AI Planner for Bangladesh. Your role is to help community members plan practical solutions to local problems such as flooding, drainage, roads, water supply, sanitation, education, electricity, and environmental issues.

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
}`;

    const response = await this.client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 2000,
      system: systemInstruction,
      messages: [{ role: "user", content: message.trim() }],
    });

    const content = response.content[0]?.type === "text" ? response.content[0].text : "";
    if (!content) throw new Error("Claude returned empty response");

    const parsed = JSON.parse(content.trim());
    if (!parsed.response || !parsed.plan) {
      throw new Error("Claude response missing required fields.");
    }

    return parsed;
  }

  async checkDuplicate(title, description, category, candidates) {
    const prompt = `Compare this new community issue with the shortlisted existing issues and identify a possible duplicate. Treat this as a warning only. Return a duplicate only when the title, description, and context are very similar.

Return ONLY valid JSON. Do not include markdown or code fences. similar_issue_id must be null or a valid integer from the candidate IDs.

{
  "is_duplicate": false,
  "confidence_score": 0.15,
  "reason": "No sufficiently similar issue found",
  "similar_issue_id": null
}

New issue:
${JSON.stringify({ title, description, category })}

Shortlisted existing issues:
${JSON.stringify(candidates.map((c) => ({ id: c.id, title: c.title, description: c.description, category: c.category })))}`;

    const response = await this.client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0]?.type === "text" ? response.content[0].text : "";
    if (!content) throw new Error("Claude returned empty response");

    const parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ""));
    this.validateDuplicateResult(parsed, candidates.map((c) => c.id));
    return parsed;
  }

  async analyzeImages(issue, images) {
    if (!images || images.length === 0) {
      throw new Error("No images available for analysis.");
    }

    const prompt = `Analyze the uploaded issue images for a Bangladesh community reporting app. Determine what is actually visible in the images and compare it to the submitted issue description and category. Return a brief assessment of severity and whether the images match the reported issue.

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
})}`;

    const imageContent = [];

    for (const image of images) {
      try {
        const response = await fetch(image.image_url);
        if (!response.ok) {
          throw new Error("Failed to fetch image for AI analysis.");
        }

        const contentType = response.headers.get("content-type") || "image/jpeg";
        const arrayBuffer = await response.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");

        imageContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: contentType,
            data: base64Data,
          },
        });
      } catch (error) {
        console.error(`Failed to process image from ${image.image_url}:`, error.message);
        throw new Error("Failed to process image for analysis.");
      }
    }

    const result = await this.client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...imageContent,
          ],
        },
      ],
    });

    const content = result.content[0]?.type === "text" ? result.content[0].text : "";
    if (!content) throw new Error("Claude returned empty response");

    const parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ""));
    this.validateImageAnalysis(parsed);
    return parsed;
  }

  validatePriorityAnalysis(analysis) {
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
      throw new Error("Claude returned invalid priority analysis data.");
    }
  }

  validateDuplicateResult(result, candidateIds) {
    if (
      typeof result.is_duplicate !== "boolean" ||
      typeof result.confidence_score !== "number" ||
      result.confidence_score < 0 ||
      result.confidence_score > 1 ||
      typeof result.reason !== "string" ||
      !result.reason.trim() ||
      (result.similar_issue_id !== null &&
        (!Number.isInteger(result.similar_issue_id) ||
          !candidateIds.includes(result.similar_issue_id)))
    ) {
      throw new Error("Claude returned invalid duplicate detection data.");
    }
  }

  validateImageAnalysis(result) {
    const validCategories = ["Road", "Water", "Flood", "Garbage", "School", "Electricity", "Sanitation", "Environment", "Other"];
    const validSeverities = ["Low", "Medium", "High"];

    if (
      typeof result.detected_issue !== "string" ||
      !result.detected_issue.trim() ||
      !validCategories.includes(result.category) ||
      !validSeverities.includes(result.severity) ||
      typeof result.description !== "string" ||
      !result.description.trim() ||
      typeof result.confidence_score !== "number" ||
      !Number.isFinite(result.confidence_score) ||
      result.confidence_score < 0 ||
      result.confidence_score > 1 ||
      typeof result.matches_report !== "boolean"
    ) {
      throw new Error("Claude returned invalid image analysis data.");
    }
  }
}

/**
 * AI Strategy Manager
 * Orchestrates multiple AI providers with automatic fallback
 * Priority order: Gemini -> OpenAI -> Claude
 */
class AIStrategyManager {
  constructor() {
    this.providers = [];
    this.logger = {
      info: (msg) => console.log(`[AIStrategy] ${msg}`),
      warn: (msg) => console.warn(`[AIStrategy] ${msg}`),
      error: (msg) => console.error(`[AIStrategy] ${msg}`),
    };

    // Initialize providers in priority order
    // First configured & available provider will be used, fallback to next on failure
    const allProviders = [new GeminiProvider(), new OpenAIProvider(), new ClaudeProvider()];
    this.providers = allProviders.filter((p) => p.isConfigured());

    if (this.providers.length === 0) {
      this.logger.error("No AI providers configured! Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY");
    } else {
      this.logger.info(`Initialized ${this.providers.length} AI provider(s): ${this.providers.map((p) => p.name).join(", ")}`);
    }
  }

  /**
   * Get the currently available provider
   */
  async getCurrentProvider() {
    for (const provider of this.providers) {
      try {
        if (await provider.isAvailable()) {
          return provider;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  /**
   * Generate priority analysis with automatic fallback
   */
  async generatePriority(issue) {
    let lastError = null;

    for (const provider of this.providers) {
      try {
        if (!(await provider.isAvailable())) {
          this.logger.warn(`${provider.name} not available, trying next provider`);
          continue;
        }

        this.logger.info(`Generating priority analysis using ${provider.name}`);
        const result = await provider.generatePriority(issue);
        this.logger.info(`Priority analysis successful with ${provider.name}`);
        return result;
      } catch (error) {
        lastError = error;
        this.logger.warn(`${provider.name} failed: ${error.message}. Trying next provider...`);
      }
    }

    throw new Error(`All AI providers exhausted for priority analysis. Last error: ${lastError?.message || "Unknown"}`);
  }

  /**
   * Generate community action plan with automatic fallback
   */
  async generatePlan(message) {
    let lastError = null;

    for (const provider of this.providers) {
      try {
        if (!(await provider.isAvailable())) {
          this.logger.warn(`${provider.name} not available, trying next provider`);
          continue;
        }

        this.logger.info(`Generating action plan using ${provider.name}`);
        const result = await provider.generatePlan(message);
        this.logger.info(`Action plan generation successful with ${provider.name}`);
        return result;
      } catch (error) {
        lastError = error;
        this.logger.warn(`${provider.name} failed: ${error.message}. Trying next provider...`);
      }
    }

    throw new Error(`All AI providers exhausted for action plan generation. Last error: ${lastError?.message || "Unknown"}`);
  }

  /**
   * Check for duplicate issues with automatic fallback
   */
  async checkDuplicate(title, description, category, candidates) {
    let lastError = null;

    for (const provider of this.providers) {
      try {
        if (!(await provider.isAvailable())) {
          this.logger.warn(`${provider.name} not available, trying next provider`);
          continue;
        }

        this.logger.info(`Checking duplicates using ${provider.name}`);
        const result = await provider.checkDuplicate(title, description, category, candidates);
        this.logger.info(`Duplicate check successful with ${provider.name}`);
        return result;
      } catch (error) {
        lastError = error;
        this.logger.warn(`${provider.name} failed: ${error.message}. Trying next provider...`);
      }
    }

    throw new Error(`All AI providers exhausted for duplicate detection. Last error: ${lastError?.message || "Unknown"}`);
  }

  /**
   * Analyze issue images with automatic fallback
   */
  async analyzeImages(issue, images) {
    let lastError = null;

    for (const provider of this.providers) {
      try {
        if (!(await provider.isAvailable())) {
          this.logger.warn(`${provider.name} not available, trying next provider`);
          continue;
        }

        this.logger.info(`Analyzing images using ${provider.name}`);
        const result = await provider.analyzeImages(issue, images);
        this.logger.info(`Image analysis successful with ${provider.name}`);
        return result;
      } catch (error) {
        lastError = error;
        this.logger.warn(`${provider.name} failed: ${error.message}. Trying next provider...`);
      }
    }

    throw new Error(`All AI providers exhausted for image analysis. Last error: ${lastError?.message || "Unknown"}`);
  }

  /**
   * Get health status of all configured providers
   */
  async getHealthStatus() {
    const status = [];

    for (const provider of this.providers) {
      try {
        const available = await provider.isAvailable();
        status.push({
          name: provider.name,
          configured: provider.isConfigured(),
          available,
        });
      } catch (error) {
        status.push({
          name: provider.name,
          configured: provider.isConfigured(),
          available: false,
          error: error.message,
        });
      }
    }

    return status;
  }
}

// Export classes and singleton instance
module.exports = {
  AIProvider,
  GeminiProvider,
  OpenAIProvider,
  ClaudeProvider,
  AIStrategyManager,
  aiStrategyManager: new AIStrategyManager(),
};
