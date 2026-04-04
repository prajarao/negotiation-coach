import { useState, useRef, useEffect } from "react";

// ─── System prompt ────────────────────────────────────────────────────────────
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

// ─── Welcome message ──────────────────────────────────────────────────────────
const WELCOME_MESSAGE = {
  role: "assistant",
  content: `# Welcome to NegotiateAI 💼

I'm your personal salary negotiation coach — the same sharp, specific advice top executives pay thousands for.

**Tell me about your situation to get started:**
- What role and company is the offer for?
- What's the current offer (base, bonus, equity)?
- Any competing offers or context I should know?

*The more you share, the sharper my coaching gets.*`,
};

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Share Offer", icon: "📋", desc: "Tell me about your offer" },
  { id: 2, label: "Benchmark", icon: "📊", desc: "Compare to market data" },
  { id: 3, label: "Calculate", icon: "🧮", desc: "Build your counter-offer" },
  { id: 4, label: "Practice", icon: "🎭", desc: "Role-play the conversation" },
  { id: 5, label: "Log Win", icon: "🏆", desc: "Record your result" },
];

// ─── Contextual prompts per step ──────────────────────────────────────────────
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

// ─── Markdown renderer ────────────────────────────────────────────────────────
function MarkdownText({ text }) {
  const renderLine = (line, i) => {
    if (line.startsWith("# ")) return <h1 key={i} style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0.4rem 0 0.6rem", color: "#e2e8f0", fontFamily: "'Playfair Display', serif" }}>{line.slice(2)}</h1>;
    if (line.startsWith("## ")) return <h2 key={i} style={{ fontSize: "0.72rem", fontWeight: 600, margin: "0.9rem 0 0.35rem", color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>{line.slice(3)}</h2>;
    if (line.startsWith("### ")) return <h3 key={i} style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0.6rem 0 0.25rem", color: "#cbd5e1" }}>{line.slice(4)}</h3>;
    if (line.startsWith("- ")) {
      const c = line.slice(2).replace(/\*\*(.*?)\*\*/g, (_, t) => `<strong style="color:#f1f5f9">${t}</strong>`);
      return <li key={i} style={{ margin: "0.25rem 0", color: "#94a3b8", listStyle: "none", paddingLeft: "0.9rem", borderLeft: "2px solid #1e293b" }} dangerouslySetInnerHTML={{ __html: c }} />;
    }
    if (line.match(/^\d+\./)) {
      const c = line.replace(/^\d+\.\s*/, "").replace(/\*\*(.*?)\*\*/g, (_, t) => `<strong style="color:#f1f5f9">${t}</strong>`);
      return <li key={i} style={{ margin: "0.25rem 0", color: "#94a3b8", marginLeft: "1rem" }} dangerouslySetInnerHTML={{ __html: c }} />;
    }
    if (line.trim() === "") return <br key={i} />;
    const c = line.replace(/\*\*(.*?)\*\*/g, (_, t) => `<strong style="color:#f1f5f9">${t}</strong>`).replace(/\*(.*?)\*/g, (_, t) => `<em style="color:#7dd3fc">${t}</em>`).replace(/`(.*?)`/g, (_, t) => `<code style="background:#1e293b;padding:1px 5px;border-radius:3px;font-family:monospace;color:#7dd3fc;font-size:0.82em">${t}</code>`);
    return <p key={i} style={{ margin: "0.3rem 0", color: "#94a3b8", lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: c }} />;
  };
  return <div>{text.split("\n").map((l, i) => renderLine(l, i))}</div>;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NegotiationCoach() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("coach");
  const [currentStep, setCurrentStep] = useState(1);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  // Panel visibility
  const [showSalary, setShowSalary] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showTracker, setShowTracker] = useState(false);

  // Salary state
  const [salaryData, setSalaryData] = useState(null);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [jobLocation, setJobLocation] = useState("");
  const [offeredSalary, setOfferedSalary] = useState("");

  // Calculator state
  const [calcLoading, setCalcLoading] = useState(false);
  const [counterResult, setCounterResult] = useState(null);
  const [offer, setOffer] = useState({ base: "", bonus: "", equity: "", equityYears: "4", signing: "", pto: "15" });

  // Tracker state
  const [outcomes, setOutcomes] = useState([]);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [outcomeSaved, setOutcomeSaved] = useState(false);
  const [newOutcome, setNewOutcome] = useState({ role: "", industry: "", offeredBase: "", finalBase: "", offeredTotal: "", finalTotal: "", tactic: "", note: "" });
  const [stats, setStats] = useState({ totalUsers: 0, totalGained: 0, avgGain: 0, topIndustry: "" });

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // ── On mount ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const seen = localStorage.getItem("negotiateai_onboarding_seen");
    if (!seen) setShowOnboarding(true);
    loadOutcomes();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Storage ─────────────────────────────────────────────────────────────────
  const STORAGE_KEY = "negotiation_outcomes";

  const loadOutcomes = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setOutcomes(data.outcomes || []);
        computeStats(data.outcomes || []);
      }
    } catch (e) { setOutcomes([]); }
  };

  const computeStats = (list) => {
    if (!list.length) return;
    const totalGained = list.reduce((s, o) => s + (parseFloat(o.finalTotal || o.finalBase || 0) - parseFloat(o.offeredTotal || o.offeredBase || 0)), 0);
    const industryCounts = {};
    list.forEach(o => { if (o.industry) industryCounts[o.industry] = (industryCounts[o.industry] || 0) + 1; });
    const topIndustry = Object.entries(industryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    setStats({ totalUsers: list.length, totalGained: Math.round(totalGained), avgGain: Math.round(totalGained / list.length), topIndustry });
  };

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setLoading(true);

    // Auto-advance step based on keywords
    const lower = userText.toLowerCase();
    if (lower.includes("offer") || lower.includes("salary") || lower.includes("comp")) setCurrentStep(s => Math.max(s, 1));
    if (lower.includes("market") || lower.includes("benchmark") || lower.includes("percentile")) setCurrentStep(s => Math.max(s, 2));
    if (lower.includes("counter") || lower.includes("calculate") || lower.includes("ask for")) setCurrentStep(s => Math.max(s, 3));
    if (lower.includes("role-play") || lower.includes("practice") || lower.includes("email") || lower.includes("script")) setCurrentStep(s => Math.max(s, 4));
    if (lower.includes("win") || lower.includes("negotiated") || lower.includes("accepted")) setCurrentStep(s => Math.max(s, 5));

    const systemPrompt = mode === "roleplay"
      ? SYSTEM_PROMPT + "\n\nIMPORTANT: You are now role-playing as a recruiter named Alex. Stay in character. Be realistic — push back on requests. After each exchange add a brief [Coach Note] with tactical feedback."
      : SYSTEM_PROMPT;

    const apiMessages = newMessages.filter(m => m !== WELCOME_MESSAGE && ["user", "assistant"].includes(m.role)).map(m => ({ role: m.role, content: m.content }));
    if (apiMessages[0]?.role === "assistant") apiMessages.shift();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: systemPrompt, messages: apiMessages.length ? apiMessages : [{ role: "user", content: userText }] }),
      });
      const data = await response.json();
      const reply = data.content?.[0]?.text || "Something went wrong. Please try again.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages([...newMessages, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  // ── Salary lookup ───────────────────────────────────────────────────────────
  const lookupSalary = async () => {
    if (!jobTitle.trim()) return;
    setSalaryLoading(true);
    setSalaryData(null);
    try {
      const response = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle: jobTitle.trim(), location: jobLocation.trim() || "United States", offeredSalary: offeredSalary ? parseFloat(offeredSalary) : null }),
      });
      const data = await response.json();
      setSalaryData(data);
      setCurrentStep(s => Math.max(s, 2));
      if (data.median) {
        await sendMessage(`[Market Data] ${data.occupation} in ${data.location}: 25th=$${data.p25?.toLocaleString()}, Median=$${data.median?.toLocaleString()}, 75th=$${data.p75?.toLocaleString()}. ${offeredSalary ? `Offer of $${parseFloat(offeredSalary).toLocaleString()} is ${data.percentileRating} — ${data.negotiationStrength} leverage.` : ""} Source: ${data.source}`);
      }
    } catch (e) { console.error(e); }
    finally { setSalaryLoading(false); }
  };

  // ── Counter-offer calculator ─────────────────────────────────────────────────
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
      const totalYear1 = base + annualBonus + annualEquity + signing;
      const totalAnnual = base + annualBonus + annualEquity;
      const total4Year = totalAnnual * 4 + signing;
      const counterBase = Math.round(base * 1.15 / 1000) * 1000;
      const counterBonus = bonusPct > 0 ? Math.min(bonusPct + 5, 30) : 0;
      const counterEquity = equityTotal > 0 ? Math.round(equityTotal * 1.25 / 1000) * 1000 : 0;
      const counterSigning = signing > 0 ? Math.round(signing * 1.5 / 1000) * 1000 : Math.round(base * 0.10 / 1000) * 1000;
      const counterAnnualBonus = counterBase * (counterBonus / 100);
      const counterAnnualEquity = counterEquity / equityYears;
      const counterTotal4Year = (counterBase + counterAnnualBonus + counterAnnualEquity) * 4 + counterSigning;
      const counterTotalAnnual = counterBase + counterAnnualBonus + counterAnnualEquity;
      const counterTotalYear1 = counterBase + counterAnnualBonus + counterAnnualEquity + counterSigning;
      const annualGap = counterTotalAnnual - totalAnnual;
      const fourYearGap = counterTotal4Year - total4Year;

      const aiResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are an elite salary negotiation coach. Given offer details write a sharp strategy in 3 short sections: 1. YOUR LEVERAGE 2. COUNTER SCRIPT (exact words) 3. FALLBACK MOVE`,
          messages: [{ role: "user", content: `Offer: Base $${base.toLocaleString()}, Bonus ${bonusPct}%, Equity $${equityTotal.toLocaleString()}/${equityYears}yr, Signing $${signing.toLocaleString()}. Counter: Base $${counterBase.toLocaleString()}, Signing $${counterSigning.toLocaleString()}. 4yr gain: $${fourYearGap.toLocaleString()}. ${salaryData?.median ? `Market median: $${salaryData.median.toLocaleString()}.` : ""}` }],
        }),
      });
      const aiData = await aiResponse.json();
      setCounterResult({ current: { base, annualBonus, annualEquity, signing, totalYear1, totalAnnual, total4Year }, counter: { base: counterBase, bonusPct: counterBonus, annualBonus: counterAnnualBonus, equity: counterEquity, annualEquity: counterAnnualEquity, signing: counterSigning, totalYear1: counterTotalYear1, totalAnnual: counterTotalAnnual, total4Year: counterTotal4Year }, gap: { annual: annualGap, fourYear: fourYearGap }, strategy: aiData.content?.[0]?.text || "" });
      setCurrentStep(s => Math.max(s, 3));
      await sendMessage(`[Counter Calculated] Current: $${totalAnnual.toLocaleString()}/yr ($${total4Year.toLocaleString()} over 4yr). Counter: $${counterTotalAnnual.toLocaleString()}/yr ($${counterTotal4Year.toLocaleString()} over 4yr). That's $${fourYearGap.toLocaleString()} more. What's my best opening line?`);
    } catch (e) { console.error(e); }
    finally { setCalcLoading(false); }
  };

  // ── Save outcome ─────────────────────────────────────────────────────────────
  const saveOutcome = async () => {
    if (!newOutcome.role || !newOutcome.finalBase) return;
    setTrackerLoading(true);
    try {
      let existing = [];
      try { const s = localStorage.getItem(STORAGE_KEY); if (s) existing = JSON.parse(s).outcomes || []; } catch (e) { }
      const entry = { ...newOutcome, id: Date.now().toString(), date: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }), gained: Math.round(parseFloat(newOutcome.finalTotal || newOutcome.finalBase || 0) - parseFloat(newOutcome.offeredTotal || newOutcome.offeredBase || 0)) };
      const updated = [entry, ...existing];
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ outcomes: updated }));
      setOutcomes(updated);
      computeStats(updated);
      setOutcomeSaved(true);
      setNewOutcome({ role: "", industry: "", offeredBase: "", finalBase: "", offeredTotal: "", finalTotal: "", tactic: "", note: "" });
      setCurrentStep(5);
      await sendMessage(`🎉 Win logged! ${entry.role}${entry.industry ? ` (${entry.industry})` : ""}. Secured $${entry.gained > 0 ? entry.gained.toLocaleString() : "a better package"} more. What should I know for my next negotiation?`);
      setTimeout(() => setOutcomeSaved(false), 3000);
    } catch (e) { console.error(e); }
    finally { setTrackerLoading(false); }
  };

  // ── Onboarding slides ────────────────────────────────────────────────────────
  const onboardingSlides = [
    { icon: "💼", title: "Your AI Negotiation Coach", body: "Get the same sharp, specific coaching that top executives pay thousands for — in minutes, not days.", cta: "How does it work?" },
    { icon: "📋", title: "Step 1 — Share your offer", body: "Tell the coach about your job offer, current salary, or raise request. The more context you give, the sharper the advice.", cta: "Got it" },
    { icon: "📊", title: "Step 2 — Benchmark it", body: "Use the Salary Benchmark tool to see exactly where your offer sits — 25th, 50th, or 75th percentile for your role and city.", cta: "Makes sense" },
    { icon: "🧮", title: "Step 3 — Calculate your counter", body: "The Counter-Offer Calculator shows your 4-year gain and generates a specific negotiation strategy with exact scripts.", cta: "Love it" },
    { icon: "🎭", title: "Step 4 — Practice the conversation", body: "Switch to Role-Play mode and practice with the AI acting as your recruiter. Get real-time coaching after each exchange.", cta: "Let's go!" },
  ];

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("negotiateai_onboarding_seen", "true");
  };

  const inputStyle = { width: "100%", padding: "0.5rem 0.7rem", background: "#0d1424", border: "1px solid #1e293b", borderRadius: "8px", color: "#e2e8f0", fontSize: "0.8rem", fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", display: "flex", flexDirection: "column", fontFamily: "'DM Sans', system-ui, sans-serif", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
        textarea:focus, input:focus, select:focus { outline: none; }
        textarea { resize: none; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slideIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
        .prompt-btn:hover { border-color: #3b82f6 !important; color: #93c5fd !important; background: rgba(59,130,246,0.06) !important; }
        .step-btn:hover { background: rgba(255,255,255,0.04) !important; }
        .panel-toggle:hover { opacity: 0.85; }
      `}</style>

      {/* ── Onboarding Modal ──────────────────────────────────────────────────── */}
      {showOnboarding && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", animation: "fadeIn 0.2s ease" }}>
          <div style={{ background: "#0d1424", border: "1px solid #1e293b", borderRadius: "20px", padding: "2rem", maxWidth: 420, width: "100%", animation: "slideIn 0.25s ease" }}>
            {/* Progress dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "1.75rem" }}>
              {onboardingSlides.map((_, i) => (
                <div key={i} style={{ width: i === onboardingStep ? 20 : 6, height: 6, borderRadius: "3px", background: i === onboardingStep ? "#3b82f6" : "#1e293b", transition: "all 0.3s" }} />
              ))}
            </div>

            {/* Slide content */}
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{onboardingSlides[onboardingStep].icon}</div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "0.75rem" }}>
                {onboardingSlides[onboardingStep].title}
              </h2>
              <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.7, margin: 0 }}>
                {onboardingSlides[onboardingStep].body}
              </p>
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button
                onClick={() => {
                  if (onboardingStep < onboardingSlides.length - 1) setOnboardingStep(s => s + 1);
                  else dismissOnboarding();
                }}
                style={{ padding: "0.75rem", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #1d4ed8, #2563eb)", color: "white", fontSize: "0.9rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
              >
                {onboardingSlides[onboardingStep].cta}
              </button>
              <button onClick={dismissOnboarding} style={{ padding: "0.5rem", borderRadius: "8px", border: "none", background: "transparent", color: "#334155", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
                Skip intro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d1424", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <div style={{ width: 32, height: 32, borderRadius: "9px", background: "linear-gradient(135deg, #1d4ed8, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem" }}>💼</div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "1rem" }}>NegotiateAI</div>
            <div style={{ fontSize: "0.62rem", color: "#334155", letterSpacing: "0.07em", textTransform: "uppercase" }}>Compensation Coach</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          {stats.totalUsers > 0 && (
            <div style={{ fontSize: "0.7rem", color: "#34d399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.15)", padding: "3px 8px", borderRadius: "10px", marginRight: "0.25rem" }}>
              {stats.totalUsers} wins · ${(stats.totalGained / 1000).toFixed(0)}K secured
            </div>
          )}
          <button onClick={() => { setMode(m => m === "roleplay" ? "coach" : "roleplay"); setMessages(p => [...p, { role: "assistant", content: mode === "coach" ? "🎭 **Role-play mode on.** I'm Alex, your recruiter. What role are we discussing?" : "🎯 **Coach mode restored.** What do you want to work on?" }]); }}
            style={{ padding: "0.35rem 0.8rem", borderRadius: "20px", border: `1px solid ${mode === "roleplay" ? "#7c3aed" : "#1e293b"}`, background: mode === "roleplay" ? "rgba(124,58,237,0.12)" : "transparent", color: mode === "roleplay" ? "#a78bfa" : "#475569", fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
            {mode === "roleplay" ? "🎭 Role-play ON" : "🎭 Role-play"}
          </button>
          <button onClick={() => setShowOnboarding(true)} style={{ padding: "0.35rem 0.8rem", borderRadius: "20px", border: "1px solid #1e293b", background: "transparent", color: "#475569", fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit" }}>? Help</button>
        </div>
      </div>

      {/* ── Step Progress Bar ─────────────────────────────────────────────────── */}
      <div style={{ background: "#0d1424", borderBottom: "1px solid #1e293b", padding: "0.6rem 1rem", overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", maxWidth: 740, margin: "0 auto", gap: "0" }}>
          {STEPS.map((step, idx) => {
            const isActive = currentStep === step.id;
            const isDone = currentStep > step.id;
            const isNext = currentStep + 1 === step.id;
            return (
              <div key={step.id} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <button
                  className="step-btn"
                  onClick={() => {
                    setCurrentStep(step.id);
                    if (step.id === 2) { setShowSalary(true); setShowCalculator(false); setShowTracker(false); }
                    else if (step.id === 3) { setShowCalculator(true); setShowSalary(false); setShowTracker(false); }
                    else if (step.id === 5) { setShowTracker(true); setShowSalary(false); setShowCalculator(false); }
                    else { setShowSalary(false); setShowCalculator(false); setShowTracker(false); }
                  }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "0.3rem 0.4rem", borderRadius: "8px", border: "none", background: "transparent", cursor: "pointer", flex: 1, opacity: isDone || isActive || isNext ? 1 : 0.35, transition: "all 0.2s" }}
                  title={step.desc}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: isDone ? "#059669" : isActive ? "linear-gradient(135deg, #1d4ed8, #2563eb)" : "#111827", border: `1.5px solid ${isDone ? "#059669" : isActive ? "#2563eb" : "#1e293b"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", transition: "all 0.2s" }}>
                    {isDone ? "✓" : step.icon}
                  </div>
                  <div style={{ fontSize: "0.6rem", color: isActive ? "#e2e8f0" : isDone ? "#34d399" : "#334155", fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap" }}>
                    {step.label}
                  </div>
                </button>
                {idx < STEPS.length - 1 && (
                  <div style={{ height: "1.5px", flex: 0.3, background: currentStep > step.id ? "#059669" : "#1e293b", transition: "background 0.3s" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Messages ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1rem" }}>
        <div style={{ maxWidth: 740, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", animation: "fadeIn 0.22s ease" }}>
              {msg.role === "assistant" && (
                <div style={{ width: 26, height: 26, borderRadius: "7px", background: "linear-gradient(135deg, #1d4ed8, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", flexShrink: 0, marginRight: "0.55rem", marginTop: "0.1rem" }}>💼</div>
              )}
              <div style={{ maxWidth: "82%", padding: msg.role === "user" ? "0.6rem 0.9rem" : "0.9rem 1.05rem", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px", background: msg.role === "user" ? "linear-gradient(135deg, #1d4ed8, #2563eb)" : "#111827", border: msg.role === "assistant" ? "1px solid #1e293b" : "none" }}>
                {msg.role === "user" ? <p style={{ margin: 0, lineHeight: 1.6, fontSize: "0.88rem", color: "#e2e8f0" }}>{msg.content}</p> : <MarkdownText text={msg.content} />}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", animation: "fadeIn 0.2s ease" }}>
              <div style={{ width: 26, height: 26, borderRadius: "7px", background: "linear-gradient(135deg, #1d4ed8, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem" }}>💼</div>
              <div style={{ display: "flex", gap: "4px", padding: "0.7rem 0.9rem", background: "#111827", borderRadius: "4px 16px 16px 16px", border: "1px solid #1e293b" }}>
                {[0, 1, 2].map(n => <div key={n} style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite` }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Salary Benchmark Panel ────────────────────────────────────────────── */}
      <div style={{ padding: "0 1rem 0.4rem", maxWidth: 740, margin: "0 auto", width: "100%" }}>
        <button className="panel-toggle" onClick={() => { setShowSalary(s => !s); setCurrentStep(p => Math.max(p, 2)); }}
          style={{ width: "100%", padding: "0.55rem 1rem", borderRadius: "10px", border: `1px solid ${showSalary ? "#1d4ed8" : "#1e293b"}`, background: showSalary ? "rgba(29,78,216,0.08)" : "transparent", color: showSalary ? "#7dd3fc" : "#475569", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.2s" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.9rem" }}>📊</span>
            <span><strong style={{ color: showSalary ? "#7dd3fc" : "#64748b" }}>Step 2 — Salary Benchmark</strong> <span style={{ color: "#334155" }}>· Compare your offer to market data</span></span>
          </span>
          <span style={{ fontSize: "0.7rem", color: "#334155" }}>{showSalary ? "▲ collapse" : "▼ open"}</span>
        </button>

        {showSalary && (
          <div style={{ marginTop: "0.4rem", padding: "1rem", background: "#111827", borderRadius: "10px", border: "1px solid #1e293b", animation: "fadeIn 0.18s ease" }}>
            <p style={{ fontSize: "0.75rem", color: "#475569", margin: "0 0 0.75rem", lineHeight: 1.5 }}>
              💡 <strong style={{ color: "#64748b" }}>Tip:</strong> Enter your job title and the salary you were offered. We'll pull real government data to show exactly where your offer sits in the market.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.65rem" }}>
              {[{ val: jobTitle, set: setJobTitle, ph: "e.g. Product Manager", label: "Job Title *" }, { val: jobLocation, set: setJobLocation, ph: "e.g. Austin, TX", label: "Location" }, { val: offeredSalary, set: setOfferedSalary, ph: "e.g. 95000", label: "Offered Salary ($)", type: "number" }].map(({ val, set, ph, label, type }) => (
                <div key={label}>
                  <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: "3px" }}>{label}</div>
                  <input value={val} onChange={e => set(e.target.value)} placeholder={ph} type={type || "text"} style={inputStyle} />
                </div>
              ))}
            </div>
            <button onClick={lookupSalary} disabled={!jobTitle.trim() || salaryLoading}
              style={{ padding: "0.45rem 1.1rem", borderRadius: "8px", border: "none", background: jobTitle.trim() && !salaryLoading ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : "#1e293b", color: jobTitle.trim() && !salaryLoading ? "white" : "#475569", fontSize: "0.78rem", cursor: jobTitle.trim() && !salaryLoading ? "pointer" : "not-allowed", fontFamily: "inherit", fontWeight: 500 }}>
              {salaryLoading ? "Looking up..." : "Get Market Data →"}
            </button>

            {salaryData && !salaryLoading && (
              <div style={{ marginTop: "0.85rem", borderTop: "1px solid #1e293b", paddingTop: "0.85rem", animation: "fadeIn 0.2s ease" }}>
                <div style={{ fontSize: "0.68rem", color: "#334155", marginBottom: "0.6rem" }}>{salaryData.occupation} · {salaryData.location} · {salaryData.source}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem", marginBottom: "0.65rem" }}>
                  {[{ label: "25th Percentile", value: salaryData.p25, color: "#f59e0b" }, { label: "Median (50th)", value: salaryData.median, color: "#3b82f6" }, { label: "75th Percentile", value: salaryData.p75, color: "#10b981" }].map(({ label, value, color }) => (
                    <div key={label} style={{ padding: "0.55rem 0.7rem", background: "#0d1424", borderRadius: "8px", border: `1px solid ${color}22` }}>
                      <div style={{ fontSize: "0.62rem", color: "#475569", marginBottom: "2px" }}>{label}</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 600, color }}>{value ? `$${value.toLocaleString()}` : "—"}</div>
                    </div>
                  ))}
                </div>
                {salaryData.offeredSalary && salaryData.p25 && salaryData.p75 && (
                  <>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "5px" }}>
                      Your offer: <strong style={{ color: "#e2e8f0" }}>${salaryData.offeredSalary.toLocaleString()}</strong> —{" "}
                      <span style={{ color: ["very strong", "strong"].includes(salaryData.negotiationStrength) ? "#10b981" : "#f59e0b" }}>
                        {salaryData.percentileRating} · {salaryData.negotiationStrength} leverage
                      </span>
                    </div>
                    <div style={{ height: "5px", background: "#1e293b", borderRadius: "3px", position: "relative", marginBottom: "0.4rem" }}>
                      {(() => {
                        const min = salaryData.p25 * 0.85, max = salaryData.p75 * 1.15, range = max - min;
                        const p25p = ((salaryData.p25 - min) / range) * 100, p75p = ((salaryData.p75 - min) / range) * 100;
                        const op = Math.min(100, Math.max(0, ((salaryData.offeredSalary - min) / range) * 100));
                        return (<>
                          <div style={{ position: "absolute", left: `${p25p}%`, right: `${100 - p75p}%`, height: "100%", background: "#1d4ed8", borderRadius: "3px" }} />
                          <div style={{ position: "absolute", left: `${op}%`, top: "-4px", width: "13px", height: "13px", background: "#f59e0b", borderRadius: "50%", transform: "translateX(-50%)", border: "2px solid #0d1424" }} />
                        </>);
                      })()}
                    </div>
                  </>
                )}
                <div style={{ fontSize: "0.68rem", color: "#1e293b", marginTop: "0.3rem" }}>✓ Data loaded into your coaching session</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Counter-Offer Calculator Panel ───────────────────────────────────── */}
      <div style={{ padding: "0 1rem 0.4rem", maxWidth: 740, margin: "0 auto", width: "100%" }}>
        <button className="panel-toggle" onClick={() => { setShowCalculator(s => !s); setCurrentStep(p => Math.max(p, 3)); }}
          style={{ width: "100%", padding: "0.55rem 1rem", borderRadius: "10px", border: `1px solid ${showCalculator ? "#6d28d9" : "#1e293b"}`, background: showCalculator ? "rgba(109,40,217,0.08)" : "transparent", color: showCalculator ? "#a78bfa" : "#475569", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.2s" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.9rem" }}>🧮</span>
            <span><strong style={{ color: showCalculator ? "#a78bfa" : "#64748b" }}>Step 3 — Counter-Offer Calculator</strong> <span style={{ color: "#334155" }}>· See your 4-year gain</span></span>
          </span>
          <span style={{ fontSize: "0.7rem", color: "#334155" }}>{showCalculator ? "▲ collapse" : "▼ open"}</span>
        </button>

        {showCalculator && (
          <div style={{ marginTop: "0.4rem", padding: "1rem", background: "#111827", borderRadius: "10px", border: "1px solid #1e293b", animation: "fadeIn 0.18s ease" }}>
            <p style={{ fontSize: "0.75rem", color: "#475569", margin: "0 0 0.75rem", lineHeight: 1.5 }}>
              💡 <strong style={{ color: "#64748b" }}>Tip:</strong> Enter every component of your offer — base, bonus %, equity, and signing. Most people only negotiate base and leave thousands on the table.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.65rem" }}>
              {[{ key: "base", label: "Base Salary ($) *", ph: "e.g. 110000" }, { key: "bonus", label: "Bonus Target (%)", ph: "e.g. 10" }, { key: "equity", label: "Total Equity ($)", ph: "e.g. 80000" }, { key: "equityYears", label: "Vesting Years", ph: "4" }, { key: "signing", label: "Signing Bonus ($)", ph: "e.g. 20000" }, { key: "pto", label: "PTO Days", ph: "15" }].map(({ key, label, ph }) => (
                <div key={key}>
                  <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: "3px" }}>{label}</div>
                  <input type="number" value={offer[key]} onChange={e => setOffer(p => ({ ...p, [key]: e.target.value }))} placeholder={ph} style={inputStyle} />
                </div>
              ))}
            </div>
            <button onClick={calculateCounter} disabled={!offer.base || calcLoading}
              style={{ padding: "0.45rem 1.1rem", borderRadius: "8px", border: "none", background: offer.base && !calcLoading ? "linear-gradient(135deg,#6d28d9,#7c3aed)" : "#1e293b", color: offer.base && !calcLoading ? "white" : "#475569", fontSize: "0.78rem", cursor: offer.base && !calcLoading ? "pointer" : "not-allowed", fontFamily: "inherit", fontWeight: 500 }}>
              {calcLoading ? "Calculating..." : "Calculate Counter-Offer →"}
            </button>

            {counterResult && !calcLoading && (
              <div style={{ marginTop: "0.85rem", borderTop: "1px solid #1e293b", paddingTop: "0.85rem", animation: "fadeIn 0.2s ease" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.75rem" }}>
                  {[{ title: "Their Offer", c: counterResult.current, color: "#64748b", border: "#1e293b" }, { title: "Your Counter", c: counterResult.counter, color: "#a78bfa", border: "#6d28d9" }].map(({ title, c, color, border }) => (
                    <div key={title} style={{ padding: "0.7rem", background: "#0d1424", borderRadius: "8px", border: `1px solid ${border}` }}>
                      <div style={{ fontSize: "0.62rem", color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>{title}</div>
                      {[["Base", `$${c.base.toLocaleString()}`], ["Bonus", c.annualBonus > 0 ? `$${Math.round(c.annualBonus).toLocaleString()}` : "—"], ["Equity/yr", c.annualEquity > 0 ? `$${Math.round(c.annualEquity).toLocaleString()}` : "—"], ["Signing", c.signing > 0 ? `$${c.signing.toLocaleString()}` : "—"]].map(([l, v]) => (
                        <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.73rem", marginBottom: "3px" }}>
                          <span style={{ color: "#475569" }}>{l}</span><span style={{ color }}>{v}</span>
                        </div>
                      ))}
                      <div style={{ borderTop: "1px solid #1e293b", marginTop: "0.4rem", paddingTop: "0.4rem", display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                        <span style={{ color: "#475569" }}>4-Year</span>
                        <span style={{ color, fontWeight: 600 }}>${Math.round(c.total4Year).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "0.65rem 0.9rem", background: "rgba(109,40,217,0.08)", border: "1px solid #6d28d9", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <div style={{ fontSize: "0.72rem", color: "#a78bfa" }}>If you negotiate successfully</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#a78bfa", fontFamily: "'Playfair Display', serif" }}>+${Math.round(counterResult.gap.fourYear).toLocaleString()}</div>
                </div>
                {counterResult.strategy && (
                  <div style={{ padding: "0.7rem", background: "#0d1424", borderRadius: "8px", border: "1px solid #1e293b" }}>
                    <div style={{ fontSize: "0.62rem", color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>Your Strategy</div>
                    <div style={{ fontSize: "0.76rem", color: "#64748b", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{counterResult.strategy}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Outcome Tracker Panel ─────────────────────────────────────────────── */}
      <div style={{ padding: "0 1rem 0.4rem", maxWidth: 740, margin: "0 auto", width: "100%" }}>
        <button className="panel-toggle" onClick={() => { setShowTracker(s => !s); setCurrentStep(p => Math.max(p, 5)); }}
          style={{ width: "100%", padding: "0.55rem 1rem", borderRadius: "10px", border: `1px solid ${showTracker ? "#059669" : "#1e293b"}`, background: showTracker ? "rgba(5,150,105,0.08)" : "transparent", color: showTracker ? "#34d399" : "#475569", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.2s" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.9rem" }}>🏆</span>
            <span><strong style={{ color: showTracker ? "#34d399" : "#64748b" }}>Step 5 — Log Your Win</strong> <span style={{ color: "#334155" }}>· Track your negotiation result</span></span>
            {stats.totalUsers > 0 && <span style={{ fontSize: "0.65rem", background: "rgba(52,211,153,0.1)", color: "#34d399", padding: "1px 6px", borderRadius: "8px", border: "1px solid rgba(52,211,153,0.15)" }}>{stats.totalUsers} wins</span>}
          </span>
          <span style={{ fontSize: "0.7rem", color: "#334155" }}>{showTracker ? "▲ collapse" : "▼ open"}</span>
        </button>

        {showTracker && (
          <div style={{ marginTop: "0.4rem", padding: "1rem", background: "#111827", borderRadius: "10px", border: "1px solid #1e293b", animation: "fadeIn 0.18s ease" }}>
            <p style={{ fontSize: "0.75rem", color: "#475569", margin: "0 0 0.75rem", lineHeight: 1.5 }}>
              💡 <strong style={{ color: "#64748b" }}>Tip:</strong> Log your result — win or not. It feeds into your coaching session and helps you see patterns across negotiations.
            </p>
            {stats.totalUsers > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem", marginBottom: "0.75rem" }}>
                {[{ label: "Total Wins", value: stats.totalUsers.toString(), color: "#34d399" }, { label: "Total Secured", value: stats.totalGained >= 1000000 ? `$${(stats.totalGained / 1000000).toFixed(1)}M` : `$${(stats.totalGained / 1000).toFixed(0)}K`, color: "#34d399" }, { label: "Avg Per Win", value: `$${(stats.avgGain / 1000).toFixed(0)}K`, color: "#a78bfa" }].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: "0.5rem 0.65rem", background: "#0d1424", borderRadius: "7px", border: "1px solid #1e293b", textAlign: "center" }}>
                    <div style={{ fontSize: "0.62rem", color: "#475569", marginBottom: "2px" }}>{label}</div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 600, color }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginBottom: "0.4rem" }}>
              <div>
                <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: "3px" }}>Job Title *</div>
                <input value={newOutcome.role} onChange={e => setNewOutcome(p => ({ ...p, role: e.target.value }))} placeholder="e.g. Product Manager" style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: "3px" }}>Industry</div>
                <select value={newOutcome.industry} onChange={e => setNewOutcome(p => ({ ...p, industry: e.target.value }))} style={{ ...inputStyle, background: "#0d1424" }}>
                  <option value="">Select industry</option>
                  {["Technology", "Finance", "Healthcare", "Marketing", "Consulting", "Education", "Legal", "Sales", "Engineering", "Design", "Other"].map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.4rem", marginBottom: "0.4rem" }}>
              {[{ key: "offeredBase", label: "Offered Base ($)" }, { key: "finalBase", label: "Final Base ($) *" }, { key: "offeredTotal", label: "Offered Total ($)" }, { key: "finalTotal", label: "Final Total ($)" }].map(({ key, label }) => (
                <div key={key}>
                  <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: "3px" }}>{label}</div>
                  <input type="number" value={newOutcome[key]} onChange={e => setNewOutcome(p => ({ ...p, [key]: e.target.value }))} placeholder="0" style={inputStyle} />
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginBottom: "0.65rem" }}>
              <div>
                <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: "3px" }}>Key tactic</div>
                <select value={newOutcome.tactic} onChange={e => setNewOutcome(p => ({ ...p, tactic: e.target.value }))} style={{ ...inputStyle, background: "#0d1424" }}>
                  <option value="">Select tactic</option>
                  {["Competing offer", "Market data / research", "Anchoring high", "Silence / patience", "Bundling (equity + signing)", "Email negotiation", "Walking away", "Other"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: "3px" }}>Note</div>
                <input value={newOutcome.note} onChange={e => setNewOutcome(p => ({ ...p, note: e.target.value }))} placeholder="e.g. They matched my competing offer" style={inputStyle} />
              </div>
            </div>
            {newOutcome.finalBase && newOutcome.offeredBase && (
              <div style={{ padding: "0.45rem 0.7rem", background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.15)", borderRadius: "7px", marginBottom: "0.6rem", fontSize: "0.75rem", color: "#34d399" }}>
                🎉 You negotiated <strong>+${Math.max(0, parseFloat(newOutcome.finalTotal || newOutcome.finalBase || 0) - parseFloat(newOutcome.offeredTotal || newOutcome.offeredBase || 0)).toLocaleString()}</strong> more
              </div>
            )}
            <button onClick={saveOutcome} disabled={!newOutcome.role || !newOutcome.finalBase || trackerLoading}
              style={{ padding: "0.45rem 1.1rem", borderRadius: "8px", border: "none", background: newOutcome.role && newOutcome.finalBase && !trackerLoading ? "linear-gradient(135deg,#059669,#10b981)" : "#1e293b", color: newOutcome.role && newOutcome.finalBase && !trackerLoading ? "white" : "#475569", fontSize: "0.78rem", cursor: newOutcome.role && newOutcome.finalBase && !trackerLoading ? "pointer" : "not-allowed", fontFamily: "inherit", fontWeight: 500 }}>
              {trackerLoading ? "Saving..." : outcomeSaved ? "✓ Win Logged!" : "Log My Win →"}
            </button>
            {outcomes.length > 0 && (
              <div style={{ marginTop: "0.75rem", borderTop: "1px solid #1e293b", paddingTop: "0.75rem" }}>
                <div style={{ fontSize: "0.65rem", color: "#334155", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>Recent Wins</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {outcomes.slice(0, 4).map(o => (
                    <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.45rem 0.65rem", background: "#0d1424", borderRadius: "7px", border: "1px solid #1e293b" }}>
                      <div>
                        <span style={{ fontSize: "0.76rem", color: "#e2e8f0" }}>{o.role}</span>
                        {o.industry && <span style={{ marginLeft: "5px", fontSize: "0.62rem", color: "#334155", background: "#1e293b", padding: "1px 5px", borderRadius: "4px" }}>{o.industry}</span>}
                        {o.tactic && <div style={{ fontSize: "0.62rem", color: "#334155", marginTop: "1px" }}>via {o.tactic}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: o.gained > 0 ? "#34d399" : "#475569" }}>{o.gained > 0 ? `+$${o.gained.toLocaleString()}` : "Better pkg"}</div>
                        <div style={{ fontSize: "0.62rem", color: "#1e293b" }}>{o.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Contextual Prompt Bubbles ─────────────────────────────────────────── */}
      <div style={{ padding: "0 1rem 0.5rem", maxWidth: 740, margin: "0 auto", width: "100%" }}>
        <div style={{ marginBottom: "0.3rem", fontSize: "0.65rem", color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {STEPS.find(s => s.id === currentStep)?.desc || "Suggested prompts"}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {(CONTEXTUAL_PROMPTS[currentStep] || CONTEXTUAL_PROMPTS[1]).map((prompt, i) => (
            <button key={i} className="prompt-btn" onClick={() => sendMessage(prompt)}
              style={{ padding: "0.38rem 0.8rem", borderRadius: "20px", border: "1px solid #1e293b", background: "transparent", color: "#475569", fontSize: "0.74rem", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* ── Input ────────────────────────────────────────────────────────────── */}
      <div style={{ padding: "0.5rem 1rem 1.1rem", borderTop: "1px solid #1e293b", background: "#0d1424" }}>
        <div style={{ maxWidth: 740, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: "0.55rem", alignItems: "flex-end", background: "#111827", border: "1px solid #1e293b", borderRadius: "14px", padding: "0.55rem 0.55rem 0.55rem 0.9rem", transition: "border-color 0.2s" }}
            onFocusCapture={e => e.currentTarget.style.borderColor = "#2563eb"}
            onBlurCapture={e => e.currentTarget.style.borderColor = "#1e293b"}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder={mode === "roleplay" ? "Speak to the recruiter..." : "Describe your offer or ask anything..."}
              rows={1} style={{ flex: 1, background: "transparent", border: "none", color: "#e2e8f0", fontSize: "0.88rem", fontFamily: "inherit", lineHeight: 1.6, maxHeight: 120, overflowY: "auto" }}
              onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }} />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
              style={{ width: 34, height: 34, borderRadius: "9px", border: "none", background: input.trim() && !loading ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : "#1e293b", color: input.trim() && !loading ? "white" : "#334155", cursor: input.trim() && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95rem", flexShrink: 0, transition: "all 0.2s" }}>↑</button>
          </div>
          <p style={{ textAlign: "center", color: "#1e293b", fontSize: "0.62rem", marginTop: "0.4rem" }}>AI coaching — not a substitute for professional financial or legal advice</p>
        </div>
      </div>
    </div>
  );
}
