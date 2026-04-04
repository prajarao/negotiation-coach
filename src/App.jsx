import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are an elite salary and compensation negotiation coach with 15+ years of experience as a recruiter, HR director, and career strategist at top-tier companies (FAANG, Wall Street, consulting firms). You have helped thousands of professionals negotiate offers worth millions in additional lifetime earnings.

Your coaching philosophy:
- Every offer is negotiable. Always.
- Silence and patience are negotiation superpowers.
- Anchoring high is science, not rudeness.
- BATNA (Best Alternative To Negotiated Agreement) is your leverage.
- Recruiters expect negotiation — it signals confidence and self-awareness.

Your coaching style:
- Direct, confident, and strategic — not generic or wishy-washy
- Give SPECIFIC numbers, scripts, and counteroffers — never vague advice
- Use real negotiation frameworks: anchoring, bracketing, mirroring, BATNA
- Ask smart clarifying questions before giving advice
- Adapt to the user's industry, seniority, and situation
- Role-play as a recruiter when the user wants to practice
- Write ready-to-send negotiation emails and call scripts on request

When evaluating an offer, always consider:
- Base salary (vs. market rate for role/level/location)
- Equity (RSUs, options, vesting schedule, cliff)
- Signing bonus (one-time vs. recurring value)
- Annual bonus (target %, guaranteed vs. discretionary)
- Benefits (health, 401k match, PTO, remote flexibility)
- Growth trajectory and title

Always end your responses with a clear "Next Step" the user should take.

Format responses with clear sections when giving structured advice. Be conversational but precise. Never give generic advice like "do your research" without telling them exactly HOW.`;

const WELCOME_MESSAGE = {
  role: "assistant",
  content: `# Welcome to your AI Negotiation Coach 💼

I'm here to help you negotiate the compensation you deserve. I've coached professionals across tech, finance, consulting, and beyond — and I'll give you the same sharp, specific advice top executives pay thousands for.

**Here's what I can help you with:**
- 📊 **Evaluate your offer** — Is it fair? Where's the leverage?
- 🎯 **Build your strategy** — Anchoring, counteroffers, and timing
- 🎭 **Role-play the conversation** — Practice with me as the recruiter
- ✉️ **Write your negotiation email or script** — Copy-paste ready

**To get started, tell me:**
1. What role and company is the offer for?
2. What's the current offer (base, bonus, equity if any)?
3. What's your experience level and any competing offers?

