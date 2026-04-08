module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { jobTitle, location, offeredSalary } = req.body;
    const loc = (location || "").trim();

    console.log(`Salary lookup: "${jobTitle}" in "${loc}"`);

    const isUK = detectUK(loc);

    if (isUK) {
      return await handleUK(req, res, jobTitle, loc, offeredSalary);
    } else {
      return await handleUS(req, res, jobTitle, loc, offeredSalary);
    }
  } catch (error) {
    console.error("Salary error:", error);
    return res.status(500).json({ error: "Could not fetch salary data" });
  }
};

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

async function callGroq(messages) {
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
        max_tokens: 300,
        temperature: 0,
        messages,
      }),
    }
  );
  return response.json();
}

function parseAIJson(text) {
  const cleaned = text.trim().replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

// ─── UK: ONS ASHE via Nomis API ──────────────────────────────

async function handleUK(req, res, jobTitle, location, offeredSalary) {
  // Step 1 — Map job title to UK SOC 2020 code
  const mappingData = await callGroq([
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
  ]);

  let socCode = "2134";
  let occupationTitle = "Programmers and software development professionals";

  try {
    const mapped = parseAIJson(mappingData.choices[0].message.content);
    socCode = mapped.code;
    occupationTitle = mapped.title;
  } catch (e) {
    console.log("Could not parse UK SOC mapping, using default");
  }

  // Step 2 — Fetch UK-wide baseline from Nomis ASHE
  // NM_99_1 = ASHE workplace analysis
  // geography=2092957697 = United Kingdom
  // sex=8 = Full Time Workers
  // pay=7 = Annual pay - gross
  // item=2,8,13 = Median, 25th percentile, 75th percentile
  // measures=20100 = Value
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
    console.log("ASHE baseline:", asheBaseline);
  } catch (e) {
    console.log("Nomis ASHE fetch failed:", e.message);
  }

  // Step 3 — Get occupation-specific estimates via AI, using ASHE baseline as context
  let salaryData = {
    occupation: occupationTitle,
    ukSocCode: socCode,
    p25: null,
    median: null,
    p75: null,
    source: "ONS ASHE via Nomis API + AI occupation estimate",
    year: new Date().getFullYear().toString(),
    currency: "GBP",
  };

  const baselineContext = asheBaseline.median
    ? `The latest ONS ASHE data shows UK full-time workers earn: 25th=£${asheBaseline.p25?.toLocaleString()}, Median=£${asheBaseline.median?.toLocaleString()}, 75th=£${asheBaseline.p75?.toLocaleString()} annually.`
    : "";

  try {
    const occData = await callGroq([
      {
        role: "system",
        content: `You are a UK compensation data expert with deep knowledge
        of UK salary markets. ${baselineContext}
        Use this baseline to calibrate your estimates for specific occupations.
        Return ONLY a JSON object, no other text, no markdown, no backticks.
        Format: {"p25": 35000, "median": 45000, "p75": 60000,
        "note": "Brief note about the estimate"}`,
      },
      {
        role: "user",
        content: `Provide realistic UK salary percentiles (25th, 50th, 75th)
        in GBP for: "${jobTitle}" (UK SOC: ${socCode} - ${occupationTitle})
        in "${location}". Consider the specific location's cost of living
        within the UK. Return only the JSON.`,
      },
    ]);

    const parsed = parseAIJson(occData.choices[0].message.content);
    salaryData.p25 = parsed.p25;
    salaryData.median = parsed.median;
    salaryData.p75 = parsed.p75;
    if (parsed.note) salaryData.note = parsed.note;

    if (asheBaseline.median) {
      salaryData.asheBaseline = asheBaseline;
      salaryData.source = "ONS ASHE via Nomis API + AI occupation estimate";
    } else {
      salaryData.source = "AI-estimated UK market data (ASHE unavailable)";
    }
  } catch (e) {
    console.log("UK occupation estimate failed:", e.message);
    // Fall back to ASHE baseline if available
    if (asheBaseline.median) {
      salaryData.p25 = asheBaseline.p25;
      salaryData.median = asheBaseline.median;
      salaryData.p75 = asheBaseline.p75;
      salaryData.source = "ONS ASHE via Nomis API (UK-wide, all occupations)";
    }
  }

  // Step 4 — Calculate percentile rating
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

  return res.status(200).json({
    ...salaryData,
    offeredSalary: offeredSalary ? parseFloat(offeredSalary) : null,
    percentileRating,
    negotiationStrength,
    location,
  });
}

// ─── US: BLS data (existing flow) ────────────────────────────

async function handleUS(req, res, jobTitle, location, offeredSalary) {
  // Step 1 — Map job title to BLS SOC code
  const mappingData = await callGroq([
    {
      role: "system",
      content: `You are a job classification expert. Map job titles
      to BLS OES occupation codes. Return ONLY a JSON object,
      nothing else. No markdown, no backticks.
      Format: {"code": "15-1252", "title": "Software Developers",
      "confidence": "high"}`,
    },
    {
      role: "user",
      content: `Map this job title to its closest BLS OES occupation
      code: "${jobTitle}". Return only the JSON object.`,
    },
  ]);

  let occupationCode = "15-1252";
  let occupationTitle = "Software Developers";

  try {
    const mapped = parseAIJson(mappingData.choices[0].message.content);
    occupationCode = mapped.code;
    occupationTitle = mapped.title;
  } catch (e) {
    console.log("Could not parse occupation mapping, using default");
  }

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
        const annual =
          parseFloat(value) * (parseFloat(value) < 500 ? 2080 : 1);
        const id = series.seriesID;
        if (id.endsWith("04")) salaryData.p25 = Math.round(annual);
        if (id.endsWith("03")) salaryData.median = Math.round(annual);
        if (id.endsWith("08")) salaryData.p75 = Math.round(annual);
      }
    }
  } catch (e) {
    console.log("BLS fetch failed:", e.message);
  }

  if (!salaryData.median) {
    try {
      const fallbackData = await callGroq([
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
          for: "${jobTitle}" in "${location || "United States"}".
          Return only the JSON.`,
        },
      ]);

      const fb = parseAIJson(fallbackData.choices[0].message.content);
      salaryData.p25 = fb.p25;
      salaryData.median = fb.median;
      salaryData.p75 = fb.p75;
      salaryData.source = "AI-estimated market data";
    } catch (e) {
      console.log("Fallback parsing failed");
    }
  }

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

  return res.status(200).json({
    ...salaryData,
    offeredSalary: offeredSalary ? parseFloat(offeredSalary) : null,
    percentileRating,
    negotiationStrength,
    location,
  });
}
