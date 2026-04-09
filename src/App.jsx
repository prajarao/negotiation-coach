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

Always end your responses with a clear next step the user should take.
Format responses with clear sections when giving structured advice.`;

const WELCOME_MESSAGE = {
  role: "assistant",
  content: `# Welcome to OfferAdvisor

I'm your personal offer negotiation coach — the same sharp, specific advice top executives pay thousands for.

**Tell me about your situation to get started:**
- What role and company is the offer for?
- What's the current offer (base, bonus, equity)?
- Any competing offers or context I should know?

*The more you share, the sharper my coaching gets.*`,
};

const STEPS = [
  { id: 1, label: "Share Offer", icon: "📋", desc: "Tell me about your offer" },
  { id: 2, label: "Benchmark", icon: "📊", desc: "Compare to market data" },
  { id: 3, label: "Calculate", icon: "🧮", desc: "Build your counter-offer" },
  { id: 4, label: "Practice", icon: "🎭", desc: "Role-play the conversation" },
  { id: 5, label: "Log Win", icon: "🏆", desc: "Record your result" },
];

const CONTEXTUAL_PROMPTS = {
  1: [
    "I have a job offer I want to evaluate",
    "I want to negotiate a raise at my current job",
    "I have two competing offers to compare",
    "Help me understand my total comp package",
  ],
  2: [
    "Is my offer above or below market rate?",
    "What's the going rate for my role in my city?",
    "How does my equity compare to industry standards?",
    "What percentile is my offer at?",
  ],
  3: [
    "What should I counter with?",
    "How much more should I ask for?",
    "Should I negotiate base or equity first?",
    "What's my 4-year gain if I negotiate?",
  ],
  4: [
    "Role-play: you're the recruiter, I'll practice",
    "What do I say when they ask my salary expectations?",
    "How do I respond if they say the offer is firm?",
    "Write me a negotiation email I can send today",
  ],
  5: [
    "I successfully negotiated — help me log my win",
    "They didn't budge — what did I learn?",
    "I got more equity instead of base — how do I record this?",
    "What should I do differently next time?",
  ],
};

const CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD ($)" },
  { code: "GBP", symbol: "£", label: "GBP (£)" },
  { code: "INR", symbol: "₹", label: "INR (₹)" },
  { code: "EUR", symbol: "€", label: "EUR (€)" },
  { code: "CAD", symbol: "CA$", label: "CAD (CA$)" },
  { code: "AUD", symbol: "A$", label: "AUD (A$)" },
  { code: "SGD", symbol: "S$", label: "SGD (S$)" },
  { code: "AED", symbol: "د.إ", label: "AED (د.إ)" },
];

const getCurrencySymbol = (code) =>
  CURRENCIES.find((c) => c.code === code)?.symbol || "$";

function MarkdownText({ text, textColor, primaryColor, mutedColor }) {
  const tc = textColor || "#94a3b8";
  const pc = primaryColor || "#f1f5f9";
  const mc = mutedColor || "#64748b";
  const renderLine = (line, i) => {
    if (line.startsWith("# "))
      return (
        <h1 key={i} style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0.4rem 0 0.6rem", color: pc, fontFamily: "'DM Serif Display', serif" }}>
          {line.slice(2)}
        </h1>
      );
    if (line.startsWith("## "))
      return (
        <h2 key={i} style={{ fontSize: "0.72rem", fontWeight: 600, margin: "0.9rem 0 0.35rem", color: mc, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {line.slice(3)}
        </h2>
      );
    if (line.startsWith("### "))
      return (
        <h3 key={i} style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0.6rem 0 0.25rem", color: tc }}>
          {line.slice(4)}
        </h3>
      );
    if (line.startsWith("- ")) {
      const c = line.slice(2).replace(/\*\*(.*?)\*\*/g, (_, t) => `<strong style="color:${pc}">${t}</strong>`);
      return (
        <li key={i} style={{ margin: "0.25rem 0", color: tc, listStyle: "none", paddingLeft: "0.9rem", borderLeft: "2px solid rgba(100,116,139,0.3)" }}
          dangerouslySetInnerHTML={{ __html: c }}
        />
      );
    }
    if (line.match(/^\d+\./)) {
      const c = line.replace(/^\d+\.\s*/, "").replace(/\*\*(.*?)\*\*/g, (_, t) => `<strong style="color:${pc}">${t}</strong>`);
      return <li key={i} style={{ margin: "0.25rem 0", color: tc, marginLeft: "1rem" }} dangerouslySetInnerHTML={{ __html: c }} />;
    }
    if (line.trim() === "") return <br key={i} />;
    const c = line
      .replace(/\*\*(.*?)\*\*/g, (_, t) => `<strong style="color:${pc}">${t}</strong>`)
      .replace(/\*(.*?)\*/g, (_, t) => `<em style="color:#7dd3fc">${t}</em>`)
      .replace(/`(.*?)`/g, (_, t) => `<code style="background:rgba(100,116,139,0.15);padding:1px 5px;border-radius:3px;font-family:monospace;color:#7dd3fc;font-size:0.82em">${t}</code>`);
    return <p key={i} style={{ margin: "0.3rem 0", color: tc, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: c }} />;
  };
  return <div>{text.split("\n").map((l, i) => renderLine(l, i))}</div>;
}

export default function NegotiationCoach() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("coach");
  const [currentStep, setCurrentStep] = useState(1);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  // Theme
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("offeradvisor_theme");
    return saved ? saved === "dark" : true;
  });

  const T = {
    pageBg: isDark ? "#0a0f1a" : "#f1f5f9",
    headerBg: isDark ? "#0d1424" : "#ffffff",
    surfaceBg: isDark ? "#111827" : "#ffffff",
    inputBg: isDark ? "#0d1424" : "#f8fafc",
    cardBg: isDark ? "#0d1424" : "#f8fafc",
    panelBg: isDark ? "#111827" : "#ffffff",
    stepBg: isDark ? "#0d1424" : "#ffffff",
    border: isDark ? "#1e293b" : "#e2e8f0",
    textPrimary: isDark ? "#e2e8f0" : "#0f172a",
    textSecondary: isDark ? "#94a3b8" : "#475569",
    textMuted: isDark ? "#64748b" : "#94a3b8",
    textHint: isDark ? "#334155" : "#cbd5e1",
    inactiveStep: isDark ? "#1e293b" : "#e2e8f0",
  };

  // Panels
  const [showSalary, setShowSalary] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showTracker, setShowTracker] = useState(false);

  // Salary
  const [salaryData, setSalaryData] = useState(null);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [jobLocation, setJobLocation] = useState("");
  const [offeredSalary, setOfferedSalary] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");

  // Role tracking for LinkedIn button
  const [lastRole, setLastRole] = useState("");
  const [lastLocation, setLastLocation] = useState("");

  // Calculator
  const [calcLoading, setCalcLoading] = useState(false);
  const [counterResult, setCounterResult] = useState(null);
  const [offer, setOffer] = useState({ base: "", bonus: "", equity: "", equityYears: "4", signing: "", pto: "15" });

  // Tracker
  const [outcomes, setOutcomes] = useState([]);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [outcomeSaved, setOutcomeSaved] = useState(false);
  const [newOutcome, setNewOutcome] = useState({ role: "", industry: "", offeredBase: "", finalBase: "", offeredTotal: "", finalTotal: "", tactic: "", note: "" });
  const [stats, setStats] = useState({ totalUsers: 0, totalGained: 0, avgGain: 0, topIndustry: "" });

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const seen = localStorage.getItem("offeradvisor_onboarding_seen");
    if (!seen) setShowOnboarding(true);
    loadOutcomes();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setIsDark(!isDark);
    localStorage.setItem("offeradvisor_theme", next);
  };

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
      setOutcomes([]);
    }
  };

  const computeStats = (list) => {
    if (!list.length) return;
    const totalGained = list.reduce(
      (s, o) => s + (parseFloat(o.finalTotal || o.finalBase || 0) - parseFloat(o.offeredTotal || o.offeredBase || 0)),
      0
    );
    const ic = {};
    list.forEach((o) => { if (o.industry) ic[o.industry] = (ic[o.industry] || 0) + 1; });
    const topIndustry = Object.entries(ic).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    setStats({ totalUsers: list.length, totalGained: Math.round(totalGained), avgGain: Math.round(totalGained / list.length), topIndustry });
  };

  // ── Core send message function ──────────────────────────────────────────
  const sendMessage = async (text) => {
    const userText = (text || input || "").trim();
    if (!userText || loading) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setLoading(true);

    // Step detection
    const lower = userText.toLowerCase();
    if (lower.includes("offer") || lower.includes("salary") || lower.includes("comp")) setCurrentStep((s) => Math.max(s, 1));
    if (lower.includes("market") || lower.includes("benchmark") || lower.includes("percentile")) setCurrentStep((s) => Math.max(s, 2));
    if (lower.includes("counter") || lower.includes("calculate") || lower.includes("ask for")) setCurrentStep((s) => Math.max(s, 3));
    if (lower.includes("role-play") || lower.includes("practice") || lower.includes("email") || lower.includes("script")) setCurrentStep((s) => Math.max(s, 4));
    if (lower.includes("win") || lower.includes("negotiated") || lower.includes("accepted")) setCurrentStep((s) => Math.max(s, 5));

    // Track role/location for LinkedIn button
    if (jobTitle) setLastRole(jobTitle);
    if (jobLocation) setLastLocation(jobLocation);

    const systemPrompt =
      mode === "roleplay"
        ? SYSTEM_PROMPT + "\n\nIMPORTANT: You are now role-playing as a recruiter named Alex. Stay in character. Push back realistically. After each exchange add a brief [Coach Note] with tactical feedback."
        : SYSTEM_PROMPT;

    const apiMessages = newMessages
      .filter((m) => m !== WELCOME_MESSAGE && ["user", "assistant"].includes(m.role))
      .map((m) => ({ role: m.role, content: m.content }));
    if (apiMessages.length > 0 && apiMessages[0].role === "assistant") apiMessages.shift();

    const messagesToSend = apiMessages.length > 0
      ? apiMessages
      : [{ role: "user", content: userText }];

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: systemPrompt, messages: messagesToSend }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      const reply = data.content?.[0]?.text || "Something went wrong. Please try again.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (e) {
      console.error("Chat error:", e);
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

  // ── Salary lookup ────────────────────────────────────────────────────────
  const lookupSalary = async () => {
    if (!jobTitle.trim()) return;
    setSalaryLoading(true);
    setSalaryData(null);

    // Auto-detect currency from location
    const locLower = jobLocation.toLowerCase();
    const autoCurrency =
      locLower.includes("uk") || locLower.includes("london") || locLower.includes("england") || locLower.includes("manchester") || locLower.includes("birmingham") || locLower.includes("edinburgh") || locLower.includes("glasgow") ? "GBP"
      : locLower.includes("india") || locLower.includes("bangalore") || locLower.includes("bengaluru") || locLower.includes("mumbai") || locLower.includes("delhi") || locLower.includes("hyderabad") || locLower.includes("pune") || locLower.includes("chennai") ? "INR"
      : locLower.includes("europe") || locLower.includes("germany") || locLower.includes("france") || locLower.includes("berlin") || locLower.includes("paris") ? "EUR"
      : locLower.includes("canada") || locLower.includes("toronto") || locLower.includes("vancouver") ? "CAD"
      : locLower.includes("australia") || locLower.includes("sydney") || locLower.includes("melbourne") ? "AUD"
      : locLower.includes("singapore") ? "SGD"
      : locLower.includes("dubai") || locLower.includes("uae") || locLower.includes("abu dhabi") ? "AED"
      : selectedCurrency;

    setSelectedCurrency(autoCurrency);
    setLastRole(jobTitle);
    setLastLocation(jobLocation);

    try {
      const response = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: jobTitle.trim(),
          location: jobLocation.trim() || "United States",
          offeredSalary: offeredSalary ? parseFloat(offeredSalary) : null,
          currency: autoCurrency,
        }),
      });
      const data = await response.json();
      setSalaryData(data);
      setCurrentStep((s) => Math.max(s, 2));

      if (data.median) {
        const sym = data.currencySymbol || getCurrencySymbol(autoCurrency);
        await sendMessage(
          `[Market Data] ${data.occupation} in ${data.location}: ` +
          `25th=${sym}${data.p25?.toLocaleString()}, ` +
          `Median=${sym}${data.median?.toLocaleString()}, ` +
          `75th=${sym}${data.p75?.toLocaleString()}. ` +
          (offeredSalary ? `Offer of ${sym}${parseFloat(offeredSalary).toLocaleString()} is ${data.percentileRating} — ${data.negotiationStrength} leverage. ` : "") +
          `Source: ${data.source}`
        );
      }
    } catch (e) {
      console.error("Salary lookup error:", e);
    } finally {
      setSalaryLoading(false);
    }
  };

  // ── Counter-offer calculator ──────────────────────────────────────────────
  const calculateCounter = async () => {
    if (!offer.base) return;
    setCalcLoading(true);
    setCounterResult(null);
    try {
      const base = parseFloat(offer.base) || 0;
      const bonusPct = parseFloat(offer.bonus) || 0;
      const equityTotal = parseFloat(offer.equity) || 0;
      const equityYears = parseFloat(offer.equityYears) || 4;
      const signing = parseFloat(offer.signing) || 0;
      const annualBonus = base * (bonusPct / 100);
      const annualEquity = equityTotal / equityYears;
      const totalAnnual = base + annualBonus + annualEquity;
      const total4Year = totalAnnual * 4 + signing;
      const counterBase = Math.round((base * 1.15) / 1000) * 1000;
      const counterBonus = bonusPct > 0 ? Math.min(bonusPct + 5, 30) : 0;
      const counterEquity = equityTotal > 0 ? Math.round((equityTotal * 1.25) / 1000) * 1000 : 0;
      const counterSigning = signing > 0 ? Math.round((signing * 1.5) / 1000) * 1000 : Math.round((base * 0.1) / 1000) * 1000;
      const counterAnnualBonus = counterBase * (counterBonus / 100);
      const counterAnnualEquity = counterEquity / equityYears;
      const counterTotalAnnual = counterBase + counterAnnualBonus + counterAnnualEquity;
      const counterTotal4Year = counterTotalAnnual * 4 + counterSigning;
      const counterTotalYear1 = counterTotalAnnual + counterSigning;
      const fourYearGap = counterTotal4Year - total4Year;

      const aiResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are an elite salary negotiation coach. Write a sharp strategy in 3 short sections: 1. YOUR LEVERAGE 2. COUNTER SCRIPT (exact words) 3. FALLBACK MOVE`,
          messages: [{ role: "user", content: `Offer: Base $${base.toLocaleString()}, Bonus ${bonusPct}%, Equity $${equityTotal.toLocaleString()}/${equityYears}yr, Signing $${signing.toLocaleString()}. Counter: Base $${counterBase.toLocaleString()}, Signing $${counterSigning.toLocaleString()}. 4yr gain: $${fourYearGap.toLocaleString()}. ${salaryData?.median ? `Market median: $${salaryData.median.toLocaleString()}.` : ""}` }],
        }),
      });
      const aiData = await aiResponse.json();
      setCounterResult({
        current: { base, annualBonus, annualEquity, signing, totalYear1: totalAnnual + signing, totalAnnual, total4Year },
        counter: { base: counterBase, annualBonus: counterAnnualBonus, annualEquity: counterAnnualEquity, signing: counterSigning, totalYear1: counterTotalYear1, totalAnnual: counterTotalAnnual, total4Year: counterTotal4Year },
        gap: { annual: counterTotalAnnual - totalAnnual, fourYear: fourYearGap },
        strategy: aiData.content?.[0]?.text || "",
      });
      setCurrentStep((s) => Math.max(s, 3));
      await sendMessage(`[Counter Calculated] Current: $${totalAnnual.toLocaleString()}/yr. Counter: $${counterTotalAnnual.toLocaleString()}/yr. That's $${fourYearGap.toLocaleString()} more over 4 years. What's my best opening line?`);
    } catch (e) {
      console.error("Calculator error:", e);
    } finally {
      setCalcLoading(false);
    }
  };

  // ── Save outcome ─────────────────────────────────────────────────────────
  const saveOutcome = async () => {
    if (!newOutcome.role || !newOutcome.finalBase) return;
    setTrackerLoading(true);
    try {
      let existing = [];
      try {
        const s = localStorage.getItem(STORAGE_KEY);
        if (s) existing = JSON.parse(s).outcomes || [];
      } catch (e) {}
      const entry = {
        ...newOutcome,
        id: Date.now().toString(),
        date: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        gained: Math.round(parseFloat(newOutcome.finalTotal || newOutcome.finalBase || 0) - parseFloat(newOutcome.offeredTotal || newOutcome.offeredBase || 0)),
      };
      const updated = [entry, ...existing];
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ outcomes: updated }));
      setOutcomes(updated);
      computeStats(updated);
      setOutcomeSaved(true);
      setNewOutcome({ role: "", industry: "", offeredBase: "", finalBase: "", offeredTotal: "", finalTotal: "", tactic: "", note: "" });
      setCurrentStep(5);
      await sendMessage(`🎉 Win logged! ${entry.role}${entry.industry ? ` (${entry.industry})` : ""}. Secured $${entry.gained > 0 ? entry.gained.toLocaleString() : "a better package"} more. What should I know for my next negotiation?`);
      setTimeout(() => setOutcomeSaved(false), 3000);
    } catch (e) {
      console.error("Save outcome error:", e);
    } finally {
      setTrackerLoading(false);
    }
  };

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("offeradvisor_onboarding_seen", "true");
  };

  const onboardingSlides = [
    { icon: "🎯", title: "Welcome to OfferAdvisor", body: "Get the same sharp, specific coaching that top executives pay thousands for — in minutes, not days.", cta: "How does it work?" },
    { icon: "📋", title: "Step 1 — Share your offer", body: "Tell the coach about your job offer, current salary, or raise request. The more context you give, the sharper the advice.", cta: "Got it" },
    { icon: "📊", title: "Step 2 — Benchmark it", body: "Use the Salary Benchmark tool to see exactly where your offer sits — 25th, 50th, or 75th percentile for your role and city.", cta: "Makes sense" },
    { icon: "🧮", title: "Step 3 — Calculate your counter", body: "The Counter-Offer Calculator shows your 4-year gain and generates a specific negotiation strategy with exact scripts.", cta: "Love it" },
    { icon: "🎭", title: "Step 4 — Practice the conversation", body: "Switch to Role-Play mode and practice with the AI acting as your recruiter. Get real-time coaching after each exchange.", cta: "Let's go!" },
  ];

  const inputStyle = { width: "100%", padding: "0.5rem 0.7rem", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: "8px", color: T.textPrimary, fontSize: "0.8rem", fontFamily: "inherit", boxSizing: "border-box" };
  const selectStyle = { ...inputStyle, background: T.inputBg };
  const primaryBtn = (active, gradient = "linear-gradient(135deg,#1d4ed8,#2563eb)") => ({ padding: "0.45rem 1.1rem", borderRadius: "8px", border: "none", background: active ? gradient : T.border, color: active ? "white" : T.textMuted, fontSize: "0.78rem", cursor: active ? "pointer" : "not-allowed", fontFamily: "inherit", fontWeight: 500 });
  const panelToggle = (open, accentColor, accentBg) => ({ width: "100%", padding: "0.55rem 1rem", borderRadius: "10px", border: `1px solid ${open ? accentColor : T.border}`, background: open ? accentBg : "transparent", color: open ? accentColor : T.textMuted, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.2s" });

  const symDisplay = salaryData?.currencySymbol || getCurrencySymbol(selectedCurrency);

  return (
    <div style={{ minHeight: "100vh", background: T.pageBg, display: "flex", flexDirection: "column", fontFamily: "'DM Sans', system-ui, sans-serif", color: T.textPrimary }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
        textarea:focus, input:focus, select:focus { outline: none; }
        textarea { resize: none; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slideIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
        .prompt-btn:hover { border-color:#3b82f6 !important; color:#93c5fd !important; background:rgba(59,130,246,0.06) !important; }
        .step-btn:hover { opacity:0.8; }
        *, *::before, *::after { transition: background-color 0.25s ease, border-color 0.2s ease, color 0.2s ease; }
      `}</style>

      {/* Onboarding Modal */}
      {showOnboarding && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", animation: "fadeIn 0.2s ease" }}>
          <div style={{ background: T.headerBg, border: `1px solid ${T.border}`, borderRadius: "20px", padding: "2rem", maxWidth: 420, width: "100%", animation: "slideIn 0.25s ease" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "1.75rem" }}>
              {onboardingSlides.map((_, i) => (
                <div key={i} onClick={() => setOnboardingStep(i)} style={{ width: i === onboardingStep ? 20 : 6, height: 6, borderRadius: "3px", background: i === onboardingStep ? "#3b82f6" : T.border, transition: "all 0.3s", cursor: "pointer" }} />
              ))}
            </div>
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{onboardingSlides[onboardingStep].icon}</div>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.4rem", fontWeight: 700, color: T.textPrimary, marginBottom: "0.75rem" }}>{onboardingSlides[onboardingStep].title}</h2>
              <p style={{ color: T.textSecondary, fontSize: "0.9rem", lineHeight: 1.7, margin: 0 }}>{onboardingSlides[onboardingStep].body}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button onClick={() => { if (onboardingStep < onboardingSlides.length - 1) setOnboardingStep((s) => s + 1); else dismissOnboarding(); }}
                style={{ padding: "0.75rem", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#1d4ed8,#2563eb)", color: "white", fontSize: "0.9rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                {onboardingSlides[onboardingStep].cta}
              </button>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {onboardingStep > 0 && (
                  <button onClick={() => setOnboardingStep((s) => s - 1)} style={{ flex: 1, padding: "0.5rem", borderRadius: "8px", border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
                    ← Back
                  </button>
                )}
                <button onClick={dismissOnboarding} style={{ flex: 1, padding: "0.5rem", borderRadius: "8px", border: "none", background: "transparent", color: T.textMuted, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
                  Skip intro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "0.75rem 1.25rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: T.headerBg, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <rect width="32" height="32" rx="9" fill="#1d4ed8"/>
            <path d="M8 20 L16 10 L24 20" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="16" cy="10" r="2.2" fill="#60a5fa"/>
            <line x1="10" y1="23" x2="22" y2="23" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
          </svg>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: "1rem", color: T.textPrimary, letterSpacing: "-0.01em" }}>
              Offer<span style={{ color: "#2563eb" }}>Advisor</span>
            </div>
            <div style={{ fontSize: "0.62rem", color: T.textMuted, letterSpacing: "0.07em", textTransform: "uppercase" }}>AI Offer Coach</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          {stats.totalUsers > 0 && (
            <div style={{ fontSize: "0.7rem", color: "#34d399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.15)", padding: "3px 8px", borderRadius: "10px", marginRight: "0.25rem" }}>
              {stats.totalUsers} wins · ${(stats.totalGained / 1000).toFixed(0)}K secured
            </div>
          )}
          <button onClick={toggleTheme} title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            style={{ padding: "0.35rem 0.8rem", borderRadius: "20px", border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            {isDark ? "☀️ Light" : "🌙 Dark"}
          </button>
          <button onClick={() => { setMode((m) => m === "roleplay" ? "coach" : "roleplay"); setMessages((p) => [...p, { role: "assistant", content: mode === "coach" ? "🎭 **Role-play mode on.** I'm Alex, your recruiter. What role are we discussing?" : "🎯 **Coach mode restored.** What do you want to work on?" }]); setCurrentStep((s) => Math.max(s, 4)); }}
            style={{ padding: "0.35rem 0.8rem", borderRadius: "20px", border: `1px solid ${mode === "roleplay" ? "#7c3aed" : T.border}`, background: mode === "roleplay" ? "rgba(124,58,237,0.12)" : "transparent", color: mode === "roleplay" ? "#a78bfa" : T.textMuted, fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
            {mode === "roleplay" ? "🎭 Role-play ON" : "🎭 Role-play"}
          </button>
          <button onClick={() => { setShowOnboarding(true); setOnboardingStep(0); }}
            style={{ padding: "0.35rem 0.8rem", borderRadius: "20px", border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit" }}>
            ? Help
          </button>
        </div>
      </div>

      {/* Step Progress Bar — all 5 steps including Practice */}
      <div style={{ background: T.stepBg, borderBottom: `1px solid ${T.border}`, padding: "0.6rem 1rem", overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", maxWidth: 740, margin: "0 auto" }}>
          {STEPS.map((step, idx) => {
            const isActive = currentStep === step.id;
            const isDone = currentStep > step.id;
            const isNext = currentStep + 1 === step.id;
            return (
              <div key={step.id} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <button className="step-btn" title={step.desc}
                  onClick={() => {
                    setCurrentStep(step.id);
                    if (step.id === 2) { setShowSalary(true); setShowCalculator(false); setShowTracker(false); }
                    else if (step.id === 3) { setShowCalculator(true); setShowSalary(false); setShowTracker(false); }
                    else if (step.id === 4) { setMode("roleplay"); setMessages((p) => [...p, { role: "assistant", content: "🎭 **Role-play mode on.** I'm Alex, your recruiter. What role are we discussing?" }]); setShowSalary(false); setShowCalculator(false); setShowTracker(false); }
                    else if (step.id === 5) { setShowTracker(true); setShowSalary(false); setShowCalculator(false); }
                    else { setShowSalary(false); setShowCalculator(false); setShowTracker(false); }
                  }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "0.3rem 0.4rem", borderRadius: "8px", border: "none", background: "transparent", cursor: "pointer", flex: 1, opacity: isDone || isActive || isNext ? 1 : 0.35, transition: "all 0.2s" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: isDone ? "#059669" : isActive ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : T.inactiveStep, border: `1.5px solid ${isDone ? "#059669" : isActive ? "#2563eb" : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", transition: "all 0.2s" }}>
                    {isDone ? "✓" : step.icon}
                  </div>
                  <div style={{ fontSize: "0.6rem", color: isActive ? T.textPrimary : isDone ? "#34d399" : T.textMuted, fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap" }}>{step.label}</div>
                </button>
                {idx < STEPS.length - 1 && <div style={{ height: "1.5px", flex: 0.3, background: currentStep > step.id ? "#059669" : T.border, transition: "background 0.3s" }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1rem", background: T.pageBg }}>
        <div style={{ maxWidth: 740, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", animation: "fadeIn 0.22s ease" }}>
              {msg.role === "assistant" && (
                <div style={{ width: 26, height: 26, borderRadius: "7px", background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: "0.55rem", marginTop: "0.1rem" }}>
                  <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                    <path d="M8 20 L16 10 L24 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <circle cx="16" cy="10" r="2.2" fill="#60a5fa"/>
                  </svg>
                </div>
              )}
              <div style={{ maxWidth: "82%", padding: msg.role === "user" ? "0.6rem 0.9rem" : "0.9rem 1.05rem", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px", background: msg.role === "user" ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : T.surfaceBg, border: msg.role === "assistant" ? `1px solid ${T.border}` : "none" }}>
                {msg.role === "user"
                  ? <p style={{ margin: 0, lineHeight: 1.6, fontSize: "0.88rem", color: "#ffffff" }}>{msg.content}</p>
                  : <MarkdownText text={msg.content} textColor={T.textSecondary} primaryColor={T.textPrimary} mutedColor={T.textMuted} />}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", animation: "fadeIn 0.2s ease" }}>
            <div style={{ width: 26, height: 26, borderRadius: "7px", background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                  <path d="M8 20 L16 10 L24 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <circle cx="16" cy="10" r="2.2" fill="#60a5fa"/>
                </svg>
              </div>
              <div style={{ display: "flex", gap: "4px", padding: "0.7rem 0.9rem", background: T.surfaceBg, borderRadius: "4px 16px 16px 16px", border: `1px solid ${T.border}` }}>
                {[0, 1, 2].map((n) => <div key={n} style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite` }} />)}
              </div>
            </div>
          )}

          {/* LinkedIn job suggestions — shown after coaching has started */}
          {messages.length > 2 && !loading && (lastRole || jobTitle) && (
            <div style={{ display: "flex", justifyContent: "flex-start", paddingLeft: "38px", animation: "fadeIn 0.3s ease" }}>
              <a
                href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(lastRole || jobTitle)}&location=${encodeURIComponent(lastLocation || jobLocation || "")}&f_TPR=r604800`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "0.4rem 0.9rem", borderRadius: "20px", border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, fontSize: "0.73rem", textDecoration: "none", fontFamily: "inherit", cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0077b5"; e.currentTarget.style.color = "#0077b5"; e.currentTarget.style.background = "rgba(0,119,181,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; e.currentTarget.style.background = "transparent"; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#0077b5" style={{ flexShrink: 0 }}>
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                See jobs paying more for {lastRole || jobTitle} →
              </a>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Salary Benchmark Panel */}
      <div style={{ padding: "0 1rem 0.4rem", maxWidth: 740, margin: "0 auto", width: "100%" }}>
        <button className="panel-toggle" onClick={() => { setShowSalary((s) => !s); setCurrentStep((p) => Math.max(p, 2)); }}
          style={panelToggle(showSalary, "#2563eb", isDark ? "rgba(29,78,216,0.08)" : "rgba(37,99,235,0.04)")}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>📊</span>
            <span><strong style={{ color: showSalary ? "#2563eb" : T.textSecondary }}>Step 2 — Salary Benchmark</strong><span style={{ color: T.textMuted }}> · Compare your offer to market data</span></span>
          </span>
          <span style={{ fontSize: "0.7rem", color: T.textMuted }}>{showSalary ? "▲ collapse" : "▼ open"}</span>
        </button>
        {showSalary && (
          <div style={{ marginTop: "0.4rem", padding: "1rem", background: T.panelBg, borderRadius: "10px", border: `1px solid ${T.border}`, animation: "fadeIn 0.18s ease" }}>
            <p style={{ fontSize: "0.75rem", color: T.textMuted, margin: "0 0 0.75rem", lineHeight: 1.5 }}>
              💡 <strong style={{ color: T.textSecondary }}>Tip:</strong> Enter your job title and location — we auto-detect your currency. Supports US, UK, India, and more.
            </p>
            {/* Row 1 — Job title + location */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <div>
                <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>Job Title *</div>
                <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Product Manager" type="text" style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>Location</div>
                <input value={jobLocation} onChange={(e) => setJobLocation(e.target.value)} placeholder="e.g. London UK · Bangalore India · Austin TX" type="text" style={inputStyle} />
              </div>
            </div>
            {/* Row 2 — Currency + offered salary */}
            <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "0.5rem", marginBottom: "0.65rem" }}>
              <div>
                <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>Currency</div>
                <select value={selectedCurrency} onChange={(e) => setSelectedCurrency(e.target.value)} style={selectStyle}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>
                  Offered Salary ({getCurrencySymbol(selectedCurrency)})
                  {selectedCurrency === "INR" && <span style={{ color: T.textHint, marginLeft: "4px" }}>— enter annual CTC e.g. 1200000 for 12 LPA</span>}
                </div>
                <input value={offeredSalary} onChange={(e) => setOfferedSalary(e.target.value)} placeholder={selectedCurrency === "INR" ? "e.g. 1200000" : selectedCurrency === "GBP" ? "e.g. 55000" : "e.g. 95000"} type="number" style={inputStyle} />
              </div>
            </div>
            <button onClick={lookupSalary} disabled={!jobTitle.trim() || salaryLoading} style={primaryBtn(jobTitle.trim() && !salaryLoading)}>
              {salaryLoading ? "Looking up..." : "Get Market Data →"}
            </button>

            {salaryData && !salaryLoading && (
              <div style={{ marginTop: "0.85rem", borderTop: `1px solid ${T.border}`, paddingTop: "0.85rem", animation: "fadeIn 0.2s ease" }}>
                <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "0.6rem" }}>
                  {salaryData.occupation} · {salaryData.location} · {salaryData.country} · {salaryData.source}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem", marginBottom: "0.65rem" }}>
                  {[{ label: "25th Percentile", value: salaryData.p25, color: "#f59e0b" }, { label: "Median (50th)", value: salaryData.median, color: "#3b82f6" }, { label: "75th Percentile", value: salaryData.p75, color: "#10b981" }].map(({ label, value, color }) => (
                    <div key={label} style={{ padding: "0.55rem 0.7rem", background: T.cardBg, borderRadius: "8px", border: `1px solid ${color}22` }}>
                      <div style={{ fontSize: "0.62rem", color: T.textMuted, marginBottom: "2px" }}>{label}</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 600, color }}>{value ? `${symDisplay}${value.toLocaleString()}` : "—"}</div>
                    </div>
                  ))}
                </div>
                {salaryData.offeredSalary && salaryData.p25 && salaryData.p75 && (
                  <>
                    <div style={{ fontSize: "0.72rem", color: T.textSecondary, marginBottom: "5px" }}>
                      Your offer: <strong style={{ color: T.textPrimary }}>{symDisplay}{salaryData.offeredSalary.toLocaleString()}</strong> —{" "}
                      <span style={{ color: ["very strong", "strong"].includes(salaryData.negotiationStrength) ? "#10b981" : "#f59e0b" }}>
                        {salaryData.percentileRating} · {salaryData.negotiationStrength} leverage
                      </span>
                    </div>
                    <div style={{ height: "5px", background: T.border, borderRadius: "3px", position: "relative", marginBottom: "0.4rem" }}>
                      {(() => {
                        const min = salaryData.p25 * 0.85, max = salaryData.p75 * 1.15, range = max - min;
                        const p25p = ((salaryData.p25 - min) / range) * 100;
                        const p75p = ((salaryData.p75 - min) / range) * 100;
                        const op = Math.min(100, Math.max(0, ((salaryData.offeredSalary - min) / range) * 100));
                        return (<>
                          <div style={{ position: "absolute", left: `${p25p}%`, right: `${100 - p75p}%`, height: "100%", background: "#1d4ed8", borderRadius: "3px" }} />
                          <div style={{ position: "absolute", left: `${op}%`, top: "-4px", width: "13px", height: "13px", background: "#f59e0b", borderRadius: "50%", transform: "translateX(-50%)", border: `2px solid ${T.cardBg}` }} />
                        </>);
                      })()}
                    </div>
                  </>
                )}
                <div style={{ fontSize: "0.68rem", color: T.textHint, marginTop: "0.3rem" }}>✓ Data loaded into your coaching session</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Counter-Offer Calculator Panel */}
      <div style={{ padding: "0 1rem 0.4rem", maxWidth: 740, margin: "0 auto", width: "100%" }}>
        <button className="panel-toggle" onClick={() => { setShowCalculator((s) => !s); setCurrentStep((p) => Math.max(p, 3)); }}
          style={panelToggle(showCalculator, "#7c3aed", isDark ? "rgba(109,40,217,0.08)" : "rgba(124,58,237,0.04)")}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>🧮</span>
            <span><strong style={{ color: showCalculator ? "#7c3aed" : T.textSecondary }}>Step 3 — Counter-Offer Calculator</strong><span style={{ color: T.textMuted }}> · See your 4-year gain</span></span>
          </span>
          <span style={{ fontSize: "0.7rem", color: T.textMuted }}>{showCalculator ? "▲ collapse" : "▼ open"}</span>
        </button>
        {showCalculator && (
          <div style={{ marginTop: "0.4rem", padding: "1rem", background: T.panelBg, borderRadius: "10px", border: `1px solid ${T.border}`, animation: "fadeIn 0.18s ease" }}>
            <p style={{ fontSize: "0.75rem", color: T.textMuted, margin: "0 0 0.75rem", lineHeight: 1.5 }}>
              💡 <strong style={{ color: T.textSecondary }}>Tip:</strong> Enter every component — base, bonus %, equity, and signing. Most people only negotiate base and leave thousands on the table.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.65rem" }}>
              {[{ key: "base", label: "Base Salary *", ph: "e.g. 110000" }, { key: "bonus", label: "Bonus Target (%)", ph: "e.g. 10" }, { key: "equity", label: "Total Equity", ph: "e.g. 80000" }, { key: "equityYears", label: "Vesting Years", ph: "4" }, { key: "signing", label: "Signing Bonus", ph: "e.g. 20000" }, { key: "pto", label: "PTO Days", ph: "15" }].map(({ key, label, ph }) => (
                <div key={key}>
                  <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>{label}</div>
                  <input type="number" value={offer[key]} onChange={(e) => setOffer((p) => ({ ...p, [key]: e.target.value }))} placeholder={ph} style={inputStyle} />
                </div>
              ))}
            </div>
            <button onClick={calculateCounter} disabled={!offer.base || calcLoading} style={primaryBtn(offer.base && !calcLoading, "linear-gradient(135deg,#6d28d9,#7c3aed)")}>
              {calcLoading ? "Calculating..." : "Calculate Counter-Offer →"}
            </button>
            {counterResult && !calcLoading && (
              <div style={{ marginTop: "0.85rem", borderTop: `1px solid ${T.border}`, paddingTop: "0.85rem", animation: "fadeIn 0.2s ease" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.75rem" }}>
                  {[{ title: "Their Offer", c: counterResult.current, color: T.textSecondary, border: T.border }, { title: "Your Counter", c: counterResult.counter, color: "#a78bfa", border: "#7c3aed" }].map(({ title, c, color, border }) => (
                    <div key={title} style={{ padding: "0.7rem", background: T.cardBg, borderRadius: "8px", border: `1px solid ${border}` }}>
                      <div style={{ fontSize: "0.62rem", color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>{title}</div>
                      {[["Base", `$${c.base.toLocaleString()}`], ["Bonus/yr", c.annualBonus > 0 ? `$${Math.round(c.annualBonus).toLocaleString()}` : "—"], ["Equity/yr", c.annualEquity > 0 ? `$${Math.round(c.annualEquity).toLocaleString()}` : "—"], ["Signing", c.signing > 0 ? `$${c.signing.toLocaleString()}` : "—"]].map(([l, v]) => (
                        <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.73rem", marginBottom: "3px" }}>
                          <span style={{ color: T.textMuted }}>{l}</span><span style={{ color }}>{v}</span>
                        </div>
                      ))}
                      <div style={{ borderTop: `1px solid ${T.border}`, marginTop: "0.4rem", paddingTop: "0.4rem", display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                        <span style={{ color: T.textMuted }}>4-Year</span>
                        <span style={{ color, fontWeight: 600 }}>${Math.round(c.total4Year).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "0.65rem 0.9rem", background: isDark ? "rgba(109,40,217,0.08)" : "rgba(124,58,237,0.05)", border: "1px solid #7c3aed", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <div style={{ fontSize: "0.72rem", color: "#a78bfa" }}>If you negotiate successfully</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#a78bfa", fontFamily: "'DM Serif Display', serif" }}>+${Math.round(counterResult.gap.fourYear).toLocaleString()}</div>
                </div>
                {counterResult.strategy && (
                  <div style={{ padding: "0.7rem", background: T.cardBg, borderRadius: "8px", border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: "0.62rem", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>Your Strategy</div>
                    <div style={{ fontSize: "0.76rem", color: T.textSecondary, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{counterResult.strategy}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 4 — Practice panel (role-play trigger) */}
      <div style={{ padding: "0 1rem 0.4rem", maxWidth: 740, margin: "0 auto", width: "100%" }}>
        <button className="panel-toggle"
          onClick={() => {
            setCurrentStep((p) => Math.max(p, 4));
            if (mode !== "roleplay") {
              setMode("roleplay");
              setMessages((p) => [...p, { role: "assistant", content: "🎭 **Role-play mode on.** I'm Alex, your recruiter. Tell me which role and company we're negotiating with and I'll play the recruiter — push back realistically and coach you after each exchange." }]);
            } else {
              setMode("coach");
              setMessages((p) => [...p, { role: "assistant", content: "🎯 **Coach mode restored.** What do you want to work on next?" }]);
            }
          }}
          style={panelToggle(mode === "roleplay", "#7c3aed", isDark ? "rgba(124,58,237,0.08)" : "rgba(124,58,237,0.04)")}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>🎭</span>
            <span>
              <strong style={{ color: mode === "roleplay" ? "#a78bfa" : T.textSecondary }}>Step 4 — Practice the Conversation</strong>
              <span style={{ color: T.textMuted }}> · Role-play with AI recruiter</span>
            </span>
            {mode === "roleplay" && (
              <span style={{ fontSize: "0.65rem", background: "rgba(124,58,237,0.15)", color: "#a78bfa", padding: "1px 6px", borderRadius: "8px", border: "1px solid rgba(124,58,237,0.3)" }}>
                Active
              </span>
            )}
          </span>
          <span style={{ fontSize: "0.7rem", color: T.textMuted }}>{mode === "roleplay" ? "▲ turn off" : "▼ activate"}</span>
        </button>
        {mode === "roleplay" && (
          <div style={{ marginTop: "0.4rem", padding: "0.75rem 1rem", background: T.panelBg, borderRadius: "10px", border: "1px solid #7c3aed", animation: "fadeIn 0.18s ease" }}>
            <p style={{ fontSize: "0.75rem", color: T.textMuted, margin: "0 0 0.5rem", lineHeight: 1.5 }}>
              💡 <strong style={{ color: T.textSecondary }}>How it works:</strong> The AI is now playing Alex, your recruiter. Have the conversation in the chat above. After each exchange, you'll get a <em>[Coach Note]</em> with tactical feedback on what you said and how to improve.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {["Hi Alex, I've reviewed the offer and I'd like to discuss the compensation", "I have a competing offer I wanted to mention", "Is there flexibility on the base salary?", "Can we discuss the equity package?"].map((prompt) => (
                <button key={prompt} className="prompt-btn" onClick={() => sendMessage(prompt)}
                  style={{ padding: "0.35rem 0.75rem", borderRadius: "20px", border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit" }}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Outcome Tracker Panel */}
      <div style={{ padding: "0 1rem 0.4rem", maxWidth: 740, margin: "0 auto", width: "100%" }}>
        <button className="panel-toggle" onClick={() => { setShowTracker((s) => !s); setCurrentStep((p) => Math.max(p, 5)); }}
          style={panelToggle(showTracker, "#10b981", isDark ? "rgba(5,150,105,0.08)" : "rgba(16,185,129,0.04)")}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>🏆</span>
            <span><strong style={{ color: showTracker ? "#10b981" : T.textSecondary }}>Step 5 — Log Your Win</strong><span style={{ color: T.textMuted }}> · Track your negotiation result</span></span>
            {stats.totalUsers > 0 && <span style={{ fontSize: "0.65rem", background: "rgba(52,211,153,0.1)", color: "#34d399", padding: "1px 6px", borderRadius: "8px", border: "1px solid rgba(52,211,153,0.15)" }}>{stats.totalUsers} wins</span>}
          </span>
          <span style={{ fontSize: "0.7rem", color: T.textMuted }}>{showTracker ? "▲ collapse" : "▼ open"}</span>
        </button>
        {showTracker && (
          <div style={{ marginTop: "0.4rem", padding: "1rem", background: T.panelBg, borderRadius: "10px", border: `1px solid ${T.border}`, animation: "fadeIn 0.18s ease" }}>
            <p style={{ fontSize: "0.75rem", color: T.textMuted, margin: "0 0 0.75rem", lineHeight: 1.5 }}>
              💡 <strong style={{ color: T.textSecondary }}>Tip:</strong> Log your result — win or not. It feeds into your coaching session and helps you see patterns.
            </p>
            {stats.totalUsers > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem", marginBottom: "0.75rem" }}>
                {[{ label: "Total Wins", value: stats.totalUsers.toString(), color: "#34d399" }, { label: "Total Secured", value: stats.totalGained >= 1000000 ? `$${(stats.totalGained / 1000000).toFixed(1)}M` : `$${(stats.totalGained / 1000).toFixed(0)}K`, color: "#34d399" }, { label: "Avg Per Win", value: `$${(stats.avgGain / 1000).toFixed(0)}K`, color: "#a78bfa" }].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: "0.5rem 0.65rem", background: T.cardBg, borderRadius: "7px", border: `1px solid ${T.border}`, textAlign: "center" }}>
                    <div style={{ fontSize: "0.62rem", color: T.textMuted, marginBottom: "2px" }}>{label}</div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 600, color }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginBottom: "0.4rem" }}>
              <div>
                <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>Job Title *</div>
                <input value={newOutcome.role} onChange={(e) => setNewOutcome((p) => ({ ...p, role: e.target.value }))} placeholder="e.g. Product Manager" style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>Industry</div>
                <select value={newOutcome.industry} onChange={(e) => setNewOutcome((p) => ({ ...p, industry: e.target.value }))} style={selectStyle}>
                  <option value="">Select industry</option>
                  {["Technology", "Finance", "Healthcare", "Marketing", "Consulting", "Education", "Legal", "Sales", "Engineering", "Design", "Other"].map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.4rem", marginBottom: "0.4rem" }}>
              {[{ key: "offeredBase", label: "Offered Base" }, { key: "finalBase", label: "Final Base *" }, { key: "offeredTotal", label: "Offered Total" }, { key: "finalTotal", label: "Final Total" }].map(({ key, label }) => (
                <div key={key}>
                  <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>{label}</div>
                  <input type="number" value={newOutcome[key]} onChange={(e) => setNewOutcome((p) => ({ ...p, [key]: e.target.value }))} placeholder="0" style={inputStyle} />
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginBottom: "0.65rem" }}>
              <div>
                <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>Key tactic</div>
                <select value={newOutcome.tactic} onChange={(e) => setNewOutcome((p) => ({ ...p, tactic: e.target.value }))} style={selectStyle}>
                  <option value="">Select tactic</option>
                  {["Competing offer", "Market data / research", "Anchoring high", "Silence / patience", "Bundling (equity + signing)", "Email negotiation", "Walking away", "Other"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>Note</div>
                <input value={newOutcome.note} onChange={(e) => setNewOutcome((p) => ({ ...p, note: e.target.value }))} placeholder="e.g. They matched my competing offer" style={inputStyle} />
              </div>
            </div>
            {newOutcome.finalBase && newOutcome.offeredBase && (
              <div style={{ padding: "0.45rem 0.7rem", background: isDark ? "rgba(52,211,153,0.07)" : "rgba(16,185,129,0.05)", border: "1px solid rgba(52,211,153,0.15)", borderRadius: "7px", marginBottom: "0.6rem", fontSize: "0.75rem", color: "#34d399" }}>
                🎉 You negotiated <strong>+${Math.max(0, parseFloat(newOutcome.finalTotal || newOutcome.finalBase || 0) - parseFloat(newOutcome.offeredTotal || newOutcome.offeredBase || 0)).toLocaleString()}</strong> more
              </div>
            )}
            <button onClick={saveOutcome} disabled={!newOutcome.role || !newOutcome.finalBase || trackerLoading}
              style={primaryBtn(newOutcome.role && newOutcome.finalBase && !trackerLoading, "linear-gradient(135deg,#059669,#10b981)")}>
              {trackerLoading ? "Saving..." : outcomeSaved ? "✓ Win Logged!" : "Log My Win →"}
            </button>
            {outcomes.length > 0 && (
              <div style={{ marginTop: "0.75rem", borderTop: `1px solid ${T.border}`, paddingTop: "0.75rem" }}>
                <div style={{ fontSize: "0.65rem", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>Recent Wins</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {outcomes.slice(0, 4).map((o) => (
                    <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.45rem 0.65rem", background: T.cardBg, borderRadius: "7px", border: `1px solid ${T.border}` }}>
                      <div>
                        <span style={{ fontSize: "0.76rem", color: T.textPrimary }}>{o.role}</span>
                        {o.industry && <span style={{ marginLeft: "5px", fontSize: "0.62rem", color: T.textMuted, background: T.border, padding: "1px 5px", borderRadius: "4px" }}>{o.industry}</span>}
                        {o.tactic && <div style={{ fontSize: "0.62rem", color: T.textHint, marginTop: "1px" }}>via {o.tactic}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: o.gained > 0 ? "#34d399" : T.textMuted }}>{o.gained > 0 ? `+$${o.gained.toLocaleString()}` : "Better pkg"}</div>
                        <div style={{ fontSize: "0.62rem", color: T.textHint }}>{o.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contextual Prompt Bubbles */}
      <div style={{ padding: "0 1rem 0.5rem", maxWidth: 740, margin: "0 auto", width: "100%" }}>
        <div style={{ marginBottom: "0.3rem", fontSize: "0.65rem", color: T.textHint, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {STEPS.find((s) => s.id === currentStep)?.desc || "Suggested prompts"}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {(CONTEXTUAL_PROMPTS[currentStep] || CONTEXTUAL_PROMPTS[1]).map((prompt, i) => (
            <button key={i} className="prompt-btn" onClick={() => sendMessage(prompt)}
              style={{ padding: "0.38rem 0.8rem", borderRadius: "20px", border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, fontSize: "0.74rem", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: "0.5rem 1rem 1.1rem", borderTop: `1px solid ${T.border}`, background: T.headerBg }}>
        <div style={{ maxWidth: 740, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: "0.55rem", alignItems: "flex-end", background: T.surfaceBg, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "0.55rem 0.55rem 0.55rem 0.9rem" }}
            onFocusCapture={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
            onBlurCapture={(e) => (e.currentTarget.style.borderColor = T.border)}>
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder={mode === "roleplay" ? "Speak to the recruiter, Alex..." : "Describe your offer or ask anything..."}
              rows={1}
              style={{ flex: 1, background: "transparent", border: "none", color: T.textPrimary, fontSize: "0.88rem", fontFamily: "inherit", lineHeight: 1.6, maxHeight: 120, overflowY: "auto" }}
              onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
            />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
              style={{ width: 34, height: 34, borderRadius: "9px", border: "none", background: input.trim() && !loading ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : T.border, color: input.trim() && !loading ? "white" : T.textMuted, cursor: input.trim() && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95rem", flexShrink: 0, transition: "all 0.2s" }}>
              ↑
            </button>
          </div>
          <p style={{ textAlign: "center", color: T.textHint, fontSize: "0.62rem", marginTop: "0.4rem" }}>
            AI coaching — not a substitute for professional financial or legal advice
          </p>
        </div>
      </div>
    </div>
  );
}