*The more context you share, the sharper my coaching gets.*`,
};

const SUGGESTED_STARTERS = [
  "I have an offer I want to evaluate",
  "Help me write a negotiation email",
  "Role-play: you're the recruiter",
  "Is my offer below market rate?",
];

function MarkdownText({ text }) {
  const renderLine = (line, i) => {
    if (line.startsWith("# ")) return <h1 key={i} style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0.5rem 0 0.75rem", color: "#e2e8f0", fontFamily: "'Playfair Display', serif" }}>{line.slice(2)}</h1>;
    if (line.startsWith("## ")) return <h2 key={i} style={{ fontSize: "1.1rem", fontWeight: 600, margin: "1rem 0 0.4rem", color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase", fontSize: "0.8rem" }}>{line.slice(3)}</h2>;
    if (line.startsWith("### ")) return <h3 key={i} style={{ fontSize: "1rem", fontWeight: 600, margin: "0.75rem 0 0.3rem", color: "#cbd5e1" }}>{line.slice(4)}</h3>;
    if (line.startsWith("- ")) {
      const content = line.slice(2).replace(/\*\*(.*?)\*\*/g, (_, t) => `<strong style="color:#f1f5f9">${t}</strong>`).replace(/\*(.*?)\*/g, (_, t) => `<em>${t}</em>`);
      return <li key={i} style={{ margin: "0.3rem 0", color: "#94a3b8", listStyle: "none", paddingLeft: "1rem", borderLeft: "2px solid #334155" }} dangerouslySetInnerHTML={{ __html: content }} />;
    }
    if (line.match(/^\d+\./)) {
      const content = line.replace(/^\d+\.\s*/, "").replace(/\*\*(.*?)\*\*/g, (_, t) => `<strong style="color:#f1f5f9">${t}</strong>`);
      return <li key={i} style={{ margin: "0.3rem 0", color: "#94a3b8", marginLeft: "1.2rem" }} dangerouslySetInnerHTML={{ __html: content }} />;
    }
    if (line.trim() === "") return <br key={i} />;
    if (line.startsWith("**") && line.endsWith("**") && line.split("**").length === 3) {
      return <p key={i} style={{ margin: "0.5rem 0", color: "#e2e8f0", fontWeight: 600 }}>{line.slice(2, -2)}</p>;
    }
    const content = line.replace(/\*\*(.*?)\*\*/g, (_, t) => `<strong style="color:#f1f5f9">${t}</strong>`).replace(/\*(.*?)\*/g, (_, t) => `<em style="color:#7dd3fc">${t}</em>`).replace(/`(.*?)`/g, (_, t) => `<code style="background:#1e293b;padding:2px 6px;border-radius:4px;font-family:monospace;color:#7dd3fc;font-size:0.85em">${t}</code>`);
    return <p key={i} style={{ margin: "0.35rem 0", color: "#94a3b8", lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: content }} />;
  };

  return <div>{text.split("\n").map((line, i) => renderLine(line, i))}</div>;
}

export default function NegotiationCoach() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("coach"); // coach | roleplay
  const [salaryData, setSalaryData] = useState(null);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [showSalary, setShowSalary] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [jobLocation, setJobLocation] = useState("");
  const [offeredSalary, setOfferedSalary] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [counterResult, setCounterResult] = useState(null);
  const [offer, setOffer] = useState({
    base: "",
    bonus: "",
    equity: "",
    equityYears: "4",
    signing: "", 
    pto: "15",
  });
  const [showTracker, setShowTracker] = useState(false);
 const [outcomes, setOutcomes] = useState([]);
 const [trackerLoading, setTrackerLoading] = useState(false);
 const [outcomeSaved, setOutcomeSaved] = useState(false);
 const [newOutcome, setNewOutcome] = useState({
   role: "",
   industry: "",
   offeredBase: "",
   finalBase: "",
   offeredTotal: "",
   finalTotal: "",
   timeToNegotiate: "",
   tactic: "",
   note: "",
 });
 const [stats, setStats] = useState({
  totalUsers: 0,
  totalGained: 0,
  avgGain: 0,
  topIndustry: "",
 });
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);
  useEffect(() => {
	loadOutcomes();
	}, []);
  // ── Storage helpers ─────────────────────────────────────────
const STORAGE_KEY = "negotiation_outcomes";

const loadOutcomes = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      setOutcomes(data.outcomes || []);
      computeStats(data.outcomes || []);
    }
  } catch (e) {
    console.log("No saved outcomes yet");
    setOutcomes([]);
  }
};

const computeStats = (outcomeList) => {
  if (!outcomeList.length) return;
  const totalGained = outcomeList.reduce((sum, o) => {
    return sum + (parseFloat(o.finalTotal || o.finalBase || 0) -
      parseFloat(o.offeredTotal || o.offeredBase || 0));
  }, 0);
  const avgGain = totalGained / outcomeList.length;

  // Find top industry
  const industryCounts = {};
  outcomeList.forEach(o => {
    if (o.industry) {
      industryCounts[o.industry] = (industryCounts[o.industry] || 0) + 1;
    }
  });
  const topIndustry = Object.entries(industryCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  setStats({
    totalUsers: outcomeList.length,
    totalGained: Math.round(totalGained),
    avgGain: Math.round(avgGain),
    topIndustry,
  });
};

const saveOutcome = async () => {
  if (!newOutcome.role || !newOutcome.finalBase) return;
  setTrackerLoading(true);

  try {
    // Load existing outcomes from localStorage
    let existing = [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        existing = JSON.parse(stored).outcomes || [];
      }
    } catch (e) { /* nothing saved yet */ }

    // Build the new entry
    const entry = {
      ...newOutcome,
      id: Date.now().toString(),
      date: new Date().toLocaleDateString("en-US", {
        month: "short", year: "numeric",
      }),
      gained: Math.round(
        parseFloat(newOutcome.finalTotal || newOutcome.finalBase || 0) -
        parseFloat(newOutcome.offeredTotal || newOutcome.offeredBase || 0)
      ),
    };

    const updated = [entry, ...existing];

    // Save to localStorage — works on localhost + Vercel
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ outcomes: updated }));

    // Update UI
    setOutcomes(updated);
    computeStats(updated);
    setOutcomeSaved(true);

    // Reset form
    setNewOutcome({
      role: "", industry: "", offeredBase: "", finalBase: "",
      offeredTotal: "", finalTotal: "", timeToNegotiate: "",
      tactic: "", note: "",
    });

    // Fire celebration message into chat
    await sendMessage(
      `🎉 I just logged my negotiation win! Role: ${entry.role}, ` +
      `Industry: ${entry.industry || "not specified"}. ` +
      `I secured $${entry.gained > 0
        ? entry.gained.toLocaleString()
        : "a better package"} ` +
      `more than the initial offer. What should I know for my next negotiation?`
    );

    setTimeout(() => setOutcomeSaved(false), 3000);

  } catch (e) {
    console.error("Save outcome error:", e);
    alert("Could not save — check the console for details");
  } finally {
    setTrackerLoading(false);
  }
};

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setLoading(true);

    const apiMessages = newMessages
      .filter((m) => m.role !== "assistant" || m !== WELCOME_MESSAGE)
      .map((m) => ({ role: m.role, content: m.content }));

    if (apiMessages[0]?.role === "assistant") apiMessages.shift();

    try {
      const systemPrompt = mode === "roleplay"
        ? SYSTEM_PROMPT + "\n\nIMPORTANT: The user wants to ROLE-PLAY. You are now acting as a recruiter/hiring manager named Alex from the company. Stay in character. Be realistic — push back on requests, ask clarifying questions a recruiter would ask. After each roleplay exchange, add a brief [Coach Note] in italics with tactical advice on how the user performed and what to do next."
        : SYSTEM_PROMPT;

      const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system: systemPrompt,
        messages: apiMessages.length ? apiMessages : [{ role: "user", content: userText }],
      }),
    });

      const data = await response.json();
      const reply = data.content?.map((b) => b.text || "").join("") || "I encountered an issue. Please try again.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages([...newMessages, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleMode = () => {
    const next = mode === "coach" ? "roleplay" : "coach";
    setMode(next);
    const modeMsg = next === "roleplay"
      ? "🎭 **Role-play mode activated.** I'm now Alex, your recruiter. Start the conversation — tell me which company and role you're discussing, and I'll play the recruiter. I'll push back realistically and coach you after each exchange."
      : "🎯 **Coach mode restored.** I'm back to pure strategy and advice. What do you want to work on?";
    setMessages((prev) => [...prev, { role: "assistant", content: modeMsg }]);
  };
  
  const lookupSalary = async () => {
  if (!jobTitle.trim()) return;
  setSalaryLoading(true);
  setSalaryData(null);
  try {
    const response = await fetch("/api/salary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobTitle: jobTitle.trim(),
        location: jobLocation.trim() || "United States",
        offeredSalary: offeredSalary ? parseFloat(offeredSalary) : null,
      }),
    });
    const data = await response.json();
    setSalaryData(data);

    // Auto-inject salary context into the chat
    if (data.median) {
      const contextMsg = `[Market Data Loaded] For ${data.occupation} in ${data.location}: 
		25th percentile: $${data.p25?.toLocaleString()}, 
		Median: $${data.median?.toLocaleString()}, 
		75th percentile: $${data.p75?.toLocaleString()}. 
		${offeredSalary ? `Their offer of $${parseFloat(offeredSalary).toLocaleString()} is ${data.percentileRating} — negotiation leverage is ${data.negotiationStrength}.` : ""}
		Source: ${data.source}`;
			  await sendMessage(contextMsg);
			}
		  } catch (e) {
			console.error("Salary lookup failed:", e);
		  } finally {
			setSalaryLoading(false);
		  }
		};
  
  const calculateCounter = async () => {
  if (!offer.base) return;
  setCalcLoading(true);
  setCounterResult(null);

  try {
    // ── Calculate current offer total value ──────────────────
    const base = parseFloat(offer.base) || 0;
    const bonusPct = parseFloat(offer.bonus) || 0;
    const equityTotal = parseFloat(offer.equity) || 0;
    const equityYears = parseFloat(offer.equityYears) || 4;
    const signing = parseFloat(offer.signing) || 0;
    const pto = parseFloat(offer.pto) || 15;

    const annualBonus = base * (bonusPct / 100);
    const annualEquity = equityTotal / equityYears;
    const totalYear1 = base + annualBonus + annualEquity + signing;
    const totalAnnual = base + annualBonus + annualEquity;
    const total4Year = totalAnnual * 4 + signing;

    // ── Generate smart counter targets ───────────────────────
    // Standard negotiation: anchor 15-20% above on base
    // Equity: push for 20-25% more
    // Signing: ask for 10-15% of base if not offered, double if offered

    const counterBase = Math.round(base * 1.15 / 1000) * 1000;
    const counterBonus = bonusPct > 0 ? Math.min(bonusPct + 5, 30) : 0;
    const counterEquity = equityTotal > 0
      ? Math.round(equityTotal * 1.25 / 1000) * 1000
      : 0;
    const counterSigning = signing > 0
      ? Math.round(signing * 1.5 / 1000) * 1000
      : Math.round(base * 0.10 / 1000) * 1000;

    const counterAnnualBonus = counterBase * (counterBonus / 100);
    const counterAnnualEquity = counterEquity / equityYears;
    const counterTotal4Year =
      (counterBase + counterAnnualBonus + counterAnnualEquity) * 4 +
      counterSigning;
    const counterTotalAnnual =
      counterBase + counterAnnualBonus + counterAnnualEquity;
    const counterTotalYear1 =
      counterBase + counterAnnualBonus + counterAnnualEquity + counterSigning;

    const annualGap = counterTotalAnnual - totalAnnual;
    const fourYearGap = counterTotal4Year - total4Year;

    // ── Ask AI for negotiation narrative ─────────────────────
    const aiResponse = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: `You are an elite salary negotiation coach. 
        Given offer details and counter-offer targets, write a sharp, 
        specific negotiation strategy. Be direct. Give exact scripts. 
        No fluff. Format your response in 3 short sections:
        1. YOUR LEVERAGE (2-3 sentences on how strong their position is)
        2. COUNTER SCRIPT (the exact words to say — 3-4 sentences)
        3. FALLBACK MOVE (what to do if they say no to base — focus on equity/signing)`,
        messages: [
          {
            role: "user",
            content: `Current offer: Base $${base.toLocaleString()}, 
