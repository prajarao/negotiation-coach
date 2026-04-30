import express from "express";
import cors from "cors";
import alexTokenHandler from "./api/alex-token.js";
import studentVerificationStatusHandler from "./api/student-verification-status.js";
import studentVerifyUniversityHandler from "./api/student-verify-university.js";
import studentCareerPathsHandler from "./api/student-career-paths.js";
import {
  normalizeCareerStage,
  normalizeExperienceYears,
  shouldAdjustOccupationWidePercentiles,
  shouldAugmentSalaryPrompts,
  buildCohortPromptSegment,
  buildFallbackEntryLevelSystemAugmentation,
  groqAdjustBlsToEntryPercentiles,
} from "./api/_salary-cohort.js";

// `.env` is loaded in `api/_supabase.js` (imported before this file runs; `dotenv.config({ quiet: true })`).

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ElevenLabs ConvAI token (PRO) — mirrors `api/alex-token.js` for local dev
app.get("/api/alex-token", (req, res) => alexTokenHandler(req, res));
app.post("/api/alex-token", (req, res) => alexTokenHandler(req, res));

app.get("/api/student-verification-status", (req, res) => studentVerificationStatusHandler(req, res));
app.post("/api/student-verify-university", (req, res) => studentVerifyUniversityHandler(req, res));
app.post("/api/student-career-paths", (req, res) => studentCareerPathsHandler(req, res));

// ─── existing chat route ──────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, system } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages must be an array" });
    }
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 1000,
          temperature: 0.7,
          messages: [{ role: "system", content: system }, ...messages],
        }),
      }
    );
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    const replyText = data.choices?.[0]?.message?.content ||
      "Could not generate a response. Please try again.";
    res.json({ content: [{ text: replyText }] });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── UK location detection ───────────────────────────────────
function detectUK(location) {
  const ukTerms = [
    "uk", "united kingdom", "england", "scotland", "wales",
    "northern ireland", "london", "manchester", "birmingham",
    "edinburgh", "glasgow", "bristol", "leeds", "liverpool",
    "sheffield", "cambridge", "oxford", "cardiff", "belfast",
    "nottingham", "newcastle", "brighton", "southampton",
    "leicester", "coventry", "aberdeen", "dundee", "swansea",
    "exeter", "york", "bath", "reading", "milton keynes",
    "great britain", "gb",
  ];
  const lower = location.toLowerCase();
  return ukTerms.some((term) => lower.includes(term));
}

