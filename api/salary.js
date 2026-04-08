module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { jobTitle, location, offeredSalary, currency } = req.body;

    console.log(`Salary lookup: "${jobTitle}" in "${location}" (${currency})`);

    // ── Detect country from location string ──────────────────────────────
    const loc = (location || "").toLowerCase();

    const isUK = loc.includes("uk") || loc.includes("united kingdom") ||
      loc.includes("england") || loc.includes("london") ||
      loc.includes("manchester") || loc.includes("birmingham") ||
      loc.includes("scotland") || loc.includes("wales") ||
      loc.includes("edinburgh") || loc.includes("glasgow") ||
      loc.includes("leeds") || loc.includes("bristol");

    const isIndia = loc.includes("india") || loc.includes("bangalore") ||
      loc.includes("bengaluru") || loc.includes("mumbai") ||
      loc.includes("delhi") || loc.includes("hyderabad") ||
      loc.includes("pune") || loc.includes("chennai") ||
      loc.includes("kolkata") || loc.includes("gurgaon") ||
      loc.includes("noida") || loc.includes("ahmedabad");

    const isUS = !isUK && !isIndia && (
      loc.includes("us") || loc.includes("usa") ||
      loc.includes("united states") || loc.includes("america") ||
      loc.includes("new york") || loc.includes("san francisco") ||
      loc.includes("chicago") || loc.includes("austin") ||
      loc.includes("seattle") || loc.includes("boston") ||
      loc.includes("dallas") || loc.includes("denver") ||
      loc === "" || loc === "united states"
    );

    let salaryData = {
      occupation: jobTitle,
      p25: null, median: null, p75: null,
      source: "", year: "2025",
      currency: currency || (isUK ? "GBP" : isIndia ? "INR" : "USD"),
      currencySymbol: isUK ? "£" : isIndia ? "₹" : "$",
      country: isUK ? "UK" : isIndia ? "India" : "US",
    };

    // ── US path — BLS data ────────────────────────────────────────────────
    if (isUS) {
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
                to BLS OES occupation codes. Return ONLY a JSON object, 
                nothing else. No markdown, no backticks.
                Format: {"code": "15-1252", "title": "Software Developers"}`,
              },
              {
                role: "user",
                content: `Map this job title to its closest BLS OES 
                occupation code: "${jobTitle}". Return only the JSON.`,
              },
            ],
          }),
        }
      );

      const mappingData = await mappingResponse.json();
      let occupationCode = "15-1252";

      try {
        const raw = mappingData.choices[0].message.content.trim();
        const mapped = JSON.parse(raw.replace(/```json|```/g, "").trim());
        occupationCode = mapped.code;
        salaryData.occupation = mapped.title;
      } catch (e) {
        console.log("BLS mapping failed, using default");
      }

      try {
        const socClean = occupationCode.replace("-", "");
        const blsResponse = await fetch(
          "https://api.bls.gov/publicAPI/v2/timeseries/data/",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              seriesid: [
                `OEUS0000000${socClean}04`,
                `OEUS0000000${socClean}03`,
                `OEUS0000000${socClean}08`,
              ],
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
            const annual = parseFloat(value) *
              (parseFloat(value) < 500 ? 2080 : 1);
            const id = series.seriesID;
            if (id.endsWith("04")) salaryData.p25 = Math.round(annual);
            if (id.endsWith("03")) salaryData.median = Math.round(annual);
            if (id.endsWith("08")) salaryData.p75 = Math.round(annual);
          }
        }
        salaryData.source = "BLS Occupational Employment & Wage Statistics";
      } catch (e) {
        console.log("BLS fetch failed:", e.message);
      }
    }

    // ── UK path — ONS ASHE via AI (structured UK market knowledge) ────────
    if (isUK && !salaryData.median) {
      console.log("Using UK ONS ASHE AI model");
    }

    // ── AI fallback for all countries including India ─────────────────────
    if (!salaryData.median) {
      const countryContext = isIndia
        ? `India. Express salaries in INR (Indian Rupees) as annual CTC 
           (Cost to Company) in Lakhs Per Annum (LPA). 
           Consider city tier: metro cities like Bangalore, Mumbai, Delhi, 
           Hyderabad, Pune pay 20-40% more than tier 2 cities.
           Consider sector premiums: IT/tech pays highest, followed by BFSI, 
           then consulting, then other sectors.
           Express as annual figures in INR (e.g., p25: 800000 means 8 LPA).`
        : isUK
        ? `United Kingdom. Express salaries in GBP (British Pounds) annual 
           gross. Consider London premium (15-25% above national median). 
           Source: ONS ASHE 2024-2025 data. 
           UK median full-time salary is £37,430.`
        : `United States. Express salaries in USD annual gross.`;

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
            max_tokens: 400,
            temperature: 0,
            messages: [
              {
                role: "system",
                content: `You are a compensation data expert with deep 
                knowledge of global salary markets. Return ONLY a JSON object, 
                no other text, no markdown, no backticks.
                Format: {
                  "p25": 850000, 
                  "median": 1200000, 
                  "p75": 1800000, 
                  "occupation": "Software Engineer",
                  "note": "Based on market data"
                }`,
              },
              {
                role: "user",
                content: `Provide realistic 2024-2025 salary percentiles 
                (25th, 50th, 75th) for: "${jobTitle}" in "${location}".
                Country context: ${countryContext}
                Return only the JSON object with numeric salary values.`,
              },
            ],
          }),
        }
      );

      const fallbackData = await fallbackResponse.json();
      try {
        const raw = fallbackData.choices[0].message.content.trim();
        const fb = JSON.parse(raw.replace(/```json|```/g, "").trim());
        salaryData.p25 = Math.round(fb.p25);
        salaryData.median = Math.round(fb.median);
        salaryData.p75 = Math.round(fb.p75);
        if (fb.occupation) salaryData.occupation = fb.occupation;
        salaryData.note = fb.note;
        salaryData.source = isIndia
          ? "AI-estimated · Based on Naukri, LinkedIn, and industry reports"
          : isUK
          ? "AI-estimated · Based on ONS ASHE 2024-2025"
          : "AI-estimated market data";
      } catch (e) {
        console.log("AI fallback parsing failed:", e.message);
      }
    }

    // ── Percentile rating ─────────────────────────────────────────────────
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

  } catch (error) {
    console.error("Salary error:", error);
    return res.status(500).json({ error: "Could not fetch salary data" });
  }
};