Bonus ${bonusPct}%, Equity $${equityTotal.toLocaleString()} over ${equityYears} years, 
Signing $${signing.toLocaleString()}.
Total year 1: $${totalYear1.toLocaleString()}. 
4-year value: $${total4Year.toLocaleString()}.

My counter targets: Base $${counterBase.toLocaleString()}, 
Bonus ${counterBonus}%, Equity $${counterEquity.toLocaleString()}, 
Signing $${counterSigning.toLocaleString()}.
Counter year 1: $${counterTotalYear1.toLocaleString()}.
Counter 4-year: $${counterTotal4Year.toLocaleString()}.

${salaryData?.median
  ? `Market data: median is $${salaryData.median.toLocaleString()}, 
75th percentile is $${salaryData.p75?.toLocaleString()}. 
My offer is ${salaryData.percentileRating}.`
  : "No market data loaded yet."}

Give me my negotiation strategy.`,
          },
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const strategy =
      aiData.content?.[0]?.text || "Could not generate strategy.";

    setCounterResult({
      current: {
        base, annualBonus, annualEquity, signing,
        totalYear1, totalAnnual, total4Year, bonusPct,
        equityTotal, equityYears, pto,
      },
      counter: {
        base: counterBase,
        bonusPct: counterBonus,
        annualBonus: counterAnnualBonus,
        equity: counterEquity,
        annualEquity: counterAnnualEquity,
        signing: counterSigning,
        totalYear1: counterTotalYear1,
        totalAnnual: counterTotalAnnual,
        total4Year: counterTotal4Year,
      },
      gap: { annual: annualGap, fourYear: fourYearGap },
      strategy,
    });

    // Auto-inject into chat so coach knows the full picture
    await sendMessage(
      `[Counter-Offer Calculated] Current offer total value: 
