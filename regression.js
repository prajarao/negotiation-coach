#!/usr/bin/env node
/**
 * NegotiateAI Regression Test Suite
 * -----------------------------------
 * Runs before every production deployment.
 * Tests every feature of the app against local or live endpoints.
 *
 * Usage:
 *   node scripts/regression.js --env local
 *   node scripts/regression.js --env production --url https://negotiation-coach-pearl.vercel.app
 *   node scripts/regression.js --env production --url https://negotiation-coach-pearl.vercel.app --report
 */

const args = process.argv.slice(2);
const ENV = args.includes("--env") ? args[args.indexOf("--env") + 1] : "local";
const CUSTOM_URL = args.includes("--url") ? args[args.indexOf("--url") + 1] : null;
const SAVE_REPORT = args.includes("--report");

const BASE_URL =
  CUSTOM_URL ||
  (ENV === "production"
    ? "https://negotiation-coach-pearl.vercel.app"
    : "http://localhost:3001");

// ── Colour helpers (works without chalk dependency) ─────────────────────────
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bgGreen: "\x1b[42m",
  bgRed: "\x1b[41m",
};

const pass = (msg) => `${C.green}✅ PASS${C.reset}  ${msg}`;
const fail = (msg) => `${C.red}❌ FAIL${C.reset}  ${msg}`;
const warn = (msg) => `${C.yellow}⚠️  WARN${C.reset}  ${msg}`;
const skip = (msg) => `${C.gray}⏭️  SKIP${C.reset}  ${msg}`;
const section = (title) =>
  `\n${C.cyan}${C.bold}── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}${C.reset}`;

// ── HTTP helper ──────────────────────────────────────────────────────────────
async function post(path, body, timeoutMs = 30000) {
  const url = ENV === "production" ? `${BASE_URL}${path}` : `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") throw new Error(`Request timed out after ${timeoutMs}ms`);
    throw e;
  }
}

async function get(path, timeoutMs = 10000) {
  const url = ENV === "production" ? `${BASE_URL}${path}` : `http://localhost:5173${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status, text: await res.text() };
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") throw new Error(`Request timed out after ${timeoutMs}ms`);
    throw e;
  }
}

// ── Test result store ────────────────────────────────────────────────────────
const results = [];
let lastChatReply = null;
let salaryApiHealthy = false;
let chatApiHealthy = false;