// ─── salary benchmark route ─────────────────────────────────
app.post("/api/salary", async (req, res) => {
  try {
    const { jobTitle, location, offeredSalary } = req.body;
    const careerStage = normalizeCareerStage(req.body?.careerStage);
    const experienceYears = normalizeExperienceYears(req.body?.experienceYears);
    const augmentPrompts = shouldAugmentSalaryPrompts(careerStage, experienceYears);
    const cohortSegment =
      careerStage || experienceYears != null ? buildCohortPromptSegment(careerStage, experienceYears) : "";
    const fallbackAugment = buildFallbackEntryLevelSystemAugmentation(careerStage, experienceYears);
    const groqKey = process.env.GROQ_API_KEY;

    const loc = (location || "").trim();
    const isUK = detectUK(loc);

    console.log(`📊 Salary lookup: "${jobTitle}" in "${loc}" [${isUK ? "UK" : "US"}]`);

    if (isUK) {
      // ── UK: ONS ASHE via Nomis API ──

      // Step 1 — Map to UK SOC 2020
      const mappingResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            max_tokens: 200,
            temperature: 0,
            messages: [
              {
                role: "system",
                content: `You are a UK job classification expert. Map job titles to
                UK SOC 2020 occupation codes (4-digit). Return ONLY a JSON object,
                nothing else. No markdown, no backticks.
                Format: {"code": "2134", "title": "Programmers and software development professionals",
                "confidence": "high"}`,
              },
              {
                role: "user",
                content: `Map this job title to its closest UK SOC 2020 occupation
                code: "${jobTitle}". Return only the JSON object.`,
              },
            ],
          }),
        }
      );

      const mappingData = await mappingResponse.json();
      let socCode = "2134";
      let occupationTitle = "Programmers and software development professionals";

      try {
        const raw = mappingData.choices[0].message.content.trim();
        const mapped = JSON.parse(raw.replace(/```json|```/g, "").trim());
        socCode = mapped.code;
        occupationTitle = mapped.title;
        console.log(`✅ Mapped to UK SOC: ${socCode} (${occupationTitle})`);
      } catch (e) {
        console.log("⚠️ Could not parse UK SOC mapping, using default");
      }

      // Step 2 — Fetch UK-wide baseline from Nomis ASHE
      let asheBaseline = { p25: null, median: null, p75: null };

      try {
        const nomisUrl =
          "https://www.nomisweb.co.uk/api/v01/dataset/NM_99_1.data.json" +
          "?geography=2092957697&sex=8&pay=7&item=2,8,13&measures=20100" +
          "&time=latest&select=item_name,obs_value";

        const nomisResponse = await fetch(nomisUrl);
        const nomisData = await nomisResponse.json();

        if (nomisData.obs && nomisData.obs.length > 0) {
          for (const obs of nomisData.obs) {
            const itemName = obs.item_name || obs.item?.description || "";
            const value = obs.obs_value?.value ?? obs.obs_value;
            if (value == null) continue;
            const numVal = parseFloat(value);
            if (isNaN(numVal)) continue;

            if (itemName.includes("25")) asheBaseline.p25 = Math.round(numVal);
            else if (itemName.includes("Median") || itemName.includes("median"))
              asheBaseline.median = Math.round(numVal);
            else if (itemName.includes("75")) asheBaseline.p75 = Math.round(numVal);
          }
        }
        console.log("✅ ASHE baseline:", asheBaseline);
      } catch (e) {
        console.log("⚠️ Nomis ASHE fetch failed:", e.message);
      }

      // Step 3 — AI occupation-specific estimates using ASHE baseline
      let salaryData = {
        occupation: occupationTitle,
        ukSocCode: socCode,
        p25: null,
        median: null,
        p75: null,
        source: "ONS ASHE via Nomis API + AI occupation estimate",
        year: new Date().getFullYear().toString(),
        currency: "GBP",
        country: "UK",
        careerStage,
        experienceYears,
      };

      let estimateKindUk = "ai_estimate";
      let benchmarkDisclaimerUk = null;

      const baselineContext = asheBaseline.median
        ? `The latest ONS ASHE data shows UK full-time workers earn: 25th=£${asheBaseline.p25?.toLocaleString()}, Median=£${asheBaseline.median?.toLocaleString()}, 75th=£${asheBaseline.p75?.toLocaleString()} annually.`
        : "";

      try {
        const occResponse = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              max_tokens: 300,
              temperature: 0,
              messages: [
                {
                  role: "system",
                  content: `You are a UK compensation data expert with deep knowledge
                  of UK salary markets. ${baselineContext}
                  Use this baseline to calibrate your estimates for specific occupations.
                  Return ONLY a JSON object, no other text, no markdown, no backticks.
                  Format: {"p25": 35000, "median": 45000, "p75": 60000,
                  "note": "Brief note about the estimate"}${fallbackAugment}`,
                },
                {
                  role: "user",
                  content: `Provide realistic UK salary percentiles (25th, 50th, 75th)
                  in GBP for: "${jobTitle}" (UK SOC: ${socCode} - ${occupationTitle})
                  in "${loc}". Consider the specific location's cost of living
                  within the UK.${cohortSegment ? `\n\n${cohortSegment}` : ""}
                  Return only the JSON.`,
                },
              ],
            }),
          }
        );

        const occData = await occResponse.json();
        const parsed = JSON.parse(
          occData.choices[0].message.content.trim().replace(/```json|```/g, "").trim()
        );
        salaryData.p25 = parsed.p25;
        salaryData.median = parsed.median;
        salaryData.p75 = parsed.p75;
        if (parsed.note) salaryData.note = parsed.note;
        estimateKindUk = augmentPrompts ? "ai_estimate_entry" : "ai_estimate";
        if (augmentPrompts) {
          benchmarkDisclaimerUk =
            "AI estimates target your cohort (internship / entry-level / early-career), not typical mid-career occupation medians.";
        }

        if (asheBaseline.median) {
          salaryData.asheBaseline = asheBaseline;
          salaryData.source = "ONS ASHE via Nomis API + AI occupation estimate";
        } else {
          salaryData.source = "AI-estimated UK market data (ASHE unavailable)";
        }
        console.log("✅ UK salary data ready:", salaryData);
      } catch (e) {
        console.log("⚠️ UK occupation estimate failed");
        if (asheBaseline.median) {
          salaryData.p25 = asheBaseline.p25;
          salaryData.median = asheBaseline.median;
          salaryData.p75 = asheBaseline.p75;
          salaryData.source = "ONS ASHE via Nomis API (UK-wide, all occupations)";
        }
      }

      // Step 4 — Percentile rating
      let percentileRating = null;
      let negotiationStrength = null;

      if (offeredSalary && salaryData.median) {
        const offered = parseFloat(offeredSalary);
        if (offered < salaryData.p25) {
          percentileRating = "below 25th percentile";
          negotiationStrength = "very strong";
        } else if (offered < salaryData.median) {
          percentileRating = "between 25th and 50th percentile";
          negotiationStrength = "strong";
        } else if (offered < salaryData.p75) {
          percentileRating = "between 50th and 75th percentile";
          negotiationStrength = "moderate";
        } else {
          percentileRating = "above 75th percentile";
          negotiationStrength = "limited — already above market";
        }
      }

      res.json({
        ...salaryData,
        offeredSalary: offeredSalary ? parseFloat(offeredSalary) : null,
        percentileRating,
        negotiationStrength,
        location: loc,
        estimateKind: estimateKindUk,
        ...(benchmarkDisclaimerUk ? { benchmarkDisclaimer: benchmarkDisclaimerUk } : {}),
      });

    } else {
      // ── US: BLS data (existing flow) ──

      // Step 1 — Map to BLS SOC
      const mappingResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            max_tokens: 200,
            temperature: 0,
            messages: [
              {
                role: "system",
                content: `You are a job classification expert. Map job titles to
                BLS OES occupation codes. Return ONLY a JSON object, nothing else.
                Format: {"code": "15-1252", "title": "Software Developers",
                "confidence": "high"}`,
              },
              {
                role: "user",
                content:
                  `Map this job title to its closest BLS OES occupation code: "${jobTitle}". Return only the JSON.` +
                  (augmentPrompts && cohortSegment ? ` Additional mapping hint: ${cohortSegment}` : ""),
              },
            ],
          }),
        }
      );

      const mappingData = await mappingResponse.json();
      let occupationCode = "15-1252";
      let occupationTitle = "Software Developers";

      try {
        const mapped = JSON.parse(
          mappingData.choices[0].message.content.trim().replace(/```json|```/g, "").trim()
        );
        occupationCode = mapped.code;
        occupationTitle = mapped.title;
        console.log(`✅ Mapped to BLS code: ${occupationCode} (${occupationTitle})`);
      } catch (e) {
        console.log("⚠️ Could not parse occupation mapping, using default");
      }

      // Step 2 — Fetch BLS data
      const socClean = occupationCode.replace("-", "");
      const seriesIds = [
        `OEUS0000000${socClean}04`,
        `OEUS0000000${socClean}03`,
        `OEUS0000000${socClean}08`,
      ];

      let salaryData = {
        occupation: occupationTitle,
        blsCode: occupationCode,
        p25: null,
        median: null,
        p75: null,
        source: "BLS Occupational Employment & Wage Statistics",
        year: "2024",
        currency: "USD",
        country: "US",
        careerStage,
        experienceYears,
      };

      let estimateKindUs = "occupation_wide_bls";
      let benchmarkDisclaimerUs = null;
      let occupationWidePercentilesUs = null;

      try {
        const blsResponse = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seriesid: seriesIds,
            startyear: "2023",
            endyear: "2024",
          }),
        });
        const blsData = await blsResponse.json();

        if (blsData?.Results?.series) {
          for (const series of blsData.Results.series) {
            const value = series.data?.[0]?.value;
            if (!value || value === "-") continue;
            const annual = parseFloat(value) * (parseFloat(value) < 500 ? 2080 : 1);
            const id = series.seriesID;
            if (id.endsWith("04")) salaryData.p25 = Math.round(annual);
            if (id.endsWith("03")) salaryData.median = Math.round(annual);
            if (id.endsWith("08")) salaryData.p75 = Math.round(annual);
          }
        }

        const blsHasMedian = salaryData.median != null;
        const wantsAdjustment = blsHasMedian && shouldAdjustOccupationWidePercentiles(careerStage, experienceYears);

        if (wantsAdjustment && groqKey) {
          occupationWidePercentilesUs = {
            p25: salaryData.p25,
            median: salaryData.median,
            p75: salaryData.p75,
          };

          const adj = await groqAdjustBlsToEntryPercentiles({
            groqApiKey: groqKey,
            jobTitle,
            location: loc || "United States",
            careerStage,
            experienceYears,
            p25: salaryData.p25,
            median: salaryData.median,
            p75: salaryData.p75,
          });

          if (adj.ok) {
            salaryData.p25 = adj.p25;
            salaryData.median = adj.median;
            salaryData.p75 = adj.p75;
            estimateKindUs = "entry_level_adjusted";
            benchmarkDisclaimerUs =
              (adj.adjustmentSummary ? `${adj.adjustmentSummary} ` : "") +
              "Figures aim to reflect internships / entry-level hiring rather than occupation-wide mixed-experience medians.";
          } else {
            estimateKindUs = "occupation_wide_bls";
            benchmarkDisclaimerUs =
              "BLS publishes occupation-wide wages (all experience levels). Typical internships and first-job offers often fall below the occupation median — interpret these bands as an upper-context market range, not a new-grad target.";
          }
        } else if (wantsAdjustment && !groqKey && blsHasMedian) {
          estimateKindUs = "occupation_wide_bls";
          benchmarkDisclaimerUs =
            "BLS publishes occupation-wide wages (all experience levels). Typical internships and first-job offers often fall below the occupation median — interpret these bands as directional context.";
        } else if (blsHasMedian && augmentPrompts && !wantsAdjustment) {
          benchmarkDisclaimerUs =
            "Published benchmarks are occupation-wide (multiple experience levels). Early-career offers vary — use this as directional context.";
          estimateKindUs = "occupation_wide_bls";
        }

        console.log("✅ BLS data fetched");
      } catch (e) {
        console.log("⚠️ BLS fetch failed:", e.message);
      }

      // Step 3 — AI fallback
      if (!salaryData.median) {
        console.log("⚠️ BLS returned no data, using AI-estimated ranges");
        try {
          const fallbackResponse = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
              },
              body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                max_tokens: 300,
                temperature: 0,
                messages: [
                  {
                    role: "system",
                    content: `You are a compensation data expert. Return ONLY
                    a JSON object, no other text, no markdown, no backticks.
                    Format: {"p25": 85000, "median": 105000, "p75": 130000,
                    "note": "Based on market data"}${fallbackAugment}`,
                  },
                  {
                    role: "user",
                    content: `Provide realistic 2024-2025 US salary percentiles
                    for: "${jobTitle}" in "${loc || "United States"}".
                    ${cohortSegment ? `\n\nCohort context:\n${cohortSegment}` : ""}
                    Return only the JSON.`,
                  },
                ],
              }),
            }
          );
          const fallbackData = await fallbackResponse.json();
          const fb = JSON.parse(
            fallbackData.choices[0].message.content.trim().replace(/```json|```/g, "").trim()
          );
          salaryData.p25 = fb.p25;
          salaryData.median = fb.median;
          salaryData.p75 = fb.p75;
          salaryData.source = "AI-estimated market data (BLS unavailable)";
          {
            const entryCue = augmentPrompts || shouldAdjustOccupationWidePercentiles(careerStage, experienceYears);
            estimateKindUs = entryCue ? "ai_estimate_entry" : "ai_estimate";
            if (!benchmarkDisclaimerUs && entryCue) {
              benchmarkDisclaimerUs =
                "AI estimates target your cohort (internship / entry-level / early-career), not typical mid-career occupation medians.";
            }
          }
        } catch (e) {
          console.log("⚠️ Fallback also failed");
        }
      }

      // Step 4 — Percentile rating
      let percentileRating = null;
      let negotiationStrength = null;

      if (offeredSalary && salaryData.median) {
        const offered = parseFloat(offeredSalary);
        if (offered < salaryData.p25) {
          percentileRating = "below 25th percentile";
          negotiationStrength = "very strong";
        } else if (offered < salaryData.median) {
          percentileRating = "between 25th and 50th percentile";
          negotiationStrength = "strong";
        } else if (offered < salaryData.p75) {
          percentileRating = "between 50th and 75th percentile";
          negotiationStrength = "moderate";
        } else {
          percentileRating = "above 75th percentile";
          negotiationStrength = "limited — already above market";
        }
      }

      console.log("✅ Salary data ready:", salaryData);

      res.json({
        ...salaryData,
        offeredSalary: offeredSalary ? parseFloat(offeredSalary) : null,
        percentileRating,
        negotiationStrength,
        location: loc,
        estimateKind: estimateKindUs,
        ...(benchmarkDisclaimerUs ? { benchmarkDisclaimer: benchmarkDisclaimerUs } : {}),
        ...(occupationWidePercentilesUs ? { occupationWidePercentiles: occupationWidePercentilesUs } : {}),
      });
    }
  } catch (error) {
    console.error("❌ Salary lookup error:", error);
    res.status(500).json({ error: "Could not fetch salary data" });
  }
});

app.listen(3001, () => {
  console.log("✅ Server running at http://localhost:3001");
  console.log("🤖 Groq AI + BLS salary data ready");
});