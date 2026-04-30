/**
 * One-line explanation of how a salary benchmark was derived (POST /api/salary response).
 * Varies by detected region and methodology — align with api/salary.js + server.js.
 */

/**
 * @param {string | undefined} location
 * @returns {'US'|'UK'|'India'|null}
 */
export function inferSalaryCountryFromLocation(location) {
  const loc = (location || "").toLowerCase();
  const isUK =
    loc.includes("uk") ||
    loc.includes("united kingdom") ||
    loc.includes("england") ||
    loc.includes("london") ||
    loc.includes("manchester") ||
    loc.includes("birmingham") ||
    loc.includes("scotland") ||
    loc.includes("wales") ||
    loc.includes("edinburgh") ||
    loc.includes("glasgow") ||
    loc.includes("leeds") ||
    loc.includes("bristol");
  const isIndia =
    loc.includes("india") ||
    loc.includes("bangalore") ||
    loc.includes("bengaluru") ||
    loc.includes("mumbai") ||
    loc.includes("delhi") ||
    loc.includes("hyderabad") ||
    loc.includes("pune") ||
    loc.includes("chennai") ||
    loc.includes("kolkata") ||
    loc.includes("gurgaon") ||
    loc.includes("noida") ||
    loc.includes("ahmedabad");
  const isUS =
    !isUK &&
    !isIndia &&
    (loc.includes("us") ||
      loc.includes("usa") ||
      loc.includes("united states") ||
      loc.includes("america") ||
      loc.includes("new york") ||
      loc.includes("san francisco") ||
      loc.includes("chicago") ||
      loc.includes("austin") ||
      loc.includes("seattle") ||
      loc.includes("boston") ||
      loc.includes("dallas") ||
      loc.includes("denver") ||
      loc === "" ||
      loc === "united states");
  if (isUK) return "UK";
  if (isIndia) return "India";
  if (isUS) return "US";
  return null;
}

/**
 * @param {Record<string, unknown> | null | undefined} salaryPayload
 * @returns {string | null}
 */
export function salaryBenchmarkMethodologyLine(salaryPayload) {
  if (!salaryPayload || salaryPayload.median == null) return null;

  const src = typeof salaryPayload.source === "string" ? salaryPayload.source : "";
  const ek = salaryPayload.estimateKind;
  const location = typeof salaryPayload.location === "string" ? salaryPayload.location : "";

  const entryAiTail =
    ek === "ai_estimate_entry"
      ? " Entry-oriented bands—not typical mid-career occupation medians."
      : "";

  let country =
    salaryPayload.country === "US" || salaryPayload.country === "UK" || salaryPayload.country === "India"
      ? salaryPayload.country
      : inferSalaryCountryFromLocation(location);

  if (!country && src.includes("BLS")) country = "US";
  if (!country && (src.includes("ONS") || src.includes("ASHE") || src.includes("Nomis"))) country = "UK";
  if (!country && (src.includes("Naukri") || src.includes("LPA"))) country = "India";

  if (country === "US") {
    if (ek === "entry_level_adjusted") {
      return (
        "US benchmark: national BLS Occupational Employment & Wage Statistics (occupation-wide), then modeled toward your cohort and role—not federal civil-service pay scales."
      );
    }
    if (ek === "occupation_wide_bls" || src.includes("BLS")) {
      return (
        "Figures come from BLS Occupational Employment & Wage Statistics—survey wages across private-sector and government establishments by occupation (not GS schedules alone)."
      );
    }
    return "US benchmark: AI-estimated percentiles from your role and location where published BLS series were unavailable—not employer payroll data." + entryAiTail;
  }

  if (country === "UK") {
    if (src.includes("Nomis") || src.includes("ONS ASHE via Nomis")) {
      return (
        "UK benchmark: starts from ONS Annual Survey of Hours and Earnings (ASHE) via Nomis, then occupation- and location-specific calibration—not HMRC tax bands alone." +
        entryAiTail
      );
    }
    return (
      "UK benchmark: AI-estimated GBP ranges anchored to ONS ASHE-style UK wage patterns for your occupation and location—not employer-reported salaries." +
      entryAiTail
    );
  }

  if (country === "India") {
    return (
      "India benchmark: AI-estimated annual CTC percentiles using metro tier and sector norms (market listings and reports)—not statutory minimum wage alone." +
      entryAiTail
    );
  }

  if (src) {
    return `Benchmark source: ${src}. Percentiles are model-assisted from your role and location—not a guarantee of what any employer will offer.${entryAiTail}`;
  }

  return `Benchmark percentiles are model-assisted from your role and location—not a guarantee of employer offers.${entryAiTail}`;
}