$${totalAnnual.toLocaleString()}/year ($${total4Year.toLocaleString()} over 4 years). 
Recommended counter: $${counterTotalAnnual.toLocaleString()}/year 
($${counterTotal4Year.toLocaleString()} over 4 years). 
That's $${fourYearGap.toLocaleString()} more over 4 years. 
What's the best way to present this counter?`
    );
  } catch (e) {
    console.error("Calculator error:", e);
  } finally {
    setCalcLoading(false);
  }
};

  const reset = () => {
    setMessages([WELCOME_MESSAGE]);
    setMode("coach");
    setInput("");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0f1a",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      color: "#e2e8f0",
    }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
        textarea:focus { outline: none; }
        textarea { resize: none; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "1rem 1.5rem",
        borderBottom: "1px solid #1e293b",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0d1424",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "10px",
            background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1rem",
          }}>💼</div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1.05rem", letterSpacing: "-0.01em" }}>NegotiateAI</div>
            <div style={{ fontSize: "0.7rem", color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>Compensation Coach</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={toggleMode} style={{
            padding: "0.4rem 0.9rem",
            borderRadius: "20px",
            border: `1px solid ${mode === "roleplay" ? "#7c3aed" : "#1e293b"}`,
            background: mode === "roleplay" ? "rgba(124,58,237,0.15)" : "transparent",
            color: mode === "roleplay" ? "#a78bfa" : "#64748b",
            fontSize: "0.75rem",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 500,
            transition: "all 0.2s",
          }}>
            {mode === "roleplay" ? "🎭 Role-play ON" : "🎭 Role-play"}
          </button>
          <button onClick={reset} style={{
            padding: "0.4rem 0.9rem",
            borderRadius: "20px",
            border: "1px solid #1e293b",
            background: "transparent",
            color: "#64748b",
            fontSize: "0.75rem",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 500,
          }}>↺ Reset</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 1rem" }}>
        <div style={{ maxWidth: 740, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              animation: "slideUp 0.25s ease",
            }}>
              {msg.role === "assistant" && (
                <div style={{
                  width: 28, height: 28, borderRadius: "8px",
                  background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.75rem", flexShrink: 0, marginRight: "0.65rem", marginTop: "0.1rem",
                }}>💼</div>
              )}
              <div style={{
                maxWidth: "82%",
                padding: msg.role === "user" ? "0.65rem 1rem" : "1rem 1.15rem",
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                background: msg.role === "user"
                  ? "linear-gradient(135deg, #1d4ed8, #2563eb)"
                  : "#111827",
                border: msg.role === "assistant" ? "1px solid #1e293b" : "none",
                color: msg.role === "user" ? "#e2e8f0" : "inherit",
              }}>
                {msg.role === "user"
                  ? <p style={{ margin: 0, lineHeight: 1.6, fontSize: "0.9rem" }}>{msg.content}</p>
                  : <MarkdownText text={msg.content} />
                }
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", animation: "slideUp 0.2s ease" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "8px",
                background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem",
              }}>💼</div>
              <div style={{ display: "flex", gap: "5px", padding: "0.8rem 1rem", background: "#111827", borderRadius: "4px 18px 18px 18px", border: "1px solid #1e293b" }}>
                {[0, 1, 2].map(n => (
                  <div key={n} style={{
                    width: 7, height: 7, borderRadius: "50%", background: "#3b82f6",
                    animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
	  {/* Salary Benchmark Panel */}
<div style={{ padding: "0 1rem 0.5rem", maxWidth: 740, margin: "0 auto", width: "100%" }}>
  <button
    onClick={() => setShowSalary(!showSalary)}
    style={{
      width: "100%",
      padding: "0.6rem 1rem",
      borderRadius: "12px",
      border: "1px solid #1e293b",
      background: showSalary ? "#111827" : "transparent",
      color: showSalary ? "#7dd3fc" : "#475569",
      fontSize: "0.8rem",
      cursor: "pointer",
      fontFamily: "inherit",
      textAlign: "left",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
    <span>📊 Salary Benchmark — look up market data before negotiating</span>
    <span>{showSalary ? "▲" : "▼"}</span>
  </button>

  {showSalary && (
    <div style={{
      marginTop: "0.5rem",
      padding: "1rem",
      background: "#111827",
      borderRadius: "12px",
      border: "1px solid #1e293b",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <div>
          <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "4px" }}>Job Title *</div>
          <input
            value={jobTitle}
            onChange={e => setJobTitle(e.target.value)}
            placeholder="e.g. Product Manager"
            style={{
              width: "100%", padding: "0.5rem 0.7rem",
              background: "#0d1424", border: "1px solid #1e293b",
              borderRadius: "8px", color: "#e2e8f0", fontSize: "0.8rem",
              fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "4px" }}>Location</div>
          <input
            value={jobLocation}
            onChange={e => setJobLocation(e.target.value)}
            placeholder="e.g. Austin, TX"
            style={{
              width: "100%", padding: "0.5rem 0.7rem",
              background: "#0d1424", border: "1px solid #1e293b",
              borderRadius: "8px", color: "#e2e8f0", fontSize: "0.8rem",
              fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "4px" }}>Offered Salary ($)</div>
          <input
            value={offeredSalary}
            onChange={e => setOfferedSalary(e.target.value)}
            placeholder="e.g. 95000"
            type="number"
            style={{
              width: "100%", padding: "0.5rem 0.7rem",
              background: "#0d1424", border: "1px solid #1e293b",
              borderRadius: "8px", color: "#e2e8f0", fontSize: "0.8rem",
              fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <button
        onClick={lookupSalary}
        disabled={!jobTitle.trim() || salaryLoading}
        style={{
          padding: "0.5rem 1.2rem",
          borderRadius: "8px", border: "none",
          background: jobTitle.trim() && !salaryLoading ? "linear-gradient(135deg, #1d4ed8, #2563eb)" : "#1e293b",
          color: jobTitle.trim() && !salaryLoading ? "white" : "#475569",
          fontSize: "0.8rem", cursor: jobTitle.trim() && !salaryLoading ? "pointer" : "not-allowed",
          fontFamily: "inherit", fontWeight: 500,
        }}
      >
        {salaryLoading ? "Looking up..." : "Get Market Data →"}
      </button>

      {/* Results */}
      {salaryData && !salaryLoading && (
        <div style={{ marginTop: "1rem", borderTop: "1px solid #1e293b", paddingTop: "1rem" }}>
          <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "0.75rem" }}>
            {salaryData.occupation} · {salaryData.location} · {salaryData.source}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
            {[
              { label: "25th Percentile", value: salaryData.p25, color: "#f59e0b" },
              { label: "Median (50th)", value: salaryData.median, color: "#3b82f6" },
              { label: "75th Percentile", value: salaryData.p75, color: "#10b981" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                padding: "0.6rem 0.75rem", background: "#0d1424",
                borderRadius: "8px", border: `1px solid ${color}33`,
              }}>
                <div style={{ fontSize: "0.65rem", color: "#64748b", marginBottom: "2px" }}>{label}</div>
                <div style={{ fontSize: "1rem", fontWeight: 600, color }}>
                  {value ? `$${value.toLocaleString()}` : "—"}
                </div>
              </div>
            ))}
          </div>

          {/* Offer comparison bar */}
          {salaryData.offeredSalary && salaryData.p25 && salaryData.p75 && (
            <div>
              <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "6px" }}>
                Your offer: <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                  ${salaryData.offeredSalary.toLocaleString()}
                </span> — <span style={{ color: salaryData.negotiationStrength === "very strong" || salaryData.negotiationStrength === "strong" ? "#10b981" : "#f59e0b" }}>
                  {salaryData.percentileRating} · {salaryData.negotiationStrength} negotiation leverage
                </span>
              </div>
              <div style={{ height: "6px", background: "#1e293b", borderRadius: "3px", position: "relative", marginBottom: "0.5rem" }}>
                {(() => {
                  const min = salaryData.p25 * 0.85;
                  const max = salaryData.p75 * 1.15;
                  const range = max - min;
                  const p25Pct = ((salaryData.p25 - min) / range) * 100;
                  const p75Pct = ((salaryData.p75 - min) / range) * 100;
                  const offerPct = Math.min(100, Math.max(0, ((salaryData.offeredSalary - min) / range) * 100));
                  return (
                    <>
                      <div style={{ position: "absolute", left: `${p25Pct}%`, right: `${100 - p75Pct}%`, height: "100%", background: "#1d4ed8", borderRadius: "3px" }} />
                      <div style={{ position: "absolute", left: `${offerPct}%`, top: "-3px", width: "12px", height: "12px", background: "#f59e0b", borderRadius: "50%", transform: "translateX(-50%)", border: "2px solid #0d1424" }} />
                    </>
                  );
                })()}
              </div>
              <div style={{ fontSize: "0.65rem", color: "#334155", display: "flex", justifyContent: "space-between" }}>
                <span>${(salaryData.p25 * 0.85 / 1000).toFixed(0)}K</span>
                <span style={{ color: "#1d4ed8" }}>market range</span>
                <span>${(salaryData.p75 * 1.15 / 1000).toFixed(0)}K</span>
              </div>
            </div>
          )}

          <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: "#334155" }}>
            ✓ Data loaded into your coaching session — ask the coach what to do next
          </div>
        </div>
      )}
    </div>
  )}
</div>
{/* Counter-Offer Calculator Panel */}
<div style={{
  padding: "0 1rem 0.5rem",
  maxWidth: 740,
  margin: "0 auto",
  width: "100%",
}}>
  <button
    onClick={() => setShowCalculator(!showCalculator)}
    style={{
      width: "100%",
      padding: "0.6rem 1rem",
      borderRadius: "12px",
      border: "1px solid #1e293b",
      background: showCalculator ? "#111827" : "transparent",
      color: showCalculator ? "#a78bfa" : "#475569",
      fontSize: "0.8rem",
      cursor: "pointer",
      fontFamily: "inherit",
      textAlign: "left",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
    <span>🧮 Counter-Offer Calculator — see your 4-year gain</span>
    <span>{showCalculator ? "▲" : "▼"}</span>
  </button>

  {showCalculator && (
    <div style={{
      marginTop: "0.5rem",
      padding: "1rem",
      background: "#111827",
      borderRadius: "12px",
      border: "1px solid #1e293b",
    }}>

      {/* Input grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "0.5rem",
        marginBottom: "0.75rem",
      }}>
        {[
          { key: "base", label: "Base Salary ($) *", placeholder: "e.g. 110000", type: "number" },
          { key: "bonus", label: "Bonus Target (%)", placeholder: "e.g. 10", type: "number" },
          { key: "equity", label: "Total Equity / RSUs ($)", placeholder: "e.g. 80000", type: "number" },
          { key: "equityYears", label: "Equity Vesting (years)", placeholder: "4", type: "number" },
          { key: "signing", label: "Signing Bonus ($)", placeholder: "e.g. 20000", type: "number" },
          { key: "pto", label: "PTO Days", placeholder: "15", type: "number" },
        ].map(({ key, label, placeholder, type }) => (
          <div key={key}>
            <div style={{
              fontSize: "0.7rem",
              color: "#64748b",
              marginBottom: "4px",
            }}>{label}</div>
            <input
              type={type}
              value={offer[key]}
              onChange={e => setOffer(prev => ({ ...prev, [key]: e.target.value }))}
              placeholder={placeholder}
              style={{
                width: "100%",
                padding: "0.5rem 0.7rem",
                background: "#0d1424",
                border: "1px solid #1e293b",
                borderRadius: "8px",
                color: "#e2e8f0",
                fontSize: "0.8rem",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>
        ))}
      </div>

      <button
        onClick={calculateCounter}
        disabled={!offer.base || calcLoading}
        style={{
          padding: "0.5rem 1.2rem",
          borderRadius: "8px",
          border: "none",
          background: offer.base && !calcLoading
            ? "linear-gradient(135deg, #6d28d9, #7c3aed)"
            : "#1e293b",
          color: offer.base && !calcLoading ? "white" : "#475569",
          fontSize: "0.8rem",
          cursor: offer.base && !calcLoading ? "pointer" : "not-allowed",
          fontFamily: "inherit",
          fontWeight: 500,
        }}
      >
        {calcLoading ? "Calculating..." : "Calculate Counter-Offer →"}
      </button>

      {/* Results */}
      {counterResult && !calcLoading && (
        <div style={{
          marginTop: "1rem",
          borderTop: "1px solid #1e293b",
          paddingTop: "1rem",
        }}>

          {/* Side by side comparison */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}>
            {/* Their offer */}
            <div style={{
              padding: "0.75rem",
              background: "#0d1424",
              borderRadius: "10px",
              border: "1px solid #1e293b",
            }}>
              <div style={{
                fontSize: "0.65rem",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.5rem",
              }}>Their Offer</div>
              {[
                { label: "Base", value: `$${counterResult.current.base.toLocaleString()}` },
                { label: "Annual Bonus", value: counterResult.current.annualBonus > 0 ? `$${Math.round(counterResult.current.annualBonus).toLocaleString()}` : "—" },
                { label: "Annual Equity", value: counterResult.current.annualEquity > 0 ? `$${Math.round(counterResult.current.annualEquity).toLocaleString()}` : "—" },
                { label: "Signing Bonus", value: counterResult.current.signing > 0 ? `$${counterResult.current.signing.toLocaleString()}` : "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                  marginBottom: "4px",
                }}>
                  <span style={{ color: "#64748b" }}>{label}</span>
                  <span style={{ color: "#94a3b8" }}>{value}</span>
                </div>
              ))}
              <div style={{
                borderTop: "1px solid #1e293b",
                marginTop: "0.5rem",
                paddingTop: "0.5rem",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                }}>
                  <span style={{ color: "#64748b" }}>Year 1 Total</span>
                  <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                    ${Math.round(counterResult.current.totalYear1).toLocaleString()}
                  </span>
                </div>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                  marginTop: "2px",
                }}>
                  <span style={{ color: "#64748b" }}>4-Year Total</span>
                  <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                    ${Math.round(counterResult.current.total4Year).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Your counter */}
            <div style={{
              padding: "0.75rem",
              background: "#0d1424",
              borderRadius: "10px",
              border: "1px solid #6d28d9",
            }}>
              <div style={{
                fontSize: "0.65rem",
                color: "#a78bfa",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.5rem",
              }}>Your Counter</div>
              {[
                { label: "Base", value: `$${counterResult.counter.base.toLocaleString()}`, highlight: true },
                { label: "Annual Bonus", value: counterResult.counter.annualBonus > 0 ? `$${Math.round(counterResult.counter.annualBonus).toLocaleString()}` : "—", highlight: true },
                { label: "Annual Equity", value: counterResult.counter.annualEquity > 0 ? `$${Math.round(counterResult.counter.annualEquity).toLocaleString()}` : "—", highlight: true },
                { label: "Signing Bonus", value: `$${counterResult.counter.signing.toLocaleString()}`, highlight: true },
              ].map(({ label, value, highlight }) => (
                <div key={label} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                  marginBottom: "4px",
                }}>
                  <span style={{ color: "#64748b" }}>{label}</span>
                  <span style={{ color: highlight ? "#a78bfa" : "#94a3b8" }}>{value}</span>
                </div>
              ))}
              <div style={{
                borderTop: "1px solid #1e293b",
                marginTop: "0.5rem",
                paddingTop: "0.5rem",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                }}>
                  <span style={{ color: "#64748b" }}>Year 1 Total</span>
                  <span style={{ color: "#a78bfa", fontWeight: 600 }}>
                    ${Math.round(counterResult.counter.totalYear1).toLocaleString()}
                  </span>
                </div>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                  marginTop: "2px",
                }}>
                  <span style={{ color: "#64748b" }}>4-Year Total</span>
                  <span style={{ color: "#a78bfa", fontWeight: 600 }}>
                    ${Math.round(counterResult.counter.total4Year).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4-year gain highlight */}
          <div style={{
            padding: "0.75rem 1rem",
            background: "rgba(109,40,217,0.1)",
            border: "1px solid #6d28d9",
            borderRadius: "10px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}>
            <div>
              <div style={{ fontSize: "0.7rem", color: "#a78bfa" }}>
                If you negotiate successfully
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                +${Math.round(counterResult.gap.annual).toLocaleString()}/year
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.7rem", color: "#a78bfa" }}>
                4-year gain
              </div>
              <div style={{
                fontSize: "1.4rem",
                fontWeight: 700,
                color: "#a78bfa",
                fontFamily: "'Playfair Display', serif",
              }}>
                +${Math.round(counterResult.gap.fourYear).toLocaleString()}
              </div>
            </div>
          </div>

          {/* AI strategy */}
          <div style={{
            padding: "0.75rem",
            background: "#0d1424",
            borderRadius: "10px",
            border: "1px solid #1e293b",
          }}>
            <div style={{
              fontSize: "0.65rem",
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.5rem",
            }}>Your Strategy</div>
            <div style={{
              fontSize: "0.78rem",
              color: "#94a3b8",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}>
              {counterResult.strategy}
            </div>
          </div>

          <div style={{
            marginTop: "0.5rem",
            fontSize: "0.7rem",
            color: "#334155",
          }}>
            ✓ Counter-offer loaded into your session — continue the conversation above
          </div>
        </div>
      )}
    </div>
  )}
