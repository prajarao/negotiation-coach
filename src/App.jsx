import { useState, useRef, useEffect } from "react";
import { useUser, useAuth, SignInButton, SignUpButton, UserButton } from "@clerk/clerk-react";
import AuthModal from "./AuthModal.jsx";

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

// Personalised version shown when we know the user's name
const welcomeMessageFor = (name) => ({
  role: "assistant",
  content: `# Welcome back, ${name}

Ready to negotiate? Tell me about your offer — role, company, and the numbers on the table. I'll give you the same sharp coaching top executives pay thousands for.`,
});

const TABS = [
  { id: "coach",     label: "Share offer", shortLabel: "Coach",     icon: "coach",     desc: "Tell me about your offer" },
  { id: "benchmark", label: "Benchmark",   shortLabel: "Benchmark", icon: "benchmark", desc: "Compare to market data" },
  { id: "calculate", label: "Calculate",   shortLabel: "Calculate", icon: "calculate", desc: "Build your counter-offer" },
  { id: "practice",  label: "Practice",    shortLabel: "Practice",  icon: "practice",  desc: "Role-play the conversation" },
  { id: "logwin",    label: "Log win",     shortLabel: "Log win",   icon: "logwin",    desc: "Record your result" },
];

const PROMPTS = {
  coach: [
    "I have a job offer I want to evaluate",
    "I want to negotiate a raise at my current job",
    "I have two competing offers to compare",
    "Help me understand my total comp package",
  ],
  benchmark: [
    "Is my offer above or below market rate?",
    "What's the going rate for my role in my city?",
    "How does my equity compare to industry standards?",
  ],
  calculate: [
    "What should I counter with?",
    "Should I negotiate base or equity first?",
    "What's my 4-year gain if I negotiate?",
  ],
  practice: [
    "Role-play: you're the recruiter, I'll practice",
    "What do I say when they ask my salary expectations?",
    "Write me a negotiation email I can send today",
  ],
  logwin: [
    "I successfully negotiated — help me log my win",
    "They didn't budge — what did I learn?",
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
const getCurrencySymbol = (code) => CURRENCIES.find((c) => c.code === code)?.symbol || "$";

// ── Plan definitions ──────────────────────────────────────────────────────────
// Source of truth: Clerk publicMetadata.plan
// Set on sign-up (webhook) and updated after Stripe payment (coming in Step 6)
const PLANS = {
  free:   { label: "Free",         color: "#64748b" },
  sprint: { label: "Offer Sprint", color: "#2563eb" },
  pro:    { label: "Offer in Hand",color: "#7c3aed" },
};

// Features each plan can access
const PLAN_FEATURES = {
  free:   ["coach"],                                               // chat only
  sprint: ["coach", "benchmark", "calculate", "practice", "logwin"],
  pro:    ["coach", "benchmark", "calculate", "practice", "logwin"],
};

// Check if a plan can access a given tab
const canAccess = (plan, tabId) => {
  const allowed = PLAN_FEATURES[plan] || PLAN_FEATURES.free;
  return allowed.includes(tabId);
};

// Usage limits per plan (checked server-side too, this is UI-only)
const USAGE_LIMITS = {
  free:   { sessions: 1,   emails: 1   },
  sprint: { sessions: 999, emails: 999 },
  pro:    { sessions: 999, emails: 999 },
};

// ── Logo mark SVG ────────────────────────────────────────────────────────────
function LogoMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
      <rect width="32" height="32" rx="8" fill="#1d4ed8" />
      <path d="M8 21 L16 10 L24 21" stroke="white" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="16" cy="10" r="2.2" fill="#60a5fa" />
      <line x1="10.5" y1="24.5" x2="21.5" y2="24.5" stroke="white"
        strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function MarkdownText({ text, T, isDark }) {
  const renderLine = (line, i) => {
    if (line.startsWith("# ")) {
      const headingColor = isDark ? "#e2e8f0" : "#1d4ed8";
      return <h1 key={i} style={{ fontSize: "1.25rem", fontWeight: 500, margin: "0.3rem 0 0.5rem", color: headingColor, fontFamily: "'DM Serif Display', serif", letterSpacing: "-0.01em" }}>{line.slice(2)}</h1>;
    }
    if (line.startsWith("## "))
      return <h2 key={i} style={{ fontSize: "0.7rem", fontWeight: 600, margin: "0.8rem 0 0.3rem", color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{line.slice(3)}</h2>;
    if (line.startsWith("### "))
      return <h3 key={i} style={{ fontSize: "0.92rem", fontWeight: 600, margin: "0.5rem 0 0.2rem", color: T.textSecondary }}>{line.slice(4)}</h3>;
    if (line.startsWith("- ")) {
      const c = line.slice(2).replace(/\*\*(.*?)\*\*/g, (_, t) => `<strong style="color:${T.textPrimary}">${t}</strong>`);
      return <li key={i} style={{ margin: "0.2rem 0", color: T.textSecondary, listStyle: "none", paddingLeft: "0.8rem", borderLeft: "2px solid rgba(100,116,139,0.25)" }} dangerouslySetInnerHTML={{ __html: c }} />;
    }
    if (line.trim() === "") return <br key={i} />;
    const c = line
      .replace(/\*\*(.*?)\*\*/g, (_, t) => `<strong style="color:${T.textPrimary}">${t}</strong>`)
      .replace(/\*(.*?)\*/g, (_, t) => `<em style="color:#7dd3fc">${t}</em>`)
      .replace(/`(.*?)`/g, (_, t) => `<code style="background:rgba(100,116,139,0.12);padding:1px 4px;border-radius:3px;font-family:monospace;color:#7dd3fc;font-size:0.8em">${t}</code>`);
    return <p key={i} style={{ margin: "0.25rem 0", color: T.textSecondary, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: c }} />;
  };
  return <div>{text.split("\n").map((l, i) => renderLine(l, i))}</div>;
}

// ── Lock screen for unpaid features ──────────────────────────────────────────
function LockScreen({ title, description, T, onUpgrade, isSignedIn }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 2rem", textAlign: "center" }}>
      <div style={{ width: 52, height: 52, borderRadius: "14px", background: T.cardBg, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.2rem", color: T.textPrimary, marginBottom: "0.6rem" }}>{title}</div>
      <p style={{ fontSize: "0.85rem", color: T.textSecondary, lineHeight: 1.65, maxWidth: 340, marginBottom: "1.5rem" }}>{description}</p>
      <button onClick={onUpgrade}
        style={{ padding: "0.6rem 1.5rem", borderRadius: "10px", border: "none", background: "#1d4ed8", color: "white", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
        {isSignedIn ? "Unlock for $29 →" : "Sign up to unlock →"}
      </button>
      <p style={{ fontSize: "0.72rem", color: T.textMuted, marginTop: "0.6rem" }}>
        {isSignedIn ? "One-time payment · 30 days full access" : "Free account · then unlock for $29"}
      </p>
    </div>
  );
}

// ── Compact chat strip used in tool tabs ──────────────────────────────────────
function ChatStrip({ onSend, loading, T, tabId }) {
  const [stripInput, setStripInput] = useState("");
  const prompts = PROMPTS[tabId] || [];
  const submit = () => {
    if (!stripInput.trim() || loading) return;
    onSend(stripInput.trim());
    setStripInput("");
  };
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, padding: "0.65rem 1rem", background: T.headerBg }}>
      <div style={{ fontSize: "0.63rem", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4rem" }}>Ask the coach</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.5rem" }}>
        {prompts.map((p, i) => (
          <button key={i} onClick={() => onSend(p)}
            style={{ padding: "0.3rem 0.7rem", borderRadius: "16px", border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, fontSize: "0.7rem", cursor: "pointer", fontFamily: "inherit" }}>
            {p}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.45rem", alignItems: "center", background: T.surfaceBg, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "0.4rem 0.4rem 0.4rem 0.75rem" }}>
        <input
          value={stripInput}
          onChange={(e) => setStripInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder="Ask anything about your offer..."
          style={{ flex: 1, background: "transparent", border: "none", color: T.textPrimary, fontSize: "0.84rem", fontFamily: "inherit", outline: "none" }}
        />
        <button onClick={submit} disabled={!stripInput.trim() || loading}
          style={{ width: 30, height: 30, borderRadius: "7px", border: "none", background: stripInput.trim() && !loading ? "#1d4ed8" : T.border, color: stripInput.trim() && !loading ? "white" : T.textMuted, cursor: stripInput.trim() && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.9rem" }}>
          ↑
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OfferAdvisor() {
  // ── Clerk auth ───────────────────────────────────────────────────────────────
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut }                    = useAuth();

  // User's plan comes from Clerk publicMetadata (set by webhook on sign-up,
  // updated by Stripe webhook after payment)
  const clerkPlan = (user?.publicMetadata?.plan) || "free";

  // ── Admin / test override ─────────────────────────────────────────────────
  // Set via localStorage so you can test locked screens without real payments.
  // Open browser console and run:
  //   localStorage.setItem("oa_admin_plan", "pro")   → unlock everything
  //   localStorage.setItem("oa_admin_plan", "sprint") → Offer Sprint
  //   localStorage.setItem("oa_admin_plan", "free")  → back to free
  //   localStorage.removeItem("oa_admin_plan")        → use real Clerk plan
  const [adminPlan, setAdminPlan] = useState(() => localStorage.getItem("oa_admin_plan") || null);

  // Admin toolbar state
  const [showAdminBar, setShowAdminBar] = useState(() => !!localStorage.getItem("oa_admin_plan"));

  const userPlan = adminPlan || clerkPlan;
  const userName = adminPlan ? "Admin" : (user?.firstName || user?.username || null);

  // Allow toggling plan from admin bar
  const setTestPlan = (plan) => {
    if (plan === "off") {
      localStorage.removeItem("oa_admin_plan");
      setAdminPlan(null);
      setShowAdminBar(false);
    } else {
      localStorage.setItem("oa_admin_plan", plan);
      setAdminPlan(plan);
      setShowAdminBar(true);
    }
  };

  // Auth modal state
  const [authModal, setAuthModal] = useState(null); // null | "signin" | "signup" | "upgrade"

  // Stripe return — detect ?checkout=success in URL after payment
  const [checkoutSuccess, setCheckoutSuccess] = useState(null); // null | "sprint" | "pro"

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("checkout");
    const plan   = params.get("plan");
    if (status === "success" && plan) {
      setCheckoutSuccess(plan);
      // Clean URL so refresh doesn't re-trigger
      window.history.replaceState({}, "", window.location.pathname);
      // Auto-dismiss after 8s
      setTimeout(() => setCheckoutSuccess(null), 8000);
    }
  }, []);

  // Helper — open sign-in wall when a gated action is attempted
  const requireAuth = (cb) => {
    if (!isSignedIn) { setAuthModal("signin"); return; }
    cb();
  };

  // Helper — open upgrade wall when a paid feature is attempted
  const requirePlan = (tabId, cb) => {
    if (!isSignedIn) { setAuthModal("signin"); return; }
    if (!canAccess(userPlan, tabId)) {
      // In Step 6 this will open Stripe checkout — for now, sign-up prompt
      setAuthModal("upgrade");
      return;
    }
    cb();
  };
  const [activeTab, setActiveTab] = useState("coach");
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("coach");

  // Personalise welcome message once Clerk has loaded the user
  useEffect(() => {
    if (isLoaded && isSignedIn && userName) {
      setMessages(prev => {
        // Only replace the initial welcome — don't touch if conversation has started
        if (prev.length === 1 && prev[0] === WELCOME_MESSAGE) {
          return [welcomeMessageFor(userName)];
        }
        return prev;
      });
    }
  }, [isLoaded, isSignedIn, userName]);

  const [isDark, setIsDark] = useState(() => {
    const s = localStorage.getItem("offeradvisor_theme");
    return s ? s === "dark" : true;
  });

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  const T = {
    pageBg:         isDark ? "#0a0f1a" : "#f1f5f9",
    headerBg:       isDark ? "#0d1424" : "#ffffff",
    surfaceBg:      isDark ? "#111827" : "#ffffff",
    inputBg:        isDark ? "#0d1424" : "#f8fafc",
    cardBg:         isDark ? "#0d1424" : "#f0f4f8",
    panelBg:        isDark ? "#111827" : "#ffffff",
    border:         isDark ? "#1e293b" : "#d1d9e0",
    textPrimary:    isDark ? "#e2e8f0" : "#0d1117",
    textSecondary:  isDark ? "#94a3b8" : "#24292f",
    textMuted:      isDark ? "#64748b" : "#57606a",
    textHint:       isDark ? "#334155" : "#8c959f",
  };

  // Salary benchmark state
  const [salaryData,     setSalaryData]     = useState(null);
  const [salaryLoading,  setSalaryLoading]  = useState(false);
  const [jobTitle,       setJobTitle]       = useState("");
  const [jobLocation,    setJobLocation]    = useState("");
  const [offeredSalary,  setOfferedSalary]  = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [lastRole,       setLastRole]       = useState("");
  const [lastLocation,   setLastLocation]   = useState("");

  // Calculator state
  const [calcLoading,   setCalcLoading]   = useState(false);
  const [counterResult, setCounterResult] = useState(null);
  const [offer, setOffer] = useState({ base: "", bonus: "", equity: "", equityYears: "4", signing: "", pto: "15" });

  // Tracker state
  const STORAGE_KEY = "offeradvisor_outcomes";
  const [outcomes,     setOutcomes]     = useState([]);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [outcomeSaved, setOutcomeSaved] = useState(false);
  const [newOutcome,   setNewOutcome]   = useState({ role: "", industry: "", offeredBase: "", finalBase: "", offeredTotal: "", finalTotal: "", tactic: "", note: "" });
  const [stats,        setStats]        = useState({ totalUsers: 0, totalGained: 0, avgGain: 0 });

  const bottomRef     = useRef(null);
  const inputRef      = useRef(null);
  const chatScrollRef = useRef(null);
  const userSentRef   = useRef(false);

  useEffect(() => {
    const seen = localStorage.getItem("offeradvisor_onboarding_seen");
    if (!seen) setShowOnboarding(true);
    loadOutcomes();
  }, []);

  // Scroll to bottom ONLY when the user sends a message.
  // When the AI responds, the user can read without the view jumping.
  useEffect(() => {
    if (userSentRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      userSentRef.current = false;
    }
  }, [messages]);

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setIsDark(!isDark);
    localStorage.setItem("offeradvisor_theme", next);
  };

  const loadOutcomes = () => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        const d = JSON.parse(s);
        setOutcomes(d.outcomes || []);
        computeStats(d.outcomes || []);
      }
    } catch (e) { setOutcomes([]); }
  };

  const computeStats = (list) => {
    if (!list.length) return;
    const nonZero = (p, f) => { const v = (p || "").trim(); return v !== "" && v !== "0" ? parseFloat(v) : parseFloat(f || 0); };
    const totalGained = list.reduce((s, o) => s + (nonZero(o.finalTotal, o.finalBase) - nonZero(o.offeredTotal, o.offeredBase)), 0);
    setStats({ totalUsers: list.length, totalGained: Math.round(totalGained), avgGain: Math.round(totalGained / list.length) });
  };

  // ── Core send message ────────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    const userText = (text || input || "").trim();
    if (!userText || loading) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setLoading(true);
    userSentRef.current = true; // scroll to bottom for user's own message only

    if (jobTitle) setLastRole(jobTitle);
    if (jobLocation) setLastLocation(jobLocation);

    const systemPrompt = mode === "roleplay"
      ? SYSTEM_PROMPT + "\n\nIMPORTANT: You are now role-playing as a recruiter named Alex. Stay in character. Push back realistically. After each exchange add a brief [Coach Note] with tactical feedback."
      : SYSTEM_PROMPT;

    const apiMessages = newMessages
      .filter((m) => m !== WELCOME_MESSAGE && ["user", "assistant"].includes(m.role))
      .map((m) => ({ role: m.role, content: m.content }));
    if (apiMessages.length > 0 && apiMessages[0].role === "assistant") apiMessages.shift();

    const messagesToSend = apiMessages.length > 0 ? apiMessages : [{ role: "user", content: userText }];

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: systemPrompt, messages: messagesToSend }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const reply = data.content?.[0]?.text || "Something went wrong. Please try again.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages([...newMessages, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
      if (activeTab === "coach") inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Salary lookup ────────────────────────────────────────────────────────────
  const lookupSalary = async () => {
    if (!jobTitle.trim()) return;
    setSalaryLoading(true);
    setSalaryData(null);
    const locLower = jobLocation.toLowerCase();
    const autoCurrency =
      locLower.includes("uk") || locLower.includes("london") || locLower.includes("england") || locLower.includes("manchester") || locLower.includes("edinburgh") || locLower.includes("glasgow") ? "GBP"
      : locLower.includes("india") || locLower.includes("bangalore") || locLower.includes("bengaluru") || locLower.includes("mumbai") || locLower.includes("delhi") || locLower.includes("hyderabad") || locLower.includes("pune") ? "INR"
      : locLower.includes("europe") || locLower.includes("germany") || locLower.includes("france") || locLower.includes("berlin") || locLower.includes("paris") ? "EUR"
      : locLower.includes("canada") || locLower.includes("toronto") || locLower.includes("vancouver") ? "CAD"
      : locLower.includes("australia") || locLower.includes("sydney") || locLower.includes("melbourne") ? "AUD"
      : locLower.includes("singapore") ? "SGD"
      : locLower.includes("dubai") || locLower.includes("uae") ? "AED"
      : selectedCurrency;
    setSelectedCurrency(autoCurrency);
    setLastRole(jobTitle);
    setLastLocation(jobLocation);
    try {
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle: jobTitle.trim(), location: jobLocation.trim() || "United States", offeredSalary: offeredSalary ? parseFloat(offeredSalary) : null, currency: autoCurrency }),
      });
      const data = await res.json();
      setSalaryData(data);
      if (data.median) {
        const sym = data.currencySymbol || getCurrencySymbol(autoCurrency);
        await sendMessage(`[Market Data] ${data.occupation} in ${data.location}: 25th=${sym}${data.p25?.toLocaleString()}, Median=${sym}${data.median?.toLocaleString()}, 75th=${sym}${data.p75?.toLocaleString()}. ${offeredSalary ? `Offer of ${sym}${parseFloat(offeredSalary).toLocaleString()} is ${data.percentileRating} — ${data.negotiationStrength} leverage. ` : ""}Source: ${data.source}`);
      }
    } catch (e) { console.error("Salary error:", e); }
    finally { setSalaryLoading(false); }
  };

  // ── Counter calculator ───────────────────────────────────────────────────────
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
      const fourYearGap = counterTotal4Year - total4Year;
      const aiRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: "You are an elite salary negotiation coach. Write a sharp strategy in 3 short sections: 1. YOUR LEVERAGE 2. COUNTER SCRIPT (exact words) 3. FALLBACK MOVE", messages: [{ role: "user", content: `Offer: Base $${base.toLocaleString()}, Bonus ${bonusPct}%, Equity $${equityTotal.toLocaleString()}/${equityYears}yr, Signing $${signing.toLocaleString()}. Counter: Base $${counterBase.toLocaleString()}, Signing $${counterSigning.toLocaleString()}. 4yr gain: $${fourYearGap.toLocaleString()}.` }] }),
      });
      const aiData = await aiRes.json();
      setCounterResult({ current: { base, annualBonus, annualEquity, signing, totalAnnual, total4Year }, counter: { base: counterBase, annualBonus: counterAnnualBonus, annualEquity: counterAnnualEquity, signing: counterSigning, totalAnnual: counterTotalAnnual, total4Year: counterTotal4Year }, gap: { annual: counterTotalAnnual - totalAnnual, fourYear: fourYearGap }, strategy: aiData.content?.[0]?.text || "" });
      await sendMessage(`[Counter Calculated] Current: $${totalAnnual.toLocaleString()}/yr. Counter: $${counterTotalAnnual.toLocaleString()}/yr. That's $${fourYearGap.toLocaleString()} more over 4 years. What's my best opening line?`);
    } catch (e) { console.error("Calc error:", e); }
    finally { setCalcLoading(false); }
  };

  // ── Save outcome ─────────────────────────────────────────────────────────────
  const saveOutcome = async () => {
    if (!newOutcome.role || !newOutcome.finalBase) return;
    setTrackerLoading(true);
    try {
      let existing = [];
      try { const s = localStorage.getItem(STORAGE_KEY); if (s) existing = JSON.parse(s).outcomes || []; } catch (e) {}
      const nonZero = (p, f) => { const v = (p || "").trim(); return v !== "" && v !== "0" ? parseFloat(v) : parseFloat(f || 0); };
      const entry = { ...newOutcome, id: Date.now().toString(), date: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }), gained: Math.round(nonZero(newOutcome.finalTotal, newOutcome.finalBase) - nonZero(newOutcome.offeredTotal, newOutcome.offeredBase)) };
      const updated = [entry, ...existing];
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ outcomes: updated }));
      setOutcomes(updated);
      computeStats(updated);
      setOutcomeSaved(true);
      setNewOutcome({ role: "", industry: "", offeredBase: "", finalBase: "", offeredTotal: "", finalTotal: "", tactic: "", note: "" });
      await sendMessage(`Win logged! ${entry.role}${entry.industry ? ` (${entry.industry})` : ""}. Negotiated ${entry.gained > 0 ? `$${entry.gained.toLocaleString()}` : "a better package"} more. What should I know for my next negotiation?`);
      setTimeout(() => setOutcomeSaved(false), 3000);
    } catch (e) { console.error("Save error:", e); }
    finally { setTrackerLoading(false); }
  };

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("offeradvisor_onboarding_seen", "true");
  };

  const onboardingSlides = [
    { title: "Welcome to OfferAdvisor", body: "AI-powered negotiation coaching that gives you the same sharp advice top executives pay thousands for — in minutes.", cta: "How does it work?" },
    { title: "Start by sharing your offer", body: "Type anything about your situation in the chat. Role, company, offer numbers. The coach asks the right questions.", cta: "Got it" },
    { title: "Then benchmark your numbers", body: "Use the Benchmark tab to see where your offer sits against real market data — by role, city, and country.", cta: "Makes sense" },
    { title: "Build your counter-offer", body: "The Calculate tab shows exactly what to counter with and your 4-year financial gain if you negotiate.", cta: "Love it" },
    { title: "Practice the conversation", body: "Switch to Practice and the AI plays your recruiter. Get coached after every exchange — for free.", cta: "Let's go" },
  ];

  // ── Shared style helpers ──────────────────────────────────────────────────────
  const inputStyle  = { width: "100%", padding: "0.5rem 0.7rem", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: "8px", color: T.textPrimary, fontSize: "0.8rem", fontFamily: "inherit", boxSizing: "border-box" };
  const selectStyle = { ...inputStyle };
  const primaryBtn  = (active, grad = "#1d4ed8") => ({ padding: "0.45rem 1.1rem", borderRadius: "8px", border: "none", background: active ? grad : T.border, color: active ? "white" : T.textMuted, fontSize: "0.78rem", cursor: active ? "pointer" : "not-allowed", fontFamily: "inherit", fontWeight: 500 });
  const symDisplay  = salaryData?.currencySymbol || getCurrencySymbol(selectedCurrency);

  // ── Render tab content ────────────────────────────────────────────────────────
  const renderTabContent = () => {
    // For tool tabs: show LockScreen if user doesn't have access
    if (activeTab !== "coach" && !canAccess(userPlan, activeTab)) {
      const tab = TABS.find(t => t.id === activeTab);
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <LockScreen
            title={tab?.label || "Premium feature"}
            description={
              !isSignedIn
                ? "Create a free account to get started, then unlock all tools for $29."
                : "Unlock all tools — salary benchmarking, counter calculator, role-play, and outcome tracking — for a one-time $29 payment."
            }
            T={T}
            isSignedIn={isSignedIn}
            onUpgrade={() => setAuthModal(isSignedIn ? "upgrade" : "signup")}
          />
          <ChatStrip onSend={sendMessage} loading={loading} T={T} tabId={activeTab} />
        </div>
      );
    }

    switch (activeTab) {
      // ── COACH TAB — full chat ─────────────────────────────────────────────
      case "coach": return (
        <>
          <div style={{ flex: 1, overflowY: "auto", padding: "1.1rem 1rem" }}>
            <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", animation: "fadeIn 0.2s ease" }}>
                  {msg.role === "assistant" && (
                    <div style={{ width: 26, height: 26, borderRadius: "7px", background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: "0.5rem", marginTop: "0.1rem" }}>
                      <svg width="15" height="15" viewBox="0 0 32 32" fill="none"><path d="M8 21L16 10L24 21" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /><circle cx="16" cy="10" r="2.2" fill="#60a5fa" /></svg>
                    </div>
                  )}
                  <div style={{ maxWidth: "82%", padding: msg.role === "user" ? "0.55rem 0.85rem" : "0.85rem 1rem", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "4px 14px 14px 14px", background: msg.role === "user" ? "#1d4ed8" : T.surfaceBg, border: msg.role === "assistant" ? `1px solid ${T.border}` : "none" }}>
                    {msg.role === "user"
                      ? <p style={{ margin: 0, fontSize: "0.87rem", color: "white", lineHeight: 1.6 }}>{msg.content}</p>
                      : <MarkdownText text={msg.content} T={T} isDark={isDark} />}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", animation: "fadeIn 0.2s ease" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "7px", background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="15" height="15" viewBox="0 0 32 32" fill="none"><path d="M8 21L16 10L24 21" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /><circle cx="16" cy="10" r="2.2" fill="#60a5fa" /></svg>
                  </div>
                  <div style={{ display: "flex", gap: "4px", padding: "0.65rem 0.85rem", background: T.surfaceBg, borderRadius: "4px 14px 14px 14px", border: `1px solid ${T.border}` }}>
                    {[0, 1, 2].map((n) => <div key={n} style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite` }} />)}
                  </div>
                </div>
              )}
              {messages.length > 2 && !loading && (lastRole || jobTitle) && (
                <div style={{ paddingLeft: "38px" }}>
                  <a href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(lastRole || jobTitle)}&location=${encodeURIComponent(lastLocation || jobLocation || "")}&f_TPR=r604800`} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "0.35rem 0.85rem", borderRadius: "16px", border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, fontSize: "0.71rem", textDecoration: "none", fontFamily: "inherit" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0077b5"; e.currentTarget.style.color = "#0077b5"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#0077b5" style={{ flexShrink: 0 }}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                    See jobs paying more for {lastRole || jobTitle} →
                  </a>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Sign-in nudge — shown to guests after they've had their first exchange */}
          {!isSignedIn && messages.length >= 3 && (
            <div style={{ margin: "0 1rem 0.75rem", maxWidth: 720, width: "calc(100% - 2rem)", alignSelf: "center" }}>
              <div style={{ padding: "0.85rem 1rem", background: isDark ? "rgba(29,78,216,0.08)" : "#EFF6FF", border: "1px solid rgba(29,78,216,0.2)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 500, color: T.textPrimary, marginBottom: "2px" }}>Save your coaching session</div>
                  <div style={{ fontSize: "0.74rem", color: T.textSecondary }}>Sign up free to continue — your conversation won't be lost.</div>
                </div>
                <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                  <button onClick={() => setAuthModal("signin")}
                    style={{ padding: "0.38rem 0.85rem", borderRadius: "8px", border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit" }}>
                    Sign in
                  </button>
                  <button onClick={() => setAuthModal("signup")}
                    style={{ padding: "0.38rem 0.85rem", borderRadius: "8px", border: "none", background: "#1d4ed8", color: "white", fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                    Sign up free →
                  </button>
                </div>
              </div>
            </div>
          )}
          <div style={{ padding: "0 1rem 0.5rem", maxWidth: 720, margin: "0 auto", width: "100%" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {PROMPTS.coach.map((p, i) => (
                <button key={i} onClick={() => sendMessage(p)}
                  style={{ padding: "0.35rem 0.75rem", borderRadius: "16px", border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit" }}>
                  {p}
                </button>
              ))}
              <button onClick={() => { setMode((m) => m === "roleplay" ? "coach" : "roleplay"); setMessages((p) => [...p, { role: "assistant", content: mode === "coach" ? "**Role-play mode on.** I'm Alex, your recruiter. What role are we discussing?" : "**Coach mode restored.** What do you want to work on?" }]); setActiveTab("coach"); }}
                style={{ padding: "0.35rem 0.75rem", borderRadius: "16px", border: `1px solid ${mode === "roleplay" ? "#7c3aed" : T.border}`, background: mode === "roleplay" ? "rgba(124,58,237,0.1)" : "transparent", color: mode === "roleplay" ? "#a78bfa" : T.textMuted, fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit", fontWeight: mode === "roleplay" ? 500 : 400 }}>
                {mode === "roleplay" ? "🎭 Role-play ON" : "🎭 Role-play mode"}
              </button>
            </div>
          </div>

          {/* Main input */}
          <div style={{ padding: "0.45rem 1rem 1rem", borderTop: `1px solid ${T.border}`, background: T.headerBg }}>
            <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", gap: "0.5rem", alignItems: "flex-end", background: T.surfaceBg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "0.5rem 0.5rem 0.5rem 0.85rem" }}>
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
                placeholder={mode === "roleplay" ? "Speak to the recruiter, Alex..." : "Describe your offer or ask anything..."}
                rows={1}
                style={{ flex: 1, background: "transparent", border: "none", color: T.textPrimary, fontSize: "0.87rem", fontFamily: "inherit", lineHeight: 1.6, maxHeight: 120, overflowY: "auto", resize: "none", outline: "none" }}
                onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }} />
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                style={{ width: 32, height: 32, borderRadius: "8px", border: "none", background: input.trim() && !loading ? "#1d4ed8" : T.border, color: input.trim() && !loading ? "white" : T.textMuted, cursor: input.trim() && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", flexShrink: 0 }}>↑</button>
            </div>
            <p style={{ textAlign: "center", color: T.textHint, fontSize: "0.6rem", marginTop: "0.35rem", maxWidth: 720, margin: "0.35rem auto 0" }}>
              AI coaching — not a substitute for professional financial or legal advice
            </p>
          </div>
        </>
      );

      // ── BENCHMARK TAB ─────────────────────────────────────────────────────
      case "benchmark": return (
        <>
          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1rem" }}>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.3rem", color: T.textPrimary, marginBottom: "0.3rem" }}>Salary benchmark</h2>
              <p style={{ fontSize: "0.82rem", color: T.textSecondary, marginBottom: "1.25rem", lineHeight: 1.6 }}>Enter your role and location to see exactly where your offer sits against real market data. Supports US (BLS), UK (ONS), India, and more. Currency is auto-detected from location.</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <div>
                  <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>Job title *</div>
                  <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Product Manager" style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>Location</div>
                  <input value={jobLocation} onChange={(e) => setJobLocation(e.target.value)} placeholder="e.g. London UK · Bangalore India · Austin TX" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div>
                  <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>Currency</div>
                  <select value={selectedCurrency} onChange={(e) => setSelectedCurrency(e.target.value)} style={selectStyle}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>Offered salary ({getCurrencySymbol(selectedCurrency)}){selectedCurrency === "INR" && <span style={{ color: T.textHint }}> — annual CTC e.g. 1200000 for 12 LPA</span>}</div>
                  <input value={offeredSalary} onChange={(e) => setOfferedSalary(e.target.value)} placeholder={selectedCurrency === "INR" ? "e.g. 1200000" : selectedCurrency === "GBP" ? "e.g. 55000" : "e.g. 95000"} type="number" style={inputStyle} />
                </div>
              </div>
              <button onClick={lookupSalary} disabled={!jobTitle.trim() || salaryLoading} style={primaryBtn(jobTitle.trim() && !salaryLoading)}>
                {salaryLoading ? "Looking up..." : "Get market data →"}
              </button>

              {salaryData && !salaryLoading && (
                <div style={{ marginTop: "1.25rem", borderTop: `1px solid ${T.border}`, paddingTop: "1rem", animation: "fadeIn 0.2s ease" }}>
                  <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "0.65rem" }}>{salaryData.occupation} · {salaryData.location} · {salaryData.source}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.65rem" }}>
                    {[{ label: "25th percentile", value: salaryData.p25, color: "#f59e0b" }, { label: "Median (50th)", value: salaryData.median, color: "#3b82f6" }, { label: "75th percentile", value: salaryData.p75, color: "#10b981" }].map(({ label, value, color }) => (
                      <div key={label} style={{ padding: "0.6rem 0.75rem", background: T.cardBg, borderRadius: "8px", border: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: "0.62rem", color: T.textMuted, marginBottom: "3px" }}>{label}</div>
                        <div style={{ fontSize: "1rem", fontWeight: 600, color }}>{value ? `${symDisplay}${value.toLocaleString()}` : "—"}</div>
                      </div>
                    ))}
                  </div>
                  {salaryData.offeredSalary && salaryData.p25 && (
                    <div style={{ padding: "0.55rem 0.8rem", background: T.cardBg, borderRadius: "8px", border: `1px solid ${T.border}`, fontSize: "0.75rem" }}>
                      Your offer <strong style={{ color: T.textPrimary }}>{symDisplay}{salaryData.offeredSalary.toLocaleString()}</strong> is{" "}
                      <span style={{ color: ["very strong", "strong"].includes(salaryData.negotiationStrength) ? "#10b981" : "#f59e0b" }}>
                        {salaryData.percentileRating} · {salaryData.negotiationStrength} leverage
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <ChatStrip onSend={sendMessage} loading={loading} T={T} tabId="benchmark" />
        </>
      );

      // ── CALCULATE TAB ─────────────────────────────────────────────────────
      case "calculate": return (
        <>
          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1rem" }}>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.3rem", color: T.textPrimary, marginBottom: "0.3rem" }}>Counter-offer calculator</h2>
              <p style={{ fontSize: "0.82rem", color: T.textSecondary, marginBottom: "1.25rem", lineHeight: 1.6 }}>Enter every component of your offer. Most people only negotiate base and leave equity, signing, and bonus on the table — this shows your full 4-year gain.</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                {[{ key: "base", label: "Base salary *", ph: "e.g. 110000" }, { key: "bonus", label: "Bonus target (%)", ph: "e.g. 10" }, { key: "equity", label: "Total equity ($)", ph: "e.g. 80000" }, { key: "equityYears", label: "Vesting years", ph: "4" }, { key: "signing", label: "Signing bonus", ph: "e.g. 20000" }, { key: "pto", label: "PTO days", ph: "15" }].map(({ key, label, ph }) => (
                  <div key={key}>
                    <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>{label}</div>
                    <input type="number" value={offer[key]} onChange={(e) => setOffer((p) => ({ ...p, [key]: e.target.value }))} placeholder={ph} style={inputStyle} />
                  </div>
                ))}
              </div>
              <button onClick={calculateCounter} disabled={!offer.base || calcLoading} style={{ ...primaryBtn(offer.base && !calcLoading, "#6d28d9"), marginBottom: "0" }}>
                {calcLoading ? "Calculating..." : "Calculate counter-offer →"}
              </button>

              {counterResult && !calcLoading && (
                <div style={{ marginTop: "1.25rem", borderTop: `1px solid ${T.border}`, paddingTop: "1rem", animation: "fadeIn 0.2s ease" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.75rem" }}>
                    {[{ title: "Their offer", c: counterResult.current, color: T.textSecondary, border: T.border }, { title: "Your counter", c: counterResult.counter, color: "#a78bfa", border: "#7c3aed" }].map(({ title, c, color, border }) => (
                      <div key={title} style={{ padding: "0.75rem", background: T.cardBg, borderRadius: "8px", border: `1px solid ${border}` }}>
                        <div style={{ fontSize: "0.62rem", color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>{title}</div>
                        {[["Base", `$${c.base.toLocaleString()}`], ["Bonus/yr", c.annualBonus > 0 ? `$${Math.round(c.annualBonus).toLocaleString()}` : "—"], ["Equity/yr", c.annualEquity > 0 ? `$${Math.round(c.annualEquity).toLocaleString()}` : "—"], ["Signing", c.signing > 0 ? `$${c.signing.toLocaleString()}` : "—"]].map(([l, v]) => (
                          <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.73rem", marginBottom: "3px" }}>
                            <span style={{ color: T.textMuted }}>{l}</span><span style={{ color }}>{v}</span>
                          </div>
                        ))}
                        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: "0.35rem", paddingTop: "0.35rem", display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                          <span style={{ color: T.textMuted }}>4-year total</span>
                          <span style={{ color, fontWeight: 600 }}>${Math.round(c.total4Year).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "0.65rem 0.9rem", background: "rgba(109,40,217,0.07)", border: "1px solid #7c3aed", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "#a78bfa" }}>If you negotiate successfully</span>
                    <span style={{ fontSize: "1.3rem", fontWeight: 600, color: "#a78bfa", fontFamily: "'DM Serif Display', serif" }}>+${Math.round(counterResult.gap.fourYear).toLocaleString()}</span>
                  </div>
                  {counterResult.strategy && (
                    <div style={{ padding: "0.75rem", background: T.cardBg, borderRadius: "8px", border: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: "0.62rem", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>Your strategy</div>
                      <div style={{ fontSize: "0.76rem", color: T.textSecondary, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{counterResult.strategy}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <ChatStrip onSend={sendMessage} loading={loading} T={T} tabId="calculate" />
        </>
      );

      // ── PRACTICE TAB ──────────────────────────────────────────────────────
      case "practice": return (
        <>
          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1rem" }}>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.3rem", color: T.textPrimary, marginBottom: "0.3rem" }}>Practice the conversation</h2>
              <p style={{ fontSize: "0.82rem", color: T.textSecondary, marginBottom: "1.25rem", lineHeight: 1.6 }}>The AI plays Alex, your recruiter. Have the real conversation — push back, ask questions, handle objections. After every exchange you get a coach note on what you did well and what to sharpen.</p>
              <div style={{ padding: "1rem", background: T.cardBg, borderRadius: "10px", border: `1px solid ${mode === "roleplay" ? "#7c3aed" : T.border}`, marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.65rem" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 500, color: T.textPrimary }}>Recruiter role-play</div>
                  {mode === "roleplay" && <span style={{ fontSize: "0.65rem", padding: "2px 7px", background: "rgba(124,58,237,0.12)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)", borderRadius: "8px" }}>Active</span>}
                </div>
                <p style={{ fontSize: "0.78rem", color: T.textSecondary, margin: "0 0 0.75rem", lineHeight: 1.55 }}>When active, the AI plays a realistic recruiter named Alex. Messages are typed in the chat below — you'll see [Coach Note] feedback after each response.</p>
                <button onClick={() => {
                  const next = mode === "roleplay" ? "coach" : "roleplay";
                  setMode(next);
                  setMessages((p) => [...p, { role: "assistant", content: next === "roleplay" ? "**Role-play mode on.** I'm Alex, your recruiter. Which role and company are we discussing? I'll push back the way a real recruiter would." : "**Coach mode restored.** Great practice. What would you like to refine?" }]);
                }}
                  style={{ padding: "0.45rem 1rem", borderRadius: "8px", border: "none", background: mode === "roleplay" ? "rgba(124,58,237,0.12)" : "#1d4ed8", color: mode === "roleplay" ? "#a78bfa" : "white", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 500, border: mode === "roleplay" ? "1px solid #7c3aed" : "none" }}>
                  {mode === "roleplay" ? "Stop role-play" : "Start role-play with Alex →"}
                </button>
              </div>
              <div style={{ fontSize: "0.68rem", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>Opening lines to practise</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {["Hi Alex, I've reviewed the offer and I'd like to discuss the compensation", "I have a competing offer I wanted to mention", "Is there flexibility on the base salary?", "Can we discuss the equity package?"].map((p) => (
                  <button key={p} onClick={() => { if (mode !== "roleplay") { setMode("roleplay"); } sendMessage(p); setActiveTab("practice"); }}
                    style={{ padding: "0.38rem 0.8rem", borderRadius: "16px", border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit" }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <ChatStrip onSend={(t) => { if (mode !== "roleplay") setMode("roleplay"); sendMessage(t); }} loading={loading} T={T} tabId="practice" />
        </>
      );

      // ── LOG WIN TAB ───────────────────────────────────────────────────────
      case "logwin": return (
        <>
          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1rem" }}>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.3rem", color: T.textPrimary, marginBottom: "0.3rem" }}>Log your win</h2>
              <p style={{ fontSize: "0.82rem", color: T.textSecondary, marginBottom: "1.25rem", lineHeight: 1.6 }}>Record your negotiation result — whether you won big or learned something. It feeds back into your coaching and builds your personal record over time.</p>

              {stats.totalUsers > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
                  {[{ label: "Total wins", value: stats.totalUsers.toString(), color: "#34d399" }, { label: "Total secured", value: stats.totalGained >= 1000000 ? `$${(stats.totalGained / 1000000).toFixed(1)}M` : `$${(stats.totalGained / 1000).toFixed(0)}K`, color: "#34d399" }, { label: "Avg per win", value: `$${(stats.avgGain / 1000).toFixed(0)}K`, color: "#a78bfa" }].map(({ label, value, color }) => (
                    <div key={label} style={{ padding: "0.6rem 0.75rem", background: T.cardBg, borderRadius: "8px", border: `1px solid ${T.border}`, textAlign: "center" }}>
                      <div style={{ fontSize: "0.62rem", color: T.textMuted, marginBottom: "2px" }}>{label}</div>
                      <div style={{ fontSize: "1rem", fontWeight: 600, color }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginBottom: "0.4rem" }}>
                <div><div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>Job title *</div><input value={newOutcome.role} onChange={(e) => setNewOutcome((p) => ({ ...p, role: e.target.value }))} placeholder="e.g. Product Manager" style={inputStyle} /></div>
                <div><div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>Industry</div>
                  <select value={newOutcome.industry} onChange={(e) => setNewOutcome((p) => ({ ...p, industry: e.target.value }))} style={selectStyle}>
                    <option value="">Select industry</option>
                    {["Technology", "Finance", "Healthcare", "Marketing", "Consulting", "Education", "Legal", "Sales", "Engineering", "Design", "Other"].map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.4rem", marginBottom: "0.4rem" }}>
                {[{ key: "offeredBase", label: "Offered base" }, { key: "finalBase", label: "Final base *" }, { key: "offeredTotal", label: "Offered total" }, { key: "finalTotal", label: "Final total" }].map(({ key, label }) => (
                  <div key={key}><div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>{label}</div><input type="number" value={newOutcome[key]} onChange={(e) => setNewOutcome((p) => ({ ...p, [key]: e.target.value }))} placeholder="0" style={inputStyle} /></div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginBottom: "0.75rem" }}>
                <div><div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>Key tactic</div>
                  <select value={newOutcome.tactic} onChange={(e) => setNewOutcome((p) => ({ ...p, tactic: e.target.value }))} style={selectStyle}>
                    <option value="">Select tactic</option>
                    {["Competing offer", "Market data / research", "Anchoring high", "Silence / patience", "Bundling (equity + signing)", "Email negotiation", "Walking away", "Other"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "3px" }}>Note</div><input value={newOutcome.note} onChange={(e) => setNewOutcome((p) => ({ ...p, note: e.target.value }))} placeholder="e.g. They matched my competing offer" style={inputStyle} /></div>
              </div>
              {newOutcome.finalBase && newOutcome.offeredBase && (
                <div style={{ padding: "0.45rem 0.75rem", background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "7px", marginBottom: "0.6rem", fontSize: "0.75rem", color: "#34d399" }}>
                  You negotiated <strong>+${Math.max(0, parseFloat(newOutcome.finalTotal || newOutcome.finalBase || 0) - parseFloat(newOutcome.offeredTotal || newOutcome.offeredBase || 0)).toLocaleString()}</strong> more
                </div>
              )}
              <button onClick={saveOutcome} disabled={!newOutcome.role || !newOutcome.finalBase || trackerLoading}
                style={primaryBtn(newOutcome.role && newOutcome.finalBase && !trackerLoading, "#059669")}>
                {trackerLoading ? "Saving..." : outcomeSaved ? "Win logged!" : "Log my win →"}
              </button>

              {outcomes.length > 0 && (
                <div style={{ marginTop: "1.25rem", borderTop: `1px solid ${T.border}`, paddingTop: "0.75rem" }}>
                  <div style={{ fontSize: "0.65rem", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>Your wins</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {outcomes.slice(0, 5).map((o) => (
                      <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.7rem", background: T.cardBg, borderRadius: "7px", border: `1px solid ${T.border}` }}>
                        <div>
                          <span style={{ fontSize: "0.78rem", color: T.textPrimary }}>{o.role}</span>
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

              {/* Community wins feed — always shown */}
              <div style={{ marginTop: "1.25rem", borderTop: `1px solid ${T.border}`, paddingTop: "0.75rem" }}>
                <div style={{ fontSize: "0.65rem", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>Recent community wins</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {[
                    { role: "Senior Product Manager", industry: "Technology", gained: 28000, tactic: "Competing offer", date: "Apr 2026" },
                    { role: "Software Engineer", industry: "Finance", gained: 42000, tactic: "Market data / research", date: "Apr 2026" },
                    { role: "Data Scientist", industry: "Healthcare", gained: 19000, tactic: "Anchoring high", date: "Mar 2026" },
                    { role: "UX Designer", industry: "Consulting", gained: 15000, tactic: "Bundling (equity + signing)", date: "Mar 2026" },
                    { role: "Engineering Manager", industry: "Technology", gained: 65000, tactic: "Competing offer", date: "Mar 2026" },
                  ].map((o, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.7rem", background: T.cardBg, borderRadius: "7px", border: `1px solid ${T.border}` }}>
                      <div>
                        <span style={{ fontSize: "0.78rem", color: T.textPrimary }}>{o.role}</span>
                        <span style={{ marginLeft: "5px", fontSize: "0.62rem", color: T.textMuted, background: T.border, padding: "1px 5px", borderRadius: "4px" }}>{o.industry}</span>
                        <div style={{ fontSize: "0.62rem", color: T.textHint, marginTop: "1px" }}>via {o.tactic}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#34d399" }}>+${o.gained.toLocaleString()}</div>
                        <div style={{ fontSize: "0.62rem", color: T.textHint }}>{o.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <ChatStrip onSend={sendMessage} loading={loading} T={T} tabId="logwin" />
        </>
      );

      default: return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.pageBg, display: "flex", flexDirection: "column", fontFamily: "'DM Sans', system-ui, sans-serif", color: T.textPrimary }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
        textarea, input, select { outline: none; }
        textarea { resize: none; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slideIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
        @keyframes oa-slide-up { from{opacity:0;transform:translateX(-50%) translateY(-10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        *, *::before, *::after { transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease; }
      `}</style>

      {/* Auth modal — shown when user clicks sign-in / sign-up / hits a paywall */}
      <AuthModal mode={authModal} onClose={() => setAuthModal(null)} T={T} />

      {/* Stripe checkout success banner */}
      {checkoutSuccess && (
        <div style={{
          position: "fixed",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9998,
          background: "#052e16",
          border: "1px solid #16a34a",
          borderRadius: "12px",
          padding: "0.75rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          animation: "oa-slide-up 0.25s ease forwards",
          maxWidth: "calc(100vw - 2rem)",
          whiteSpace: "nowrap",
        }}>
          <span style={{ fontSize: "1.1rem" }}>🎉</span>
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#4ade80" }}>
              {checkoutSuccess === "sprint" ? "Offer Sprint" : "Offer in Hand"} unlocked!
            </div>
            <div style={{ fontSize: "0.72rem", color: "#86efac" }}>
              All tools are now available. Start coaching below.
            </div>
          </div>
          <button
            onClick={() => setCheckoutSuccess(null)}
            style={{ marginLeft: "0.5rem", background: "transparent", border: "none", color: "#4ade80", fontSize: "1rem", cursor: "pointer", lineHeight: 1, padding: 0 }}
          >×</button>
        </div>
      )}

      {/* Onboarding modal */}
      {showOnboarding && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", animation: "fadeIn 0.2s ease" }}>
          <div style={{ background: T.headerBg, border: `1px solid ${T.border}`, borderRadius: "20px", padding: "2rem", maxWidth: 400, width: "100%", animation: "slideIn 0.25s ease" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "1.75rem" }}>
              {onboardingSlides.map((_, i) => (
                <div key={i} onClick={() => setOnboardingStep(i)} style={{ width: i === onboardingStep ? 20 : 6, height: 6, borderRadius: "3px", background: i === onboardingStep ? "#3b82f6" : T.border, transition: "all 0.3s", cursor: "pointer" }} />
              ))}
            </div>
            <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
              <LogoMark size={44} />
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.3rem", color: T.textPrimary, margin: "1rem 0 0.65rem" }}>{onboardingSlides[onboardingStep].title}</h2>
              <p style={{ color: T.textSecondary, fontSize: "0.88rem", lineHeight: 1.7, margin: 0 }}>{onboardingSlides[onboardingStep].body}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              <button onClick={() => { if (onboardingStep < onboardingSlides.length - 1) setOnboardingStep((s) => s + 1); else dismissOnboarding(); }}
                style={{ padding: "0.7rem", borderRadius: "10px", border: "none", background: "#1d4ed8", color: "white", fontSize: "0.88rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                {onboardingSlides[onboardingStep].cta}
              </button>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {onboardingStep > 0 && <button onClick={() => setOnboardingStep((s) => s - 1)} style={{ flex: 1, padding: "0.45rem", borderRadius: "8px", border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>← Back</button>}
                <button onClick={dismissOnboarding} style={{ flex: 1, padding: "0.45rem", borderRadius: "8px", border: "none", background: "transparent", color: T.textMuted, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>Skip intro</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      {/* ── Admin Test Bar ───────────────────────────────────────────────────── */}
      {showAdminBar && (
        <div style={{ background: "#1e1a2e", borderBottom: "1px solid #4c1d95", padding: "0.35rem 1rem", display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", flexShrink: 0 }}>
          <span style={{ fontSize: "0.65rem", color: "#a78bfa", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>🛠 Admin mode</span>
          <span style={{ fontSize: "0.65rem", color: "#7c3aed" }}>Plan:</span>
          {["free", "sprint", "pro"].map((p) => (
            <button key={p} onClick={() => setTestPlan(p)}
              style={{ padding: "2px 10px", borderRadius: "10px", border: `1px solid ${userPlan === p ? "#7c3aed" : "#4c1d95"}`, background: userPlan === p ? "#7c3aed" : "transparent", color: userPlan === p ? "white" : "#a78bfa", fontSize: "0.65rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
              {p === "sprint" ? "Offer Sprint" : p === "pro" ? "Offer in Hand" : "Free"}
            </button>
          ))}
          <button onClick={() => setTestPlan("off")}
            style={{ marginLeft: "auto", padding: "2px 10px", borderRadius: "10px", border: "1px solid #4c1d95", background: "transparent", color: "#64748b", fontSize: "0.65rem", cursor: "pointer", fontFamily: "inherit" }}>
            ✕ Exit admin
          </button>
        </div>
      )}

            <div style={{ padding: "0.7rem 1.25rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: T.headerBg, position: "sticky", top: 0, zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <LogoMark size={30} />
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: "0.97rem", color: T.textPrimary, letterSpacing: "-0.01em" }}>
              Offer<span style={{ color: "#2563eb" }}>Advisor</span>
            </div>
            <div style={{ fontSize: "0.6rem", color: T.textMuted, letterSpacing: "0.07em", textTransform: "uppercase" }}>AI Offer Coach</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
          {/* Community wins pill — always visible */}
          {stats.totalUsers > 0 ? (
            <div style={{ fontSize: "0.68rem", color: "#34d399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.15)", padding: "2px 7px", borderRadius: "10px" }}>
              {stats.totalUsers} wins · ${(stats.totalGained / 1000).toFixed(0)}K secured
            </div>
          ) : (
            <div style={{ fontSize: "0.68rem", color: "#34d399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.15)", padding: "2px 7px", borderRadius: "10px" }}>
              $169K secured this month
            </div>
          )}

          <button onClick={toggleTheme} style={{ padding: "0.3rem 0.75rem", borderRadius: "16px", border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, fontSize: "0.7rem", cursor: "pointer", fontFamily: "inherit" }}>
            {isDark ? "☀ Light" : "☾ Dark"}
          </button>
          <button onClick={() => { setShowOnboarding(true); setOnboardingStep(0); }} style={{ padding: "0.3rem 0.75rem", borderRadius: "16px", border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, fontSize: "0.7rem", cursor: "pointer", fontFamily: "inherit" }}>
            ? Help
          </button>

          {/* Auth section */}
          {!isLoaded ? null : isSignedIn ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              {/* Plan badge */}
              <div style={{ fontSize: "0.65rem", padding: "2px 7px", borderRadius: "8px", background: userPlan === "free" ? T.cardBg : "rgba(29,78,216,0.12)", color: userPlan === "free" ? T.textMuted : "#60a5fa", border: `1px solid ${userPlan === "free" ? T.border : "rgba(29,78,216,0.3)"}`, fontWeight: 500 }}>
                {PLANS[userPlan]?.label || "Free"}
              </div>
              {/* Clerk's built-in user button — handles profile, sign-out, etc */}
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: { width: 28, height: 28 },
                  },
                }}
              />
            </div>
          ) : (
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <button onClick={() => setAuthModal("signin")}
                style={{ padding: "0.3rem 0.75rem", borderRadius: "16px", border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, fontSize: "0.7rem", cursor: "pointer", fontFamily: "inherit" }}>
                Sign in
              </button>
              <button onClick={() => setAuthModal("signup")}
                style={{ padding: "0.3rem 0.75rem", borderRadius: "16px", border: "none", background: "#1d4ed8", color: "white", fontSize: "0.7rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                Sign up free
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ background: T.headerBg, borderBottom: `1px solid ${T.border}`, display: "flex", padding: "0 1rem", overflowX: "auto", flexShrink: 0 }}>
        {TABS.map((tab) => {
          const locked = !canAccess(userPlan, tab.id);
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id}
              onClick={() => {
                if (locked) {
                  // Not signed in → show sign-up; signed in but no plan → show upgrade
                  if (!isSignedIn) setAuthModal("signup");
                  else setAuthModal("upgrade");
                } else {
                  setActiveTab(tab.id);
                }
              }}
              title={locked ? `Upgrade to access ${tab.label}` : tab.desc}
              style={{ padding: "0.65rem 0.9rem", fontSize: "0.78rem", fontWeight: isActive ? 500 : 400, color: isActive ? "#1d4ed8" : locked ? T.textHint : T.textMuted, border: "none", borderBottom: isActive ? "2px solid #1d4ed8" : "2px solid transparent", background: "transparent", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "4px", opacity: locked ? 0.6 : 1 }}>
              {tab.label}
              {locked && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content — fills remaining space */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        {renderTabContent()}
      </div>
    </div>
  );
}