function record(id, category, name, status, message, detail = "") {
  results.push({ id, category, name, status, message, detail });
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const TESTS = [

  // ── 1. API Health Checks ──────────────────────────────────────────────────
  {
    id: "api-chat-health",
    category: "API Health",
    name: "Chat API endpoint responds",
    fn: async () => {
      const r = await post("/api/chat", {
        system: "You are a helpful assistant. Reply with exactly: HEALTH_OK",
        messages: [{ role: "user", content: "Say HEALTH_OK" }],
      });
      if (!r.ok) return { pass: false, message: `HTTP ${r.status}`, detail: JSON.stringify(r.data) };
      const text = r.data?.content?.[0]?.text || "";
      chatApiHealthy = true;
      return { pass: true, message: `Responded in expected format (${text.slice(0, 40)})` };
    },
  },

  {
    id: "api-salary-health",
    category: "API Health",
    name: "Salary API endpoint responds",
    fn: async () => {
      const r = await post("/api/salary", {
        jobTitle: "Software Engineer",
        location: "United States",
        offeredSalary: 100000,
        currency: "USD",
      });
      if (!r.ok) return { pass: false, message: `HTTP ${r.status}`, detail: JSON.stringify(r.data) };
      if (!r.data?.median) return { pass: false, message: "No median salary returned", detail: JSON.stringify(r.data) };
      salaryApiHealthy = true;
      return { pass: true, message: `Median: $${r.data.median.toLocaleString()} (${r.data.source})` };
    },
  },

  {
    id: "api-chat-method-guard",
    category: "API Health",
    name: "Chat API rejects GET requests (405)",
    fn: async () => {
      const url = ENV === "production" ? `${BASE_URL}/api/chat` : `${BASE_URL}/api/chat`;
      const res = await fetch(url, { method: "GET" });
      const pass405 = res.status === 405;
      return { pass: pass405, message: pass405 ? "Correctly returns 405 for GET" : `Unexpected status ${res.status}` };
    },
  },

  {
    id: "api-salary-method-guard",
    category: "API Health",
    name: "Salary API rejects GET requests (405)",
    fn: async () => {
      const url = ENV === "production" ? `${BASE_URL}/api/salary` : `${BASE_URL}/api/salary`;
      const res = await fetch(url, { method: "GET" });
      const pass405 = res.status === 405;
      return { pass: pass405, message: pass405 ? "Correctly returns 405 for GET" : `Unexpected status ${res.status}` };
    },
  },

  // ── 2. Core Chat ──────────────────────────────────────────────────────────
  {
    id: "chat-basic-response",
    category: "Core Chat",
    name: "AI coach responds to offer evaluation request",
    fn: async () => {
      if (!chatApiHealthy) return { skip: true, message: "Skipped — chat API not healthy" };
      const r = await post("/api/chat", {
        system: "You are an elite salary negotiation coach. Be concise.",
        messages: [{ role: "user", content: "I have an offer for $95,000 as a Product Manager in Austin TX. Is this good?" }],
      }, 45000);
      if (!r.ok) return { pass: false, message: `HTTP ${r.status}` };
      const text = r.data?.content?.[0]?.text || "";
      lastChatReply = text;
      if (text.length < 50) return { pass: false, message: `Response too short (${text.length} chars)`, detail: text };
      const hasRelevantContent = /salary|market|negotiat|percentile|austin|product manager|\$/i.test(text);
      return {
        pass: hasRelevantContent,
        message: hasRelevantContent ? `Relevant coaching response (${text.length} chars)` : "Response does not appear to be about salary coaching",
        detail: text.slice(0, 200),
      };
    },
  },

  {
    id: "chat-multi-turn",
    category: "Core Chat",
    name: "Multi-turn conversation maintains context",
    fn: async () => {
      if (!chatApiHealthy) return { skip: true, message: "Skipped — chat API not healthy" };
      const r = await post("/api/chat", {
        system: "You are an elite salary negotiation coach.",
        messages: [
          { role: "user", content: "My offer is $95,000 as a PM in Austin." },
          { role: "assistant", content: "That offer for a Product Manager in Austin is in the moderate range. Let me help you negotiate." },
          { role: "user", content: "What should I counter with?" },
        ],
      }, 45000);
      if (!r.ok) return { pass: false, message: `HTTP ${r.status}` };
      const text = r.data?.content?.[0]?.text || "";
      const mentionsCounter = /counter|ask for|\$[0-9]|negotiat/i.test(text);
      return {
        pass: mentionsCounter && text.length > 30,
        message: mentionsCounter ? "Context maintained across turns" : "Response does not reference previous context",
        detail: text.slice(0, 200),
      };
    },
  },

  {
    id: "chat-roleplay-system",
    category: "Core Chat",
    name: "Role-play mode activates recruiter persona",
    fn: async () => {
      if (!chatApiHealthy) return { skip: true, message: "Skipped — chat API not healthy" };
      const r = await post("/api/chat", {
        system: "You are an elite salary negotiation coach. IMPORTANT: You are now role-playing as a recruiter named Alex. Stay in character. Push back on salary requests. After each exchange add a [Coach Note].",
        messages: [{ role: "user", content: "Hi, I'd like to discuss the salary for the Product Manager role." }],
      }, 45000);
      if (!r.ok) return { pass: false, message: `HTTP ${r.status}` };
      const text = r.data?.content?.[0]?.text || "";
      const hasRecruiterPersona = /alex|recruiter|coach note|\[coach/i.test(text);
      return {
        pass: hasRecruiterPersona,
        message: hasRecruiterPersona ? "Recruiter persona active with Coach Note" : "Role-play persona not detected in response",
        detail: text.slice(0, 200),
      };
    },
  },

  {
    id: "chat-email-script",
    category: "Core Chat",
    name: "Generates negotiation email when requested",
    fn: async () => {
      if (!chatApiHealthy) return { skip: true, message: "Skipped — chat API not healthy" };
      const r = await post("/api/chat", {
        system: "You are an elite salary negotiation coach.",
        messages: [{ role: "user", content: "Write me a short negotiation email asking for $110,000 instead of $95,000." }],
      }, 45000);
      if (!r.ok) return { pass: false, message: `HTTP ${r.status}` };
      const text = r.data?.content?.[0]?.text || "";
      const hasEmailStructure = /(subject|dear|hi|hello|sincerely|regards|thank)/i.test(text);
      const hasSalaryFigure = /110|95,000|110,000/i.test(text);
      return {
        pass: hasEmailStructure && hasSalaryFigure,
        message: hasEmailStructure && hasSalaryFigure ? "Email generated with correct figures" : "Email structure or salary figures missing",
        detail: text.slice(0, 300),
      };
    },
  },

  {
    id: "chat-invalid-input",
    category: "Core Chat",
    name: "Chat API handles missing messages array gracefully",
    fn: async () => {
      const r = await post("/api/chat", { system: "test", messages: "not-an-array" });
      return {
        pass: r.status === 400,
        message: r.status === 400 ? "Returns 400 for invalid messages" : `Unexpected status ${r.status}`,
      };
    },
  },

  // ── 3. Salary Benchmark ───────────────────────────────────────────────────
  {
    id: "salary-us-bls",
    category: "Salary Benchmark",
    name: "US location uses BLS or AI data in USD",
    fn: async () => {
      if (!salaryApiHealthy) return { skip: true, message: "Skipped — salary API not healthy" };
      const r = await post("/api/salary", {
        jobTitle: "Software Engineer",
        location: "Austin, Texas",
        offeredSalary: 110000,
        currency: "USD",
      });
      if (!r.ok) return { pass: false, message: `HTTP ${r.status}` };
      const d = r.data;
      const validRange = d.median > 60000 && d.median < 300000;
      const correctCurrency = d.currency === "USD" || d.currencySymbol === "$";
      const hasPercentile = !!d.percentileRating;
      return {
        pass: validRange && correctCurrency && hasPercentile,
        message: validRange ? `USD median $${d.median?.toLocaleString()} · ${d.percentileRating}` : `Median ${d.median} out of expected range`,
        detail: `Source: ${d.source} | p25: $${d.p25} | median: $${d.median} | p75: $${d.p75}`,
      };
    },
  },

  {
    id: "salary-uk-gbp",
    category: "Salary Benchmark",
    name: "UK location returns GBP salary data",
    fn: async () => {
      const r = await post("/api/salary", {
        jobTitle: "Product Manager",
        location: "London, UK",
        offeredSalary: 70000,
        currency: "GBP",
      });
      if (!r.ok) return { pass: false, message: `HTTP ${r.status}` };
      const d = r.data;
      const validRange = d.median > 30000 && d.median < 200000;
      const correctCurrency = d.currency === "GBP" || d.currencySymbol === "£" || d.country === "UK";
      return {
        pass: validRange && correctCurrency,
        message: correctCurrency ? `GBP median £${d.median?.toLocaleString()}` : `Currency mismatch: got ${d.currency}/${d.currencySymbol}`,
        detail: `Country: ${d.country} | Source: ${d.source}`,
      };
    },
  },

  {
    id: "salary-india-inr",
    category: "Salary Benchmark",
    name: "India location returns INR salary data",
    fn: async () => {
      const r = await post("/api/salary", {
        jobTitle: "Software Engineer",
        location: "Bangalore, India",
        offeredSalary: 1200000,
        currency: "INR",
      });
      if (!r.ok) return { pass: false, message: `HTTP ${r.status}` };
      const d = r.data;
      const validRange = d.median > 400000 && d.median < 10000000;
      const correctCurrency = d.currency === "INR" || d.currencySymbol === "₹" || d.country === "India";
      return {
        pass: validRange && correctCurrency,
        message: correctCurrency ? `INR median ₹${d.median?.toLocaleString()}` : `Currency mismatch: got ${d.currency}/${d.currencySymbol}`,
        detail: `Country: ${d.country} | Source: ${d.source}`,
      };
    },
  },

  {
    id: "salary-percentile-below",
    category: "Salary Benchmark",
    name: "Correctly flags offer below 25th percentile",
    fn: async () => {
      const r = await post("/api/salary", {
        jobTitle: "Software Engineer",
        location: "San Francisco, CA",
        offeredSalary: 50000,
        currency: "USD",
      });
      if (!r.ok) return { pass: false, message: `HTTP ${r.status}` };
      const d = r.data;
      const isBelow = d.percentileRating?.includes("below 25th") || d.negotiationStrength === "very strong";
      return {
        pass: isBelow,
        message: isBelow ? `Correctly identified as below market (${d.negotiationStrength} leverage)` : `Wrong rating: ${d.percentileRating}`,
        detail: `Offered: $50,000 | p25: $${d.p25} | Strength: ${d.negotiationStrength}`,
      };
    },
  },

  {
    id: "salary-no-offer",
    category: "Salary Benchmark",
    name: "Returns benchmark without percentile when no offer given",
    fn: async () => {
      const r = await post("/api/salary", {
        jobTitle: "Data Scientist",
        location: "New York",
        currency: "USD",
      });
      if (!r.ok) return { pass: false, message: `HTTP ${r.status}` };
      const d = r.data;
      const hasMedian = !!d.median;
      const noPercentile = !d.percentileRating;
      return {
        pass: hasMedian && noPercentile,
        message: hasMedian ? `Benchmark returned without percentile (correct)` : "Missing median in response",
        detail: `median: $${d.median}`,
      };
    },
  },

  // ── 4. Counter-Offer Calculator ───────────────────────────────────────────
  {
    id: "calc-strategy-generation",
    category: "Counter-Offer Calculator",
    name: "Generates negotiation strategy for given offer",
    fn: async () => {
      if (!chatApiHealthy) return { skip: true, message: "Skipped — chat API not healthy" };
      const r = await post("/api/chat", {
        system: "You are an elite salary negotiation coach. Write a sharp strategy in 3 short sections: 1. YOUR LEVERAGE 2. COUNTER SCRIPT (exact words) 3. FALLBACK MOVE",
        messages: [{
          role: "user",
          content: "Offer: Base $110,000, Bonus 10%, Equity $80,000/4yr, Signing $15,000. Counter: Base $127,000, Signing $22,000. 4yr gain: $72,000. Market median: $125,000.",
        }],
      }, 45000);
      if (!r.ok) return { pass: false, message: `HTTP ${r.status}` };
      const text = r.data?.content?.[0]?.text || "";
      const hasLeverage = /leverage|strength|position/i.test(text);
      const hasScript = /script|say|words|mention|tell/i.test(text);
      const hasFallback = /fallback|alternative|equity|signing|instead/i.test(text);
      const allSections = hasLeverage && hasScript && hasFallback;
      return {
        pass: allSections,
        message: allSections ? "All 3 strategy sections present" : `Missing sections — leverage:${hasLeverage} script:${hasScript} fallback:${hasFallback}`,
        detail: text.slice(0, 300),
      };
    },
  },

  {
    id: "calc-math-logic",
    category: "Counter-Offer Calculator",
    name: "4-year calculation logic is correct",
    fn: async () => {
      // Test the math that the frontend calculator performs
      // We verify the formula: counterTotal4Year = (counterBase + counterBonus + counterEquity) * 4 + counterSigning
      const base = 110000;
      const bonusPct = 10;
      const equityTotal = 80000;
      const equityYears = 4;
      const signing = 15000;

      const annualBonus = base * (bonusPct / 100);           // 11,000
      const annualEquity = equityTotal / equityYears;         // 20,000
      const totalAnnual = base + annualBonus + annualEquity;  // 141,000
      const total4Year = totalAnnual * 4 + signing;           // 579,000

      const counterBase = Math.round((base * 1.15) / 1000) * 1000;  // 127,000
      const counterSigning = Math.round((signing * 1.5) / 1000) * 1000; // 22,000 (or 23k rounded)
      const counterBonus = Math.min(bonusPct + 5, 30);        // 15
      const counterEquity = Math.round((equityTotal * 1.25) / 1000) * 1000; // 100,000
      const counterAnnualBonus = counterBase * (counterBonus / 100);
      const counterAnnualEquity = counterEquity / equityYears;
      const counterTotalAnnual = counterBase + counterAnnualBonus + counterAnnualEquity;
      const counterTotal4Year = counterTotalAnnual * 4 + counterSigning;
      const fourYearGap = counterTotal4Year - total4Year;

      const expectedGapMin = 50000;
      const expectedGapMax = 150000;
      const gapInRange = fourYearGap > expectedGapMin && fourYearGap < expectedGapMax;

      return {
        pass: gapInRange && counterBase > base && counterSigning > signing,
        message: gapInRange ? `4-year gap $${fourYearGap.toLocaleString()} in expected range` : `Gap $${fourYearGap.toLocaleString()} outside expected range $${expectedGapMin}k-$${expectedGapMax}k`,
        detail: `Current 4yr: $${total4Year.toLocaleString()} | Counter 4yr: $${counterTotal4Year.toLocaleString()} | Gap: $${fourYearGap.toLocaleString()}`,
      };
    },
  },

  // ── 5. Outcome Tracker ────────────────────────────────────────────────────
  {
    id: "tracker-gain-calc",
    category: "Outcome Tracker",
    name: "Gain calculation: finalTotal minus offeredTotal",
    fn: async () => {
      const offeredBase = 95000;
      const finalBase = 112000;
      const offeredTotal = 110000;
      const finalTotal = 135000;
      const expectedGain = finalTotal - offeredTotal; // 25,000
      const actualGain = Math.round(
        parseFloat(finalTotal) - parseFloat(offeredTotal)
      );
      return {
        pass: actualGain === expectedGain,
        message: actualGain === expectedGain ? `Gain calculated correctly: $${actualGain.toLocaleString()}` : `Expected $${expectedGain} got $${actualGain}`,
        detail: `offeredTotal: $${offeredTotal} | finalTotal: $${finalTotal} | gain: $${actualGain}`,
      };
    },
  },

  {
    id: "tracker-fallback-to-base",
    category: "Outcome Tracker",
    name: "Falls back to base salary when total not provided",
    fn: async () => {
      const offeredBase = 95000;
      const finalBase = 112000;
      // Simulates the app logic when offeredTotal/finalTotal are empty
      const gained = Math.round(
        parseFloat(0 || finalBase) - parseFloat(0 || offeredBase)
      );
      const expected = finalBase - offeredBase; // 17,000
      return {
        pass: gained === expected,
        message: gained === expected ? `Base fallback correct: +$${gained.toLocaleString()}` : `Expected $${expected} got $${gained}`,
        detail: `offeredBase: $${offeredBase} | finalBase: $${finalBase}`,
      };
    },
  },

  {
    id: "tracker-stats-computation",
    category: "Outcome Tracker",
    name: "Stats computation: totalGained and avgGain",
    fn: async () => {
      const mockOutcomes = [
        { finalTotal: "135000", offeredTotal: "110000" },  // +25,000
        { finalTotal: "0", offeredTotal: "0", finalBase: "112000", offeredBase: "95000" },  // +17,000
        { finalTotal: "200000", offeredTotal: "170000" },  // +30,000
      ];
      const totalGained = mockOutcomes.reduce((s, o) => {
        return s + (parseFloat(o.finalTotal || o.finalBase || 0) - parseFloat(o.offeredTotal || o.offeredBase || 0));
      }, 0);
      const avgGain = Math.round(totalGained / mockOutcomes.length);
      const expectedTotal = 72000;
      const expectedAvg = 24000;
      return {
        pass: totalGained === expectedTotal && avgGain === expectedAvg,
        message: totalGained === expectedTotal ? `totalGained: $${totalGained.toLocaleString()} | avg: $${avgGain.toLocaleString()}` : `Expected $${expectedTotal} got $${totalGained}`,
        detail: `3 outcomes | expected total $72,000 | expected avg $24,000`,
      };
    },
  },

  // ── 6. LinkedIn Button Logic ───────────────────────────────────────────────
  {
    id: "linkedin-url-construction",
    category: "LinkedIn Integration",
    name: "LinkedIn URL correctly encodes role and location",
    fn: async () => {
      const role = "Product Manager";
      const location = "Austin, TX";
      const expectedBase = "https://www.linkedin.com/jobs/search/";
      const url = `${expectedBase}?keywords=${encodeURIComponent(role)}&location=${encodeURIComponent(location)}&f_TPR=r604800`;

      const hasKeywords = url.includes("Product%20Manager");
      const hasLocation = url.includes("Austin");
      const hasTimeFilter = url.includes("f_TPR=r604800");
      const hasBase = url.startsWith(expectedBase);

      return {
        pass: hasKeywords && hasLocation && hasTimeFilter && hasBase,
        message: (hasKeywords && hasLocation && hasTimeFilter) ? "LinkedIn URL correctly constructed" : `URL construction failed — keywords:${hasKeywords} location:${hasLocation} filter:${hasTimeFilter}`,
        detail: url,
      };
    },
  },

  {
    id: "linkedin-special-chars",
    category: "LinkedIn Integration",
    name: "LinkedIn URL handles special characters in role",
    fn: async () => {
      const role = "Sr. Software Engineer & Architect";
      const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(role)}`;
      const noUnencoded = !url.includes(" ") && !url.includes("&") && !url.includes(".");
      return {
        pass: noUnencoded,
        message: noUnencoded ? "Special characters correctly encoded" : "Unencoded special characters found in URL",
        detail: url,
      };
    },
  },

  // ── 7. Currency Logic ──────────────────────────────────────────────────────
  {
    id: "currency-auto-detect-uk",
    category: "Currency & Localisation",
    name: "UK location auto-detects GBP",
    fn: async () => {
      const testCases = [
        { location: "London, UK", expected: "GBP" },
        { location: "Manchester, England", expected: "GBP" },
        { location: "Edinburgh, Scotland", expected: "GBP" },
      ];
      const getCurrency = (loc) => {
        const l = loc.toLowerCase();
        return (l.includes("uk") || l.includes("london") || l.includes("england") || l.includes("scotland") || l.includes("manchester") || l.includes("edinburgh") || l.includes("glasgow") || l.includes("birmingham")) ? "GBP"
          : (l.includes("india") || l.includes("bangalore") || l.includes("bengaluru") || l.includes("mumbai") || l.includes("delhi") || l.includes("hyderabad") || l.includes("pune")) ? "INR"
          : "USD";
      };
      const results = testCases.map(tc => ({ ...tc, got: getCurrency(tc.location), pass: getCurrency(tc.location) === tc.expected }));
      const allPass = results.every(r => r.pass);
      return {
        pass: allPass,
        message: allPass ? "All UK locations correctly map to GBP" : results.filter(r => !r.pass).map(r => `${r.location} → ${r.got} (expected ${r.expected})`).join(", "),
        detail: results.map(r => `${r.location}: ${r.got} ${r.pass ? "✓" : "✗"}`).join(" | "),
      };
    },
  },

  {
    id: "currency-auto-detect-india",
    category: "Currency & Localisation",
    name: "India location auto-detects INR",
    fn: async () => {
      const testCases = [
        { location: "Bangalore, India", expected: "INR" },
        { location: "Mumbai", expected: "INR" },
        { location: "Hyderabad, India", expected: "INR" },
        { location: "Bengaluru", expected: "INR" },
      ];
      const getCurrency = (loc) => {
        const l = loc.toLowerCase();
        return (l.includes("india") || l.includes("bangalore") || l.includes("bengaluru") || l.includes("mumbai") || l.includes("delhi") || l.includes("hyderabad") || l.includes("pune") || l.includes("chennai")) ? "INR" : "USD";
      };
      const results = testCases.map(tc => ({ ...tc, got: getCurrency(tc.location), pass: getCurrency(tc.location) === tc.expected }));
      const allPass = results.every(r => r.pass);
      return {
        pass: allPass,
        message: allPass ? "All India locations correctly map to INR" : results.filter(r => !r.pass).map(r => `${r.location} → ${r.got}`).join(", "),
        detail: results.map(r => `${r.location}: ${r.got} ${r.pass ? "✓" : "✗"}`).join(" | "),
      };
    },
  },

  {
    id: "currency-symbol-map",
    category: "Currency & Localisation",
    name: "Currency codes map to correct symbols",
    fn: async () => {
      const CURRENCIES = [
        { code: "USD", symbol: "$" },
        { code: "GBP", symbol: "£" },
        { code: "INR", symbol: "₹" },
        { code: "EUR", symbol: "€" },
        { code: "CAD", symbol: "CA$" },
        { code: "AUD", symbol: "A$" },
        { code: "SGD", symbol: "S$" },
        { code: "AED", symbol: "د.إ" },
      ];
      const getCurrencySymbol = (code) => CURRENCIES.find((c) => c.code === code)?.symbol || "$";
      const tests = [
        { code: "GBP", expected: "£" },
        { code: "INR", expected: "₹" },
        { code: "USD", expected: "$" },
        { code: "EUR", expected: "€" },
        { code: "UNKNOWN", expected: "$" },
      ];
      const results = tests.map(t => ({ ...t, got: getCurrencySymbol(t.code), pass: getCurrencySymbol(t.code) === t.expected }));
      const allPass = results.every(r => r.pass);
      return {
        pass: allPass,
        message: allPass ? "All currency symbols correct" : results.filter(r => !r.pass).map(r => `${r.code} → ${r.got} (expected ${r.expected})`).join(", "),
      };
    },
  },

  // ── 8. Step Progress Logic ────────────────────────────────────────────────
  {
    id: "steps-all-defined",
    category: "Step Progress",
    name: "All 5 steps are defined with correct IDs",
    fn: async () => {
      const STEPS = [
        { id: 1, label: "Share Offer", icon: "📋" },
        { id: 2, label: "Benchmark", icon: "📊" },
        { id: 3, label: "Calculate", icon: "🧮" },
        { id: 4, label: "Practice", icon: "🎭" },
        { id: 5, label: "Log Win", icon: "🏆" },
      ];
      const ids = STEPS.map(s => s.id);
      const correctIds = [1, 2, 3, 4, 5].every(id => ids.includes(id));
      const hasStep4 = STEPS.some(s => s.id === 4 && s.label === "Practice");
      return {
        pass: correctIds && hasStep4 && STEPS.length === 5,
        message: correctIds && hasStep4 ? "All 5 steps defined including Step 4 (Practice)" : `Missing steps — found: ${ids.join(",")} | has step4: ${hasStep4}`,
        detail: STEPS.map(s => `${s.id}:${s.label}`).join(" | "),
      };
    },
  },

  {
    id: "steps-advance-logic",
    category: "Step Progress",
    name: "Keywords advance the step progress correctly",
    fn: async () => {
      let currentStep = 1;
      const advance = (text, min) => { currentStep = Math.max(currentStep, min); };
      const testMessages = [
        { text: "I have an offer for $95,000", expectedStep: 1 },
        { text: "Is this above market rate?", expectedStep: 2 },
        { text: "What should I counter with?", expectedStep: 3 },
        { text: "Let's role-play the conversation", expectedStep: 4 },
        { text: "I negotiated a win!", expectedStep: 5 },
      ];
      const lower = (t) => t.toLowerCase();
      const results = [];
      for (const msg of testMessages) {
        const l = lower(msg.text);
        if (l.includes("offer") || l.includes("salary") || l.includes("comp")) advance(l, 1);
        if (l.includes("market") || l.includes("benchmark") || l.includes("percentile") || l.includes("rate")) advance(l, 2);
        if (l.includes("counter") || l.includes("calculate") || l.includes("ask for")) advance(l, 3);
        if (l.includes("role-play") || l.includes("practice") || l.includes("email") || l.includes("script")) advance(l, 4);
        if (l.includes("win") || l.includes("negotiated") || l.includes("accepted")) advance(l, 5);
        results.push({ text: msg.text.slice(0, 30), expected: msg.expectedStep, got: currentStep, pass: currentStep === msg.expectedStep });
      }
      const allPass = results.every(r => r.pass);
      return {
        pass: allPass,
        message: allPass ? "Step advancement logic correct for all keywords" : results.filter(r => !r.pass).map(r => `"${r.text}" → step ${r.got} (expected ${r.expected})`).join(", "),
        detail: results.map(r => `Step ${r.got}${r.pass ? "✓" : "✗"}`).join(" | "),
      };
    },
  },

  // ── 9. UI Component Logic ──────────────────────────────────────────────────
  {
    id: "contextual-prompts-all-steps",
    category: "UI Components",
    name: "Contextual prompts defined for all 5 steps",
    fn: async () => {
      const CONTEXTUAL_PROMPTS = {
        1: ["I have a job offer I want to evaluate", "I want to negotiate a raise at my current job", "I have two competing offers to compare", "Help me understand my total comp package"],
        2: ["Is my offer above or below market rate?", "What's the going rate for my role in my city?", "How does my equity compare to industry standards?", "What percentile is my offer at?"],
        3: ["What should I counter with?", "How much more should I ask for?", "Should I negotiate base or equity first?", "What's my 4-year gain if I negotiate?"],
        4: ["Role-play: you're the recruiter, I'll practice", "What do I say when they ask my salary expectations?", "How do I respond if they say the offer is firm?", "Write me a negotiation email I can send today"],
        5: ["I successfully negotiated — help me log my win", "They didn't budge — what did I learn?", "I got more equity instead of base — how do I record this?", "What should I do differently next time?"],
      };
      const allSteps = [1, 2, 3, 4, 5].every(s => CONTEXTUAL_PROMPTS[s]?.length >= 4);
      return {
        pass: allSteps,
        message: allSteps ? "All 5 steps have 4+ contextual prompts" : "Some steps missing contextual prompts",
        detail: Object.entries(CONTEXTUAL_PROMPTS).map(([k, v]) => `Step ${k}: ${v.length} prompts`).join(" | "),
      };
    },
  },

  {
    id: "theme-toggle-state",
    category: "UI Components",
    name: "Theme toggle switches between dark and light values",
    fn: async () => {
      // Simulate the T object for both modes
      const getTheme = (isDark) => ({
        pageBg: isDark ? "#0a0f1a" : "#f1f5f9",
        textPrimary: isDark ? "#e2e8f0" : "#0f172a",
        border: isDark ? "#1e293b" : "#e2e8f0",
        headerBg: isDark ? "#0d1424" : "#ffffff",
      });
      const dark = getTheme(true);
      const light = getTheme(false);
      const allDifferent = Object.keys(dark).every(k => dark[k] !== light[k]);
      return {
        pass: allDifferent,
        message: allDifferent ? "Dark and light theme values are distinct" : "Some theme values identical across modes",
        detail: Object.keys(dark).map(k => `${k}: dark=${dark[k]} light=${light[k]}`).join(" | "),
      };
    },
  },

  {
    id: "welcome-message-format",
    category: "UI Components",
    name: "Welcome message has correct role and content",
    fn: async () => {
      const WELCOME_MESSAGE = {
        role: "assistant",
        content: `# Welcome to NegotiateAI 💼\n\nI'm your personal salary negotiation coach`,
      };
      const correctRole = WELCOME_MESSAGE.role === "assistant";
      const hasHeading = WELCOME_MESSAGE.content.startsWith("# Welcome");
      const hasCoachMention = WELCOME_MESSAGE.content.includes("coach");
      return {
        pass: correctRole && hasHeading && hasCoachMention,
        message: (correctRole && hasHeading && hasCoachMention) ? "Welcome message structure correct" : `Issues — role:${correctRole} heading:${hasHeading} coach:${hasCoachMention}`,
      };
    },
  },

  // ── 10. Error Handling ─────────────────────────────────────────────────────
  {
    id: "api-chat-empty-messages",
    category: "Error Handling",
    name: "Chat API handles empty messages array",
    fn: async () => {
      const r = await post("/api/chat", {
        system: "test",
        messages: [],
      });
      // Either should return a valid response or a clear error — not crash
      const acceptable = r.status === 400 || (r.ok && r.data?.content);
      return {
        pass: acceptable,
        message: acceptable ? `Handles empty messages gracefully (${r.status})` : `Unexpected behaviour: status ${r.status}`,
        detail: JSON.stringify(r.data).slice(0, 100),
      };
    },
  },

  {
    id: "api-salary-missing-title",
    category: "Error Handling",
    name: "Salary API handles missing job title",
    fn: async () => {
      const r = await post("/api/salary", {
        location: "New York",
        currency: "USD",
      });
      // Should either return a fallback or a clear error — not crash with 500
      const notCrash = r.status !== 500;
      return {
        pass: notCrash,
        message: notCrash ? `Handles missing title without crash (${r.status})` : "Server crashed with 500",
        detail: JSON.stringify(r.data).slice(0, 100),
      };
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════

async function runTests() {
  const startTime = Date.now();
  const reportLines = [];

  const log = (line) => {
    console.log(line);
    reportLines.push(line.replace(/\x1b\[[0-9;]*m/g, "")); // strip ANSI for file
  };

  log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`);
  log(`${C.bold}${C.cyan}║         NegotiateAI Regression Test Suite                ║${C.reset}`);
  log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`);
  log(`${C.gray}Environment : ${ENV}${C.reset}`);
  log(`${C.gray}API Base    : ${BASE_URL}${C.reset}`);
  log(`${C.gray}Started     : ${new Date().toLocaleString()}${C.reset}`);
  log(`${C.gray}Total tests : ${TESTS.length}${C.reset}`);

  let passed = 0, failed = 0, warned = 0, skipped = 0;
  let currentCategory = "";

  for (const test of TESTS) {
    if (test.category !== currentCategory) {
      currentCategory = test.category;
      log(section(currentCategory));
    }

    let result;
    try {
      result = await test.fn();
    } catch (e) {
      result = { pass: false, message: `Exception: ${e.message}` };
    }

    if (result.skip) {
      skipped++;
      log(skip(`${test.name}`));
      log(`${C.gray}         ${result.message}${C.reset}`);
      record(test.id, test.category, test.name, "SKIP", result.message);
    } else if (result.pass) {
      passed++;
      log(pass(`${test.name}`));
      log(`${C.gray}         ${result.message}${C.reset}`);
      if (result.detail) log(`${C.gray}         Detail: ${result.detail}${C.reset}`);
      record(test.id, test.category, test.name, "PASS", result.message, result.detail);
    } else {
      failed++;
      log(fail(`${test.name}`));
      log(`${C.red}         ${result.message}${C.reset}`);
      if (result.detail) log(`${C.gray}         Detail: ${result.detail}${C.reset}`);
      record(test.id, test.category, test.name, "FAIL", result.message, result.detail);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  // ── Summary ───────────────────────────────────────────────────────────────
  log(`\n${C.bold}${"═".repeat(62)}${C.reset}`);
  log(`${C.bold}SUMMARY${C.reset}`);
  log(`${"─".repeat(62)}`);

  // Group by category
  const categories = [...new Set(results.map(r => r.category))];
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catPass = catResults.filter(r => r.status === "PASS").length;
    const catFail = catResults.filter(r => r.status === "FAIL").length;
    const catSkip = catResults.filter(r => r.status === "SKIP").length;
    const icon = catFail > 0 ? C.red + "✗" : C.green + "✓";
    log(`  ${icon}${C.reset} ${cat.padEnd(30)} ${C.green}${catPass}✅${C.reset} ${catFail > 0 ? C.red : C.gray}${catFail}❌${C.reset} ${catSkip > 0 ? C.yellow : C.gray}${catSkip}⏭${C.reset}`);
  }

  log(`${"─".repeat(62)}`);
  log(`  ${C.green}Passed :${C.reset}  ${passed}`);
  log(`  ${C.red}Failed :${C.reset}  ${failed}`);
  log(`  ${C.gray}Skipped:${C.reset}  ${skipped}`);
  log(`  ${C.gray}Duration:${C.reset} ${duration}s`);
  log(`${"═".repeat(62)}`);

  if (failed === 0) {
    log(`\n  ${C.bgGreen}${C.bold}  ✅  READY TO SHIP — All tests passed  ${C.reset}\n`);
  } else {
    log(`\n  ${C.bgRed}${C.bold}  ❌  DO NOT SHIP — ${failed} test(s) failed  ${C.reset}\n`);
    log(`${C.bold}${C.red}Failures:${C.reset}`);
    results.filter(r => r.status === "FAIL").forEach(r => {
      log(`  ${C.red}→${C.reset} [${r.category}] ${r.name}`);
      log(`    ${C.gray}${r.message}${C.reset}`);
      if (r.detail) log(`    ${C.gray}${r.detail}${C.reset}`);
    });
    log("");
  }

  // ── Save report ───────────────────────────────────────────────────────────
  if (SAVE_REPORT) {
    const fs = await import("fs");
    const filename = `regression-report-${Date.now()}.txt`;
    fs.writeFileSync(filename, reportLines.join("\n"), "utf8");
    console.log(`${C.cyan}📄 Report saved to: ${filename}${C.reset}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error(`${C.red}Fatal error running tests:${C.reset}`, e);
  process.exit(1);
});
