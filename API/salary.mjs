export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { jobTitle, location, offeredSalary } = req.body;

    console.log(`📊 Salary lookup: "${jobTitle}" in "${location}"`);

    // Step 1 — Map job title to BLS occupation code via AI
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
              content: `You are a job classification expert. Map job titles 
              to BLS OES occupation codes. Return ONLY a JSON object, nothing 
              else. No markdown, no backticks.
              Format: {"code": "15-1252", "title": "Software Developers", 
              "confidence": "high"}`,
            },
            {
              role: "user",
              content: `Map this job title to its closest BLS OES occupation 
              code: "${jobTitle}". Return only the JSON object.`,
            },
          ],
        }),
      }
    );

    const mappingData = await mappingResponse.json();
    let occupationCode = "15-1252";
    let occupationTitle = "Software Developers";

    try {
      const raw = mappingData.choices[0].message.content.trim();
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const mapped = JSON.parse(cleaned);
      occupationCode = mapped.code;
      occupationTitle = mapped.title;
    } catch (e) {
      console.log("Could not parse occupation mapping, using default");
    }

    // Step 2 — Fetch BLS wage data (free government API)
    const socClean = occupationCode.replace("-", "");
    const seriesIds = [
      `OEUS0000000${socClean}04`, // 25th percentile
      `OEUS0000000${socClean}03`, // median
      `OEUS0000000${socClean}08`, // 75th percentile
    ];

    let salaryData = {
      occupation: occupationTitle,
      blsCode: occupationCode,
      p25: null,
      median: null,
      p75: null,
      source: "BLS Occupational Employment & Wage Statistics",
      year: "2024",
    };

    try {
      const blsResponse = await fetch(
        "https://api.bls.gov/publicAPI/v2/timeseries/data/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seriesid: seriesIds,
            startyear: "2023",
            endyear: "2024",
          }),
        }
      );
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
    } catch (e) {
      console.log("BLS fetch failed:", e.message);
    }

    // Step 3 — Fallback to AI estimates if BLS returns nothing
    if (!salaryData.median) {
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
                "note": "Based on market data"}`,
              },
              {
                role: "user",
                content: `Provide realistic 2024-2025 US salary percentiles 
                (25th, 50th, 75th) for: "${jobTitle}" in "${location}". 
                Consider location cost of living. Return only the JSON.`,
              },
            ],
          }),
        }
      );

      const fallbackData = await fallbackResponse.json();
      try {
        const raw = fallbackData.choices[0].message.content.trim();
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const fb = JSON.parse(cleaned);
        salaryData.p25 = fb.p25;
        salaryData.median = fb.median;
        salaryData.p75 = fb.p75;
        salaryData.source = "AI-estimated market data";
        salaryData.note = fb.note;
      } catch (e) {
        console.log("Fallback parsing failed");
      }
    }

    // Step 4 — Calculate percentile position of their offer
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

    res.status(200).json({
      ...salaryData,
      offeredSalary: offeredSalary ? parseFloat(offeredSalary) : null,
      percentileRating,
      negotiationStrength,
      location,
    });

  } catch (error) {
    console.error("Salary error:", error);
    res.status(500).json({ error: "Could not fetch salary data" });
  }
}