</div>

{/* Outcome Tracker Panel */}
<div style={{
  padding: "0 1rem 0.5rem",
  maxWidth: 740,
  margin: "0 auto",
  width: "100%",
}}>
  <button
    onClick={() => setShowTracker(!showTracker)}
    style={{
      width: "100%",
      padding: "0.6rem 1rem",
      borderRadius: "12px",
      border: "1px solid #1e293b",
      background: showTracker ? "#111827" : "transparent",
      color: showTracker ? "#34d399" : "#475569",
      fontSize: "0.8rem",
      cursor: "pointer",
      fontFamily: "inherit",
      textAlign: "left",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
    <span>
      🏆 Negotiation Wins — log your result, see community totals
      {stats.totalUsers > 0 && (
        <span style={{
          marginLeft: "0.75rem",
          background: "rgba(52,211,153,0.15)",
          color: "#34d399",
          padding: "2px 8px",
          borderRadius: "10px",
          fontSize: "0.7rem",
        }}>
          {stats.totalUsers} wins · ${(stats.totalGained / 1000).toFixed(0)}K secured
        </span>
      )}
    </span>
    <span>{showTracker ? "▲" : "▼"}</span>
  </button>

  {showTracker && (
    <div style={{
      marginTop: "0.5rem",
      padding: "1rem",
      background: "#111827",
      borderRadius: "12px",
      border: "1px solid #1e293b",
    }}>

      {/* Community Stats Bar */}
      {stats.totalUsers > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: "0.5rem",
          marginBottom: "1rem",
        }}>
          {[
            { label: "Total Wins", value: stats.totalUsers.toString(), color: "#34d399" },
            {
              label: "Total Secured",
              value: stats.totalGained >= 1000000
                ? `$${(stats.totalGained / 1000000).toFixed(1)}M`
                : `$${(stats.totalGained / 1000).toFixed(0)}K`,
              color: "#34d399",
            },
            {
              label: "Avg Per Win",
              value: `$${(stats.avgGain / 1000).toFixed(0)}K`,
              color: "#a78bfa",
            },
            {
              label: "Top Industry",
              value: stats.topIndustry || "—",
              color: "#7dd3fc",
            },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              padding: "0.6rem 0.75rem",
              background: "#0d1424",
              borderRadius: "8px",
              border: "1px solid #1e293b",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "0.65rem", color: "#64748b", marginBottom: "2px" }}>
                {label}
              </div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, color }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log a Win Form */}
      <div style={{
        padding: "0.75rem",
        background: "#0d1424",
        borderRadius: "10px",
        border: "1px solid #1e293b",
        marginBottom: "1rem",
      }}>
        <div style={{
          fontSize: "0.7rem",
          color: "#34d399",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.75rem",
        }}>
          Log Your Win
        </div>

        {/* Row 1 */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.5rem",
          marginBottom: "0.5rem",
        }}>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "4px" }}>
              Job Title *
            </div>
            <input
              value={newOutcome.role}
              onChange={e => setNewOutcome(p => ({ ...p, role: e.target.value }))}
              placeholder="e.g. Product Manager"
              style={{
                width: "100%", padding: "0.5rem 0.7rem",
                background: "#111827", border: "1px solid #1e293b",
                borderRadius: "8px", color: "#e2e8f0", fontSize: "0.8rem",
                fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "4px" }}>
              Industry
            </div>
            <select
              value={newOutcome.industry}
              onChange={e => setNewOutcome(p => ({ ...p, industry: e.target.value }))}
              style={{
                width: "100%", padding: "0.5rem 0.7rem",
                background: "#111827", border: "1px solid #1e293b",
                borderRadius: "8px", color: "#e2e8f0", fontSize: "0.8rem",
                fontFamily: "inherit", boxSizing: "border-box",
              }}
            >
              <option value="">Select industry</option>
              {[
                "Technology", "Finance", "Healthcare", "Marketing",
                "Consulting", "Education", "Legal", "Sales",
                "Engineering", "Design", "Other",
              ].map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2 — Salary numbers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: "0.5rem",
          marginBottom: "0.5rem",
        }}>
          {[
            { key: "offeredBase", label: "Offered Base ($)" },
            { key: "finalBase", label: "Final Base ($) *" },
            { key: "offeredTotal", label: "Offered Total ($)" },
            { key: "finalTotal", label: "Final Total ($)" },
          ].map(({ key, label }) => (
            <div key={key}>
              <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "4px" }}>
                {label}
              </div>
              <input
                type="number"
                value={newOutcome[key]}
                onChange={e => setNewOutcome(p => ({ ...p, [key]: e.target.value }))}
                placeholder="0"
                style={{
                  width: "100%", padding: "0.5rem 0.7rem",
                  background: "#111827", border: "1px solid #1e293b",
                  borderRadius: "8px", color: "#e2e8f0", fontSize: "0.8rem",
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>
          ))}
        </div>

        {/* Row 3 — Tactic + note */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.5rem",
          marginBottom: "0.75rem",
        }}>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "4px" }}>
              Key tactic that worked
            </div>
            <select
              value={newOutcome.tactic}
              onChange={e => setNewOutcome(p => ({ ...p, tactic: e.target.value }))}
              style={{
                width: "100%", padding: "0.5rem 0.7rem",
                background: "#111827", border: "1px solid #1e293b",
                borderRadius: "8px", color: "#e2e8f0", fontSize: "0.8rem",
                fontFamily: "inherit", boxSizing: "border-box",
              }}
            >
              <option value="">Select tactic</option>
              {[
                "Competing offer", "Market data / research",
                "Anchoring high", "Silence / patience",
                "Bundling (equity + signing)", "Delay tactic",
                "Walking away", "Email negotiation", "Other",
              ].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "4px" }}>
              One-line note (optional)
            </div>
            <input
              value={newOutcome.note}
              onChange={e => setNewOutcome(p => ({ ...p, note: e.target.value }))}
              placeholder="e.g. They matched my competing offer"
              style={{
                width: "100%", padding: "0.5rem 0.7rem",
                background: "#111827", border: "1px solid #1e293b",
                borderRadius: "8px", color: "#e2e8f0", fontSize: "0.8rem",
                fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Gain preview */}
        {newOutcome.finalBase && newOutcome.offeredBase && (
          <div style={{
            padding: "0.5rem 0.75rem",
            background: "rgba(52,211,153,0.08)",
            border: "1px solid rgba(52,211,153,0.2)",
            borderRadius: "8px",
            marginBottom: "0.75rem",
            fontSize: "0.78rem",
            color: "#34d399",
          }}>
            🎉 You negotiated{" "}
            <strong>
              +${Math.max(0,
                parseFloat(newOutcome.finalTotal || newOutcome.finalBase || 0) -
                parseFloat(newOutcome.offeredTotal || newOutcome.offeredBase || 0)
              ).toLocaleString()}
            </strong>{" "}
            more than the initial offer
          </div>
        )}

        <button
          onClick={saveOutcome}
          disabled={!newOutcome.role || !newOutcome.finalBase || trackerLoading}
          style={{
            padding: "0.5rem 1.2rem",
            borderRadius: "8px",
            border: "none",
            background: newOutcome.role && newOutcome.finalBase && !trackerLoading
              ? "linear-gradient(135deg, #059669, #10b981)"
              : "#1e293b",
            color: newOutcome.role && newOutcome.finalBase && !trackerLoading
              ? "white"
              : "#475569",
            fontSize: "0.8rem",
            cursor: newOutcome.role && newOutcome.finalBase && !trackerLoading
              ? "pointer"
              : "not-allowed",
            fontFamily: "inherit",
            fontWeight: 500,
            transition: "all 0.2s",
          }}
        >
          {trackerLoading ? "Saving..." : outcomeSaved ? "✓ Win Logged!" : "Log My Win →"}
        </button>
      </div>

      {/* Recent wins feed */}
      {outcomes.length > 0 && (
        <div>
          <div style={{
            fontSize: "0.7rem",
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.5rem",
          }}>
            Recent Wins
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {outcomes.slice(0, 5).map((o) => (
              <div key={o.id} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.5rem 0.75rem",
                background: "#0d1424",
                borderRadius: "8px",
                border: "1px solid #1e293b",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "8px",
                    background: "rgba(52,211,153,0.1)",
                    display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: "0.75rem",
                  }}>🏆</div>
                  <div>
                    <div style={{ fontSize: "0.78rem", color: "#e2e8f0" }}>
                      {o.role}
                      {o.industry && (
                        <span style={{
                          marginLeft: "6px",
                          fontSize: "0.65rem",
                          color: "#64748b",
                          background: "#1e293b",
                          padding: "1px 6px",
                          borderRadius: "4px",
                        }}>
                          {o.industry}
                        </span>
                      )}
                    </div>
                    {o.tactic && (
                      <div style={{ fontSize: "0.65rem", color: "#475569", marginTop: "1px" }}>
                        via {o.tactic}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: o.gained > 0 ? "#34d399" : "#64748b",
                  }}>
                    {o.gained > 0 ? `+$${o.gained.toLocaleString()}` : "Better package"}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "#334155" }}>
                    {o.date}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {outcomes.length > 5 && (
            <div style={{
              textAlign: "center",
              fontSize: "0.7rem",
              color: "#334155",
              marginTop: "0.5rem",
            }}>
              +{outcomes.length - 5} more wins logged
            </div>
          )}
        </div>
      )}

      {outcomes.length === 0 && (
        <div style={{
          textAlign: "center",
          padding: "1rem",
          color: "#334155",
          fontSize: "0.78rem",
        }}>
          No wins logged yet — be the first to share your result 🎯
        </div>
      )}

    </div>
  )}
