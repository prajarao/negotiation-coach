/**
 * Career cohort parsing and prompt fragments for /api/salary (students / entry-level).
 */

const ALLOWED_STAGES = ["intern", "new_grad", "early_career"];

/**
 * @param {unknown} raw
 * @returns {'intern'|'new_grad'|'early_career'|null}
 */
export function normalizeCareerStage(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  return ALLOWED_STAGES.includes(s) ? /** @type {'intern'|'new_grad'|'early_career'} */ (s) : null;
}

/**
 * @param {unknown} raw
 * @returns {number|null}
 */
export function normalizeExperienceYears(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.round(n), 60);
}

/**
 * Strong entry signal: internships, first jobs, or ≤1 YOE — used to reframe BLS occupation-wide bands.
 */
export function shouldAdjustOccupationWidePercentiles(careerStage, experienceYears) {
  if (careerStage === "intern" || careerStage === "new_grad") return true;
  if (experienceYears != null && experienceYears <= 1) return true;
  return false;
}

/**
 * Broader cohort hint for SOC mapping + AI fallback (includes early career).
 */
export function shouldAugmentSalaryPrompts(careerStage, experienceYears) {
  if (careerStage === "intern" || careerStage === "new_grad" || careerStage === "early_career") return true;
  if (experienceYears != null && experienceYears <= 3) return true;
  return false;
}

/**
 * Human-readable segment for Groq user prompts (SOC mapping, AI fallback).
 */
export function buildCohortPromptSegment(careerStage, experienceYears) {
  const parts = [];
  if (careerStage === "intern") {
    parts.push(
      "Hiring context: internship or intern-equivalent (often hourly or stipend; annualize cautiously when comparing to full-time salary bands)."
    );
  } else if (careerStage === "new_grad") {
    parts.push(
      "Hiring context: new graduate / first full-time role (campus recruiting, entry-level band — not mid-career or executive compensation)."
    );
  } else if (careerStage === "early_career") {
    parts.push(
      "Hiring context: early-career professional (roughly a few years of experience — still below typical mid-career pay for the occupation)."
    );
  }
  if (experienceYears != null) {
    parts.push(`Approximate years of relevant experience: ${experienceYears}.`);
  }
  return parts.length ? parts.join(" ") : "";
}

/**
 * Extra system-level constraints for AI salary fallback when cohort is entry-oriented.
 */
export function buildFallbackEntryLevelSystemAugmentation(careerStage, experienceYears) {
  const adj = shouldAdjustOccupationWidePercentiles(careerStage, experienceYears);
  if (!adj && !shouldAugmentSalaryPrompts(careerStage, experienceYears)) return "";

  let lines =
    "\nIMPORTANT: Estimate percentiles for THIS cohort only — not typical mid-career or occupation-wide mixed-experience medians.\n";
  if (careerStage === "intern") {
    lines +=
      "- Prefer internship/new-graduate hiring benchmarks; avoid executive or principal-level bands.\n" +
      "- If the role is hourly or stipend-only, you may annualize for comparison but mention that briefly in \"note\".\n";
  } else {
    lines +=
      "- Anchor on entry-level / campus / 0–2 YOE hiring where relevant; avoid principal or executive bands.\n";
  }
  if (experienceYears != null && experienceYears <= 1) {
    lines += "- Strongly bias toward zero-to-one-year compensation norms for this role and location.\n";
  }
  return lines;
}

/**
 * Convert BLS occupation-wide USD percentiles toward entry-oriented benchmarks via Groq.
 * @returns {Promise<{ ok: true, p25: number, median: number, p75: number, adjustmentSummary: string } | { ok: false }>}
 */
export async function groqAdjustBlsToEntryPercentiles({
  groqApiKey,
  jobTitle,
  location,
  careerStage,
  experienceYears,
  p25,
  median,
  p75,
}) {
  if (!groqApiKey || median == null) return { ok: false };

  const cohortLine = buildCohortPromptSegment(careerStage, experienceYears);
  const userContent = `National occupation-wide annual wage percentiles (all experience levels), USD:
25th=${p25}, 50th (median)=${median}, 75th=${p75}.

Job title: "${jobTitle}"
Location / metro (free text): "${location}"

${cohortLine || "Hiring context: entry-level / student cohort."}

Return ONLY JSON with keys: p25, median, p75, adjustmentSummary (one short sentence explaining how these differ from occupation-wide figures).
Rules: p25 <= median <= p75; values must be plausible for THIS cohort (internship vs first job vs early career); do not inflate toward senior bands.`;

  try {
    const mappingResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 350,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You convert national occupation-wide wage statistics into realistic benchmarks for a specific hiring cohort (internships, new grads, or ≤1 YOE).
Return ONLY valid JSON, no markdown or code fences:
{"p25":number,"median":number,"p75":number,"adjustmentSummary":"string"}`,
          },
          { role: "user", content: userContent },
        ],
      }),
    });

    const data = await mappingResponse.json();
    const raw = data?.choices?.[0]?.message?.content?.trim();
    if (!raw) return { ok: false };

    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    const np25 = Math.round(Number(parsed.p25));
    const nmed = Math.round(Number(parsed.median));
    const np75 = Math.round(Number(parsed.p75));
    const adjustmentSummary =
      typeof parsed.adjustmentSummary === "string" ? parsed.adjustmentSummary.trim() : "";

    if (![np25, nmed, np75].every((n) => Number.isFinite(n))) return { ok: false };
    if (np25 > nmed || nmed > np75) return { ok: false };

    return {
      ok: true,
      p25: np25,
      median: nmed,
      p75: np75,
      adjustmentSummary,
    };
  } catch {
    return { ok: false };
  }
}
