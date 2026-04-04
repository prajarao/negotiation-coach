import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

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

// ─── NEW: salary benchmark route ─────────────────────────────
app.post("/api/salary", async (req, res) => {
  try {
    const { jobTitle, location, offeredSalary } = req.body;

    console.log(`📊 Salary lookup: "${jobTitle}" in "${location}"`);

    // Step 1 — Ask AI to map job title to a BLS occupation code
    // BLS uses standard occupation codes (SOC) — we need the right one
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
              content: `Map this job title to its closest BLS OES occupation 
              code: "${jobTitle}". Return only the JSON.`,
            },
          ],
        }),
      }
    );

    const mappingData = await mappingResponse.json();
    let occupationCode = "15-1252"; // default: Software Developers
    let occupationTitle = "Software Developers";

    try {
      const mapped = JSON.parse(
        mappingData.choices[0].message.content.trim()
      );
      occupationCode = mapped.code;
      occupationTitle = mapped.title;
      console.log(`✅ Mapped to BLS code: ${occupationCode} (${occupationTitle})`);
    } catch (e) {
      console.log("⚠️ Could not parse occupation mapping, using default");
    }

    // Step 2 — Fetch real wage data from BLS (completely free)
    // Series format: OEUS000000[SOC code without hyphen]03 = median annual wage
    const socClean = occupationCode.replace("-", "");
    const seriesIds = [
      `OEUS0000000${socClean}01`, // employment
      `OEUS0000000${socClean}04`, // 25th percentile wage
      `OEUS0000000${socClean}03`, // median (50th) wage  
      `OEUS0000000${socClean}08`, // 75th percentile wage
    ];

    let blsData = null;
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
      blsData = await blsResponse.json();
      console.log("✅ BLS data fetched");
    } catch (e) {
      console.log("⚠️ BLS fetch failed:", e.message);
    }

    // Step 3 — Parse BLS response into clean salary figures
    let salaryData = {
      occupation: occupationTitle,
      blsCode: occupationCode,
      p25: null,
      median: null,
      p75: null,
      source: "BLS Occupational Employment & Wage Statistics",
      year: "2024",
    };

    if (blsData?.Results?.series) {
      for (const series of blsData.Results.series) {
        const value = series.data?.[0]?.value;
        if (!value || value === "-") continue;
        const annual = parseFloat(value) * (value < 500 ? 2080 : 1);
        // BLS sometimes returns hourly, multiply by 2080 for annual
        const id = series.seriesID;
        if (id.endsWith("04")) salaryData.p25 = Math.round(annual);
        if (id.endsWith("03")) salaryData.median = Math.round(annual);
        if (id.endsWith("08")) salaryData.p75 = Math.round(annual);
      }
    }

    // Step 4 — Use fallback curated data if BLS returns nothing
    // This ensures the feature always works even if BLS API is down
    if (!salaryData.median) {
      console.log("⚠️ BLS returned no data, using AI-estimated ranges");
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
                content: `You are a compensation data expert with deep knowledge 
                of US salary markets. Return ONLY a JSON object, no other text.
                Format: {"p25": 85000, "median": 105000, "p75": 130000, 
                "note": "Based on market data for this role"}`,
              },
              {
                role: "user",
                content: `Provide realistic 2024-2025 US salary percentiles 
                (25th, 50th, 75th) for: "${jobTitle}" in "${location}". 
                Consider the specific location's cost of living. 
                Return only the JSON.`,
              },
            ],
          }),
        }
      );
      const fallbackData = await fallbackResponse.json();
      try {
        const fb = JSON.parse(
          fallbackData.choices[0].message.content.trim()
        );
        salaryData.p25 = fb.p25;
        salaryData.median = fb.median;
        salaryData.p75 = fb.p75;
        salaryData.source = "AI-estimated market data (BLS unavailable)";
        salaryData.note = fb.note;
      } catch (e) {
        console.log("⚠️ Fallback also failed");
      }
    }

    // Step 5 — Calculate where their offer sits
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
      location,
    });

  } catch (error) {
    console.error("❌ Salary lookup error:", error);
    res.status(500).json({ error: "Could not fetch salary data" });
  }
});

app.listen(3001, () => {
  console.log("✅ Server running at http://localhost:3001");
  console.log("🤖 Groq AI + BLS salary data ready");
});