</div>

      {/* Suggested starters */}
      {messages.length === 1 && (
        <div style={{ padding: "0 1rem 0.75rem", maxWidth: 740, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {SUGGESTED_STARTERS.map((s, i) => (
              <button key={i} onClick={() => sendMessage(s)} style={{
                padding: "0.4rem 0.85rem",
                borderRadius: "20px",
                border: "1px solid #1e293b",
                background: "#111827",
                color: "#64748b",
                fontSize: "0.78rem",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
                onMouseEnter={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.color = "#93c5fd"; }}
                onMouseLeave={e => { e.target.style.borderColor = "#1e293b"; e.target.style.color = "#64748b"; }}
              >{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: "0.75rem 1rem 1.25rem",
        borderTop: "1px solid #1e293b",
        background: "#0d1424",
      }}>
        <div style={{ maxWidth: 740, margin: "0 auto" }}>
          <div style={{
            display: "flex", gap: "0.65rem", alignItems: "flex-end",
            background: "#111827",
            border: "1px solid #1e293b",
            borderRadius: "16px",
            padding: "0.65rem 0.65rem 0.65rem 1rem",
            transition: "border-color 0.2s",
          }}
            onFocusCapture={e => e.currentTarget.style.borderColor = "#2563eb"}
            onBlurCapture={e => e.currentTarget.style.borderColor = "#1e293b"}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={mode === "roleplay" ? "Speak to the recruiter..." : "Share your offer details or ask a question..."}
              rows={1}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                color: "#e2e8f0",
                fontSize: "0.9rem",
                fontFamily: "inherit",
                lineHeight: 1.6,
                maxHeight: 120,
                overflowY: "auto",
              }}
              onInput={e => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              style={{
                width: 36, height: 36,
                borderRadius: "10px",
                border: "none",
                background: input.trim() && !loading ? "linear-gradient(135deg, #1d4ed8, #2563eb)" : "#1e293b",
                color: input.trim() && !loading ? "white" : "#475569",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1rem",
                flexShrink: 0,
                transition: "all 0.2s",
              }}
            >↑</button>
          </div>
          <p style={{ textAlign: "center", color: "#334155", fontSize: "0.68rem", marginTop: "0.5rem", letterSpacing: "0.03em" }}>
            AI coaching — not a substitute for professional financial or legal advice
          </p>
        </div>
      </div>
    </div>
  );
}
