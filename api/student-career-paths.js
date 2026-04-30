/**
 * POST /api/student-career-paths
 * Evidence-grounded lateral career trajectories for students (requires student_paths plan gate).
 */
import { requirePlan } from "./_plan-gate.js";

const MODEL = "llama-3.3-70b-versatile";

/**
 * @param {unknown} obj
 * @returns {boolean}
 */
function isNonEmptyString(obj) {
  return typeof obj === "string" && obj.trim().length > 0;
}

/**
 * @param {unknown} data
 * @returns {{ ok: boolean, payload?: object, error?: string }}
 */
function validateCareerPathsPayload(data) {
  if (!data || typeof data !== "object") return { ok: false, error: "Invalid envelope" };
  const baselineEcho = /** @type {Record<string, unknown>} */ (data).baselineEcho;
  if (!baselineEcho || typeof baselineEcho !== "object") return { ok: false, error: "Missing baselineEcho" };
  const title = baselineEcho.title;
  const summary = baselineEcho.summary;
  const signalsUsed = baselineEcho.signalsUsed;
  if (!isNonEmptyString(title) || !isNonEmptyString(summary)) return { ok: false, error: "baselineEcho.title/summary required" };
  if (!Array.isArray(signalsUsed) || signalsUsed.length === 0 || !signalsUsed.every(isNonEmptyString)) {
    return { ok: false, error: "baselineEcho.signalsUsed must be non-empty string array" };
  }

  const alternatives = /** @type {Record<string, unknown>} */ (data).alternatives;
  if (!Array.isArray(alternatives) || alternatives.length !== 3) {
    return { ok: false, error: "alternatives must have exactly 3 entries" };
  }

  for (let i = 0; i < alternatives.length; i++) {
    const alt = alternatives[i];
    if (!alt || typeof alt !== "object") return { ok: false, error: `alternative ${i} invalid` };
    const a = /** @type {Record<string, unknown>} */ (alt);
    if (!isNonEmptyString(a.title) || !isNonEmptyString(a.tagline)) return { ok: false, error: `alternative ${i} title/tagline` };
    if (!Array.isArray(a.fitRationale) || a.fitRationale.length === 0 || !a.fitRationale.every(isNonEmptyString)) {
      return { ok: false, error: `alternative ${i} fitRationale` };
    }
    if (!Array.isArray(a.prepOrGaps) || !a.prepOrGaps.every(isNonEmptyString)) {
      return { ok: false, error: `alternative ${i} prepOrGaps` };
    }
    if (!isNonEmptyString(a.differsFromBaseline)) return { ok: false, error: `alternative ${i} differsFromBaseline` };
    const axes = a.comparisonAxes;
    if (!axes || typeof axes !== "object") return { ok: false, error: `alternative ${i} comparisonAxes` };
    const ax = /** @type {Record<string, unknown>} */ (axes);
    const lc = ax.learningCurve;
    if (lc !== "lower" && lc !== "similar" && lc !== "higher") return { ok: false, error: `alternative ${i} learningCurve` };
    if (!isNonEmptyString(ax.hireAccessibilityEarlyCareer) || !isNonEmptyString(ax.mobility)) {
      return { ok: false, error: `alternative ${i} comparisonAxes strings` };
    }
  }

  const globalDisclaimer = /** @type {Record<string, unknown>} */ (data).globalDisclaimer;
  if (!isNonEmptyString(globalDisclaimer)) return { ok: false, error: "globalDisclaimer required" };

  return { ok: true, payload: data };
}

function stripJsonFence(raw) {
  return raw.replace(/```json\s*|```/gi, "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const gate = await requirePlan(req, res, "student_paths");
  if (!gate.ok) return;

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return res.status(503).json({ error: "Career paths unavailable (missing AI configuration)." });
  }

  const assessment = req.body?.assessment;
  if (!assessment || typeof assessment !== "object") {
    return res.status(400).json({ error: "Body must include an assessment object." });
  }

  const schemaHint = `Return ONLY one JSON object (no markdown) with this shape:
{
  "baselineEcho": {
    "title": string,
    "summary": string,
    "signalsUsed": string[]
  },
  "alternatives": [
    {
      "title": string,
      "tagline": string,
      "fitRationale": string[],
      "prepOrGaps": string[],
      "differsFromBaseline": string,
      "comparisonAxes": {
        "learningCurve": "lower"|"similar"|"higher",
        "hireAccessibilityEarlyCareer": string,
        "mobility": string
      }
    }
  ],
  "globalDisclaimer": string,
  "confidenceNote": string
}
Provide exactly 3 alternatives. Each fitRationale bullet must explicitly tie to fields from the student's assessment (quote themes, do not invent achievements they did not mention).`;

  const userPayload = JSON.stringify({ assessment }, null, 2);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2200,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You help university students explore adjacent career arcs grounded ONLY in what they wrote. " +
              "Stay lateral—paths should plausibly fit their stated skills and projects, not unrelated fantasy careers. " +
              "Be honest about gaps and prep. Never fabricate internships, employers, or grades they did not provide. " +
              "If inputs are sparse, say so in confidenceNote and keep alternatives cautious.\n\n" +
              schemaHint,
          },
          {
            role: "user",
            content:
              "Student assessment (respond with JSON only):\n\n" +
              userPayload,
          },
        ],
      }),
    });

    const groqJson = await response.json();
    if (!response.ok || groqJson.error) {
      const msg = groqJson.error?.message || groqJson.message || `Groq error (${response.status})`;
      console.error("student-career-paths Groq:", msg);
      return res.status(502).json({ error: msg });
    }

    const rawContent = groqJson.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== "string") {
      return res.status(502).json({ error: "Empty model response." });
    }

    let parsed;
    try {
      parsed = JSON.parse(stripJsonFence(rawContent));
    } catch (e) {
      console.error("student-career-paths JSON parse:", e?.message);
      return res.status(502).json({ error: "Could not parse career paths response." });
    }

    const validated = validateCareerPathsPayload(parsed);
    if (!validated.ok || !validated.payload) {
      console.error("student-career-paths validation:", validated.error);
      return res.status(502).json({ error: validated.error || "Invalid structured response." });
    }

    return res.status(200).json(validated.payload);
  } catch (err) {
    console.error("student-career-paths:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
