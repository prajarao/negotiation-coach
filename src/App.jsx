import { useState, useRef, useEffect } from "react";
import { useUser, useAuth, UserProfile } from "@clerk/clerk-react";
import AuthModal from "./AuthModal.jsx";
import { offeradvisorClerkAppearance } from "./clerkAppearance.js";
import { sendSessionSummaryEmail } from "./utils/sessionEmail";
import CrispChat from "./components/CrispChat";
import TemplatesTab from "./components/TemplatesTab.jsx";
import PlaybookTab from "./components/PlaybookTab.jsx";
import AlexRoleplayTab from "./components/AlexRoleplayTab.jsx";
import StudentMvpTab from "./components/StudentMvpTab.jsx";
import { salaryBenchmarkMethodologyLine } from "./utils/salaryBenchmarkMethodology.js";

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

Grounding: Your reasoning should align with widely taught negotiation practice—manage yourself first, recognize competitive vs cooperative contexts, concede with purpose, use empathy to unlock creative options, and prepare the process end-to-end. Do not claim to quote or reproduce any specific published book; give original coaching language.

Always end your responses with a clear next step the user should take.
Format responses with clear sections when giving structured advice.`;

const WELCOME_MESSAGE = {
  role: "assistant",
  content: `# Welcome to OfferAdvisor

I'm your personal offer negotiation coach — the same sharp, specific advice top executives pay thousands for.

**Professionals:** Tell me about your situation below — role, company, numbers, and leverage.

**Students & new grads:** Open the **Students** tab for first-offer benchmarks (single or compare), a five-year cash snapshot, **Career path explorer** (skills-grounded trajectory ideas vs your default plan), and **School access** if your university partners with us (verify with your school email or invite code).

*The more you share in chat or in Students tools, the sharper my coaching gets.*`,
};

// Personalised version shown when we know the user's name
const welcomeMessageFor = (name) => ({
  role: "assistant",
  content: `# Welcome back, ${name}

Ready to negotiate? Tell me about your offer — role, company, and the numbers on the table.

Or jump to **Students** for benchmarks, path explorer, and campus verification if you're finishing school.`,
});

const TABS = [
  { id: "coach",     label: "Share offer", shortLabel: "Coach",     icon: "coach",     desc: "Tell me about your offer" },
  { id: "student",   label: "Students",    shortLabel: "Students",  icon: "student",   desc: "First offers · paths · campus access" },
  { id: "benchmark", label: "Benchmark",   shortLabel: "Benchmark", icon: "benchmark", desc: "Compare to market data" },
  { id: "calculate", label: "Calculate",   shortLabel: "Calculate", icon: "calculate", desc: "Build your counter-offer" },
  { id: "practice",  label: "Practice",    shortLabel: "Practice",  icon: "practice",  desc: "Role-play the conversation" },
  { id: "alex",      label: "Mock interview", shortLabel: "Mock AI", icon: "alex",     desc: "Voice interview with Alex (Pro)" },
  { id: "logwin",    label: "Log win",     shortLabel: "Log win",   icon: "logwin",    desc: "Record your result" },
  // Pro-only: templates, playbook, history
  { id: "templates", label: "Templates",   shortLabel: "Templates", icon: "templates", desc: "Email scripts (Pro)" },
  { id: "playbook",  label: "Playbook",    shortLabel: "Playbook",  icon: "playbook",  desc: "OfferAdvisor field guide (Pro)" },
  { id: "history",   label: "History",     shortLabel: "History",   icon: "history",   desc: "Track negotiations (Pro)" },
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
  templates: [
    "Polish my counter-offer email for tone and clarity",
    "Shorten this template while keeping leverage",
  ],
  playbook: [
    "Turn one Playbook section into a checklist for my call tomorrow",
    "What OfferAdvisor tab should I use first for my situation?",
  ],
  alex: [
    "Summarize my offer before I start the voice interview",
    "What should I lead with in the mock interview?",
  ],
  student: [
    "Is my first offer fair for my city and role?",
    "How do I compare two new-grad offers side by side?",
    "What could this offer mean for my salary in 5 years?",
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
  free:          { label: "Free",           color: "#64748b" },
  sprint:        { label: "Offer Sprint",   color: "#2563eb" },
  student_plus:  { label: "Student Plus",   color: "#0d9488" },
  pro:           { label: "Offer in Hand",  color: "#7c3aed" },
};

// Features each plan can access
const PLAN_FEATURES = {
  free:   ["coach", "student"],
  sprint: ["coach", "student", "benchmark", "calculate", "practice", "logwin"],
  student_plus: ["coach", "student", "benchmark", "calculate", "practice", "logwin"],
  pro:    ["coach", "student", "benchmark", "calculate", "practice", "logwin", "templates", "playbook", "history", "alex"],
  // Pro: templates, playbook, history, alex (voice mock interview + ElevenLabs)
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
  student_plus: { sessions: 999, emails: 999 },
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
        {isSignedIn ? "View plans & unlock →" : "Sign up to unlock →"}
      </button>
      <p style={{ fontSize: "0.72rem", color: T.textMuted, marginTop: "0.6rem" }}>
        {isSignedIn
          ? "Student Plus $24 · Sprint $29 · Pro $49 · Student Plus & Sprint = 30 days"
          : "Free account · Student Plus $24 · Sprint $29 · Pro $49 (no subscription)"}
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
  const { signOut, getToken }          = useAuth();

  // User's plan comes from Clerk publicMetadata (set by webhook on sign-up,
  // updated by Stripe webhook after payment)
  const clerkPlan = (user?.publicMetadata?.plan) || "free";
  
  // Sprint & Student Plus window: Stripe webhook sets expiresAt + planExpiresAt (ISO). Pro has both null.
  const planWindowExpiresAtIso =
    user?.publicMetadata?.expiresAt ?? user?.publicMetadata?.planExpiresAt ?? null;
  const isTimedPlanExpired =
    (clerkPlan === "sprint" || clerkPlan === "student_plus")
    && planWindowExpiresAtIso
    && new Date() > new Date(planWindowExpiresAtIso);

  // Effective plan: expired time-boxed plans are treated as free in the UI until Clerk/sync refreshes metadata
  const effectivePlan = isTimedPlanExpired ? "free" : clerkPlan;
  const daysLeftOnTimedPlan =
    (clerkPlan === "sprint" || clerkPlan === "student_plus") && planWindowExpiresAtIso
      ? Math.max(0, Math.ceil((new Date(planWindowExpiresAtIso) - new Date()) / (1000 * 60 * 60 * 24)))
      : 0;

  // ── Admin / test override ─────────────────────────────────────────────────
  // Set via localStorage so you can test locked screens without real payments.
  // Open browser console and run:
  //   localStorage.setItem("oa_admin_plan", "pro")   → unlock everything
  //   localStorage.setItem("oa_admin_plan", "sprint") → Offer Sprint
  //   localStorage.setItem("oa_admin_plan", "student_plus") → Student Plus
  //   localStorage.setItem("oa_admin_plan", "free")  → back to free
  //   localStorage.removeItem("oa_admin_plan")        → use real Clerk plan
  const [adminPlan, setAdminPlan] = useState(() => localStorage.getItem("oa_admin_plan") || null);

  // Admin toolbar state
  const [showAdminBar, setShowAdminBar] = useState(() => !!localStorage.getItem("oa_admin_plan"));

  const userPlan = adminPlan || effectivePlan;
  const userName = adminPlan ? "Admin" : (user?.firstName || user?.username || null);
  const accountDisplayName =
    user?.fullName?.trim()
    || [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim()
    || user?.username
    || user?.primaryEmailAddress?.emailAddress?.split("@")[0]
    || "Account";
  const accountEmail = user?.primaryEmailAddress?.emailAddress || "";
  const planExpiresRaw = user?.publicMetadata?.expiresAt ?? user?.publicMetadata?.planExpiresAt;
  const planExpiresLabel = (() => {
    if (!planExpiresRaw || typeof planExpiresRaw !== "string") return null;
    try {
      return new Date(planExpiresRaw).toLocaleDateString(undefined, { dateStyle: "medium" });
    } catch {
      return null;
    }
  })();

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

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const accountMenuRef = useRef(null);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointerDown = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [accountMenuOpen]);

  // Stripe return — detect ?checkout=success in URL after payment
  const [checkoutSuccess, setCheckoutSuccess] = useState(null); // null | "sprint" | "pro" | "student_plus"

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("checkout");
    const plan   = params.get("plan");
    if (status === "success" && plan) {
      setCheckoutSuccess(plan);
      // Clean URL so refresh doesn't re-trigger
      window.history.replaceState({}, "", window.location.pathname);
      // Re-fetch Clerk user data so the plan badge + tab locks update immediately
      if (user) {
        setTimeout(() => user.reload(), 1500);
      }
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
  /** Mock interview: hide text coach + input strip to give the camera/interview more room (esp. mobile). */
  const [alexTextCoachVisible, setAlexTextCoachVisible] = useState(true);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("coach");
  const canPractice = canAccess(userPlan, "practice");
  useEffect(() => {
    if (!canPractice && mode === "roleplay") setMode("coach");
  }, [canPractice, mode]);
  useEffect(() => {
    if (activeTab !== "alex") setAlexTextCoachVisible(true);
  }, [activeTab]);

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

  // ── Paywall state (track premium feature usage) ──────────────────────────────
  const [premiumFeaturesUsed, setPremiumFeaturesUsed] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);

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

    const useRoleplayPrompt = mode === "roleplay" && canPractice;
    const systemPrompt = useRoleplayPrompt
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
        body: JSON.stringify({ system: systemPrompt, messages: messagesToSend, roleplay: useRoleplayPrompt }),
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
      // Get the Clerk token before making the request
      const token = await getToken();
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json",
				"Authorization": `Bearer ${token}`		},
        body: JSON.stringify({ jobTitle: jobTitle.trim(), location: jobLocation.trim() || "United States", offeredSalary: offeredSalary ? parseFloat(offeredSalary) : null, currency: autoCurrency }),
      });
      const data = await res.json();
      setSalaryData(data);
      if (data.median) {
        const sym = data.currencySymbol || getCurrencySymbol(autoCurrency);
        await sendMessage(`[Market Data] ${data.occupation} in ${data.location}: 25th=${sym}${data.p25?.toLocaleString()}, Median=${sym}${data.median?.toLocaleString()}, 75th=${sym}${data.p75?.toLocaleString()}. ${offeredSalary ? `Offer of ${sym}${parseFloat(offeredSalary).toLocaleString()} is ${data.percentileRating} — ${data.negotiationStrength} leverage. ` : ""}Source: ${data.source}`);
        // Send benchmark email summary
        if (isSignedIn && user?.emailAddresses?.[0]?.emailAddress) {
          sendSessionSummaryEmail({
            userEmail: user.emailAddresses[0].emailAddress,
            userName: user.firstName || "User",
            sessionType: "benchmark",
            role: jobTitle,
            location: jobLocation || "United States",
            average: data.median,
            p25: data.p25,
            p75: data.p75,
            currencySymbol: data.currencySymbol || sym,
          }).catch(e => console.error("Benchmark email error:", e));
        }
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
      // Send counter-offer email summary
      if (isSignedIn && user?.emailAddresses?.[0]?.emailAddress) {
        sendSessionSummaryEmail({
          userEmail: user.emailAddresses[0].emailAddress,
          userName: user.firstName || "User",
          sessionType: "counter_offer",
          baseOffer: base,
          proposedCounter: counterBase,
          fourYearProjection: [
            { salary: counterTotalAnnual, cumulative: counterTotalAnnual },
            { salary: counterTotalAnnual, cumulative: counterTotalAnnual * 2 },
            { salary: counterTotalAnnual, cumulative: counterTotalAnnual * 3 },
            { salary: counterTotalAnnual, cumulative: counterTotalAnnual * 4 + counterSigning },
          ],
          totalAdditionalCompensation: fourYearGap,
        }).catch(e => console.error("Counter-offer email error:", e));
      }
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
    { title: "Welcome to OfferAdvisor", body: "AI negotiation coaching for professionals — plus a dedicated Students hub for first offers, comparing paths, career exploration, and university verification when your school partners with us.", cta: "How does it work?" },
    { title: "Start by sharing your offer", body: "Type anything about your situation in the chat. Role, company, offer numbers. The coach asks the right questions.", cta: "Got it" },
    { title: "Students & universities", body: "Use the Students tab for market checks on one or two offers, a five-year snapshot, Career path explorer, and School access with your campus email or invite code.", cta: "Next" },
    { title: "Benchmark your numbers", body: "Use the Benchmark tab to see where your offer sits against market ranges — by role, city, and country.", cta: "Makes sense" },
    { title: "Build your counter-offer", body: "The Calculate tab shows exactly what to counter with and your 4-year financial gain if you negotiate.", cta: "Love it" },
    { title: "Practice the conversation", body: "Switch to Practice and the AI plays your recruiter. Get coached after every exchange.", cta: "Let's go" },
  ];

  // ── Shared style helpers ──────────────────────────────────────────────────────
  const inputStyle  = { width: "100%", padding: "0.5rem 0.7rem", background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: "8px", color: T.textPrimary, fontSize: "0.8rem", fontFamily: "inherit", boxSizing: "border-box" };
  const selectStyle = { ...inputStyle };
  const primaryBtn  = (active, grad = "#1d4ed8") => ({ padding: "0.45rem 1.1rem", borderRadius: "8px", border: "none", background: active ? grad : T.border, color: active ? "white" : T.textMuted, fontSize: "0.78rem", cursor: active ? "pointer" : "not-allowed", fontFamily: "inherit", fontWeight: 500 });
  const symDisplay  = salaryData?.currencySymbol || getCurrencySymbol(selectedCurrency);

  // ── Paywall Modal Component ───────────────────────────────────────────────────
  const PaywallModal = () => (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "1rem",
    }}>
      <div style={{
        background: T.surfaceBg,
        borderRadius: "16px",
        padding: "2rem",
        maxWidth: "560px",
        width: "100%",
        textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        {/* Header */}
        <h2 style={{ color: "#1d4ed8", marginBottom: "0.5rem", fontSize: "1.4rem", fontWeight: 700 }}>
          See Your 4-Year Gain 📈
        </h2>

        {/* Description */}
        <p style={{ color: T.textSecondary, marginBottom: "1.5rem", fontSize: "0.95rem", lineHeight: 1.6 }}>
          Your counter offer could be worth <strong>$500K+</strong> over 4 years — unlock the full calculator to see exact numbers.
          <br />
          <span style={{ fontSize: "0.88rem", opacity: 0.95 }}>New grads: use <strong>Students</strong> for offer benchmarks &amp; career paths; universities can verify campus access there.</span>
        </p>

        {/* Price highlight */}
        <div style={{
          background: "#f0f4ff",
          border: "2px solid #3b82f6",
          padding: "1.5rem",
          borderRadius: "12px",
          marginBottom: "1.5rem",
        }}>
          <div style={{ fontSize: "0.85rem", color: "#1d4ed8", marginBottom: "0.5rem", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>From Student Plus (USD)</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1d4ed8" }}>$24+</div>
          <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>Student Plus USD · Sprint &amp; Pro also available</div>
        </div>

        {/* Plan options */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <div style={{
            textAlign: "left",
            padding: "0.85rem",
            background: "rgba(13,148,136,0.08)",
            borderRadius: "10px",
            border: "1px solid rgba(13,148,136,0.35)",
          }}>
            <div style={{ fontSize: "0.72rem", color: "#0f766e", marginBottom: "0.35rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>Student Plus</div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f766e" }}>$24</div>
            <div style={{ fontSize: "0.78rem", color: T.textSecondary, lineHeight: 1.45, marginTop: "0.25rem" }}>USD · 30 days · invite codes for campus pricing</div>
          </div>
          {/* Offer Sprint */}
          <div style={{
            textAlign: "left",
            padding: "1rem",
            background: T.cardBg,
            borderRadius: "10px",
            border: `1px solid ${T.border}`,
          }}>
            <div style={{ fontSize: "0.75rem", color: T.textMuted, marginBottom: "0.5rem", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>Offer Sprint</div>
            <div style={{ fontSize: "0.9rem", color: T.textSecondary, lineHeight: 1.6 }}>
              <div>✓ Full calculator</div>
              <div>✓ 4-year projection</div>
              <div>✓ AI role-play</div>
              <div>✓ 30 days from purchase</div>
            </div>
          </div>

          {/* Offer in Hand (highlighted) */}
          <div style={{
            textAlign: "left",
            padding: "1rem",
            background: "#f0f4ff",
            borderRadius: "10px",
            border: "2px solid #3b82f6",
          }}>
            <div style={{ fontSize: "0.75rem", color: "#1d4ed8", marginBottom: "0.5rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>Offer in Hand</div>
            <div style={{ fontSize: "0.9rem", color: "#1d4ed8", fontWeight: 500, lineHeight: 1.6 }}>
              <div>✓ Everything in Sprint</div>
              <div style={{ fontWeight: 700, marginTop: "0.5rem" }}>✓ No expiry</div>
              <div>{"✓ Templates, Playbook & History tabs"}</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "0.5rem" }}>$49</div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <button
          onClick={() => {
            setShowPaywall(false);
            setAuthModal(isSignedIn ? "upgrade" : "signup");
          }}
          style={{
            width: "100%",
            background: "#1d4ed8",
            color: "white",
            padding: "0.85rem",
            borderRadius: "10px",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.95rem",
            marginBottom: "0.75rem",
            fontFamily: "inherit",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#1e40af"}
          onMouseLeave={(e) => e.currentTarget.style.background = "#1d4ed8"}
        >
          Unlock plans — Student Plus · Sprint · Pro
        </button>

        <button
          onClick={() => setShowPaywall(false)}
          style={{
            width: "100%",
            background: "transparent",
            color: T.textSecondary,
            padding: "0.75rem",
            borderRadius: "10px",
            border: `1px solid ${T.border}`,
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.95rem",
            fontFamily: "inherit",
          }}
        >
          Back to calculator
        </button>

        {/* Footer note */}
        <p style={{ marginTop: "1.5rem", fontSize: "0.8rem", color: T.textMuted }}>
          💳 No subscriptions. No recurring charges. One-time payment only.
        </p>
      </div>
    </div>
  );

  /** Shared text coach thread (same `messages` state as Share offer) — also shown on Mock interview. */
  const coachMessageList = () => (
    <>
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
    </>
  );

  // ── Render tab content ────────────────────────────────────────────────────────
  const renderTabContent = () => {
    const practiceUnlocked = canAccess(userPlan, "practice");
    // For tool tabs: show LockScreen if user doesn't have access
    if (activeTab !== "coach" && !canAccess(userPlan, activeTab)) {
      const tab = TABS.find(t => t.id === activeTab);
      const lockDescription = (() => {
        if (activeTab === "alex") {
          return isSignedIn
            ? "Voice mock interview with Alex (camera preview + live audio) is included with Offer in Hand (Pro). Upgrade to unlock."
            : "Sign in, then upgrade to Offer in Hand (Pro) to use the voice mock interview with Alex.";
        }
        if (!isSignedIn) {
          return "Create a free account, then unlock with Student Plus ($24 USD), Offer Sprint ($29), or Offer in Hand ($49). Student Plus & Sprint include 30 days of full tool access.";
        }
        return "Unlock benchmark, calculator, role-play, log win. Student Plus $24 · Sprint $29 (each 30 days) · Pro $49 (no expiry). Students tab stays useful on Free for basics.";
      })();
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <LockScreen
            title={tab?.label || "Premium feature"}
            description={lockDescription}
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
              {coachMessageList()}
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
              <button onClick={() => {
                if (!practiceUnlocked) {
                  setAuthModal(isSignedIn ? "upgrade" : "signup");
                  return;
                }
                setMode((m) => (m === "roleplay" ? "coach" : "roleplay"));
                setMessages((p) => [...p, { role: "assistant", content: mode === "coach" ? "**Role-play mode on.** I'm Alex, your recruiter. What role are we discussing?" : "**Coach mode restored.** What do you want to work on?" }]);
                setActiveTab("coach");
              }}
                style={{ padding: "0.35rem 0.75rem", borderRadius: "16px", border: `1px solid ${practiceUnlocked && mode === "roleplay" ? "#7c3aed" : T.border}`, background: practiceUnlocked && mode === "roleplay" ? "rgba(124,58,237,0.1)" : "transparent", color: practiceUnlocked && mode === "roleplay" ? "#a78bfa" : T.textMuted, fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit", fontWeight: practiceUnlocked && mode === "roleplay" ? 500 : 400 }}>
                {practiceUnlocked && mode === "roleplay" ? "🎭 Role-play ON" : "🎭 Role-play mode"}
              </button>
            </div>
          </div>

          {/* Main input */}
          <div style={{ padding: "0.45rem 1rem 1rem", borderTop: `1px solid ${T.border}`, background: T.headerBg }}>
            <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", gap: "0.5rem", alignItems: "flex-end", background: T.surfaceBg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "0.5rem 0.5rem 0.5rem 0.85rem" }}>
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
                placeholder={practiceUnlocked && mode === "roleplay" ? "Speak to the recruiter, Alex..." : "Describe your offer or ask anything..."}
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

      // ── STUDENTS TAB — fresh grad MVP scaffold ───────────────────────────────
      case "student": return (
        <>
          <StudentMvpTab T={T} onSignIn={() => setAuthModal("signin")} onDiscussWithCoach={sendMessage} />
          <ChatStrip onSend={sendMessage} loading={loading} T={T} tabId="student" />
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
                  {(() => {
                    const methodologyLine = salaryBenchmarkMethodologyLine(salaryData);
                    return methodologyLine ? (
                      <p style={{ fontSize: "0.72rem", color: T.textSecondary, margin: "0 0 0.65rem", lineHeight: 1.55 }}>
                        {methodologyLine}
                      </p>
                    ) : null;
                  })()}
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
                <>
                  {!isSignedIn || !canAccess(userPlan, "calculate") ? (
                    // Show paywall for non-signed-in or free plan users
                    <PaywallModal />
                  ) : null}
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
                </>
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
                  // Send role-play recap email when ending the session
                  if (next === "coach" && isSignedIn && user?.emailAddresses?.[0]?.emailAddress) {
                    sendSessionSummaryEmail({
                      userEmail: user.emailAddresses[0].emailAddress,
                      userName: user.firstName || "User",
                      sessionType: "recruiter",
                      scenario: lastRole ? `${lastRole} negotiation role-play` : "Salary negotiation role-play",
                      keyTakeaways: ["Practice makes perfect — review your responses", "Focus on value, not need", "Stay calm under pressure"],
                      commonObjections: ["Budget constraints", "Competing candidates", "Internal equity limits"],
                    }).catch(e => console.error("Role-play email error:", e));
                  }
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

      case "templates":
        return (
          <>
            <TemplatesTab T={T} />
            <ChatStrip onSend={sendMessage} loading={loading} T={T} tabId="templates" />
          </>
        );

      case "playbook":
        return (
          <>
            <PlaybookTab T={T} />
            <ChatStrip onSend={sendMessage} loading={loading} T={T} tabId="playbook" />
          </>
        );

      case "alex": {
        const alexContext = [
          jobTitle && `Role: ${jobTitle}`,
          jobLocation && `Location: ${jobLocation}`,
          offer.base && `Offer base: ${offer.base}`,
          offer.equity && `Equity (total): ${offer.equity}`,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
              <div
                style={{
                  flex: alexTextCoachVisible ? "0 1 auto" : "1 1 0%",
                  minHeight: 0,
                  maxHeight: alexTextCoachVisible ? "min(50vh, 420px)" : "none",
                  overflowY: "auto",
                  padding: "1rem 1rem 0",
                }}
              >
                <AlexRoleplayTab T={T} contextualText={alexContext} />
              </div>
              {alexTextCoachVisible && (
                <button
                  type="button"
                  onClick={() => setAlexTextCoachVisible(false)}
                  style={{
                    flex: "0 0 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.35rem",
                    width: "100%",
                    padding: "0.55rem 1rem",
                    margin: 0,
                    border: "none",
                    borderTop: `1px solid ${T.border}`,
                    background: T.cardBg,
                    color: T.textSecondary,
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    minHeight: 44,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: "0.75rem" }}>▼</span>
                  Focus on interview — hide text coach
                </button>
              )}
              {alexTextCoachVisible && (
                <div
                  style={{
                    flex: 1,
                    minHeight: 120,
                    overflowY: "auto",
                    padding: "0.75rem 1rem",
                    borderTop: `1px solid ${T.border}`,
                    background: T.pageBg,
                  }}
                  aria-label="Text coach replies"
                >
                  <div style={{ fontSize: "0.63rem", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>Text coach (this tab)</div>
                  <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {coachMessageList()}
                  </div>
                </div>
              )}
              {!alexTextCoachVisible && (
                <button
                  type="button"
                  onClick={() => setAlexTextCoachVisible(true)}
                  style={{
                    flex: "0 0 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.35rem",
                    width: "100%",
                    padding: "0.65rem 1rem",
                    paddingBottom: "max(0.65rem, env(safe-area-inset-bottom, 0px))",
                    margin: 0,
                    border: "none",
                    borderTop: `1px solid ${T.border}`,
                    background: T.headerBg,
                    color: "#1d4ed8",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    minHeight: 48,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: "0.75rem" }}>▲</span>
                  Show text coach
                </button>
              )}
            </div>
            {alexTextCoachVisible && <ChatStrip onSend={sendMessage} loading={loading} T={T} tabId="alex" />}
          </>
        );
      }

      case "history": {
        const proTabMeta = TABS.find((t) => t.id === activeTab);
        return (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "2rem 1rem", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
              <div style={{
                maxWidth: 460,
                width: "100%",
                marginTop: "1.5rem",
                textAlign: "center",
                padding: "2rem 1.5rem",
                borderRadius: "14px",
                border: `1px solid ${T.border}`,
                background: T.cardBg,
                animation: "fadeIn 0.25s ease",
              }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.85rem" }}>Coming soon</div>
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.35rem", color: T.textPrimary, margin: "0 0 0.5rem" }}>{proTabMeta?.label || activeTab}</h2>
                <p style={{ fontSize: "0.86rem", color: T.textSecondary, lineHeight: 1.65, margin: 0 }}>A timeline of your offers, counters, and wins will appear here.</p>
                <p style={{ fontSize: "0.78rem", color: T.textMuted, lineHeight: 1.55, margin: "1.1rem 0 0" }}>
                  This module is not built yet. Use the coach below for email wording, strategy, and follow-ups in the meantime.
                </p>
              </div>
            </div>
            <ChatStrip onSend={sendMessage} loading={loading} T={T} tabId={activeTab} />
          </>
        );
      }

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

      <CrispChat />

      {/* Auth modal — shown when user clicks sign-in / sign-up / hits a paywall */}
      <AuthModal mode={authModal} onClose={() => setAuthModal(null)} T={T} />

      {showUserProfileModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Your profile"
          onClick={(e) => { if (e.target === e.currentTarget) setShowUserProfileModal(false); }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10070,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 920,
              maxHeight: "min(92vh, 880px)",
              overflow: "auto",
              background: T.headerBg,
              border: `1px solid ${T.border}`,
              borderRadius: "14px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
              paddingTop: "6px",
            }}
          >
            <button
              type="button"
              aria-label="Close profile"
              onClick={() => setShowUserProfileModal(false)}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                zIndex: 2,
                width: 36,
                height: 36,
                borderRadius: "8px",
                border: `1px solid ${T.border}`,
                background: T.cardBg,
                color: T.textMuted,
                fontSize: "1.25rem",
                lineHeight: 1,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ×
            </button>
            <div style={{ padding: "0.5rem 1rem 1.25rem" }}>
              <UserProfile
                routing="hash"
                appearance={offeradvisorClerkAppearance({
                  rootBox: { width: "100%" },
                  card: { boxShadow: "none", background: "transparent", border: "none" },
                })}
              />
            </div>
          </div>
        </div>
      )}

      {walletModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Wallet and plan"
          onClick={(e) => { if (e.target === e.currentTarget) setWalletModalOpen(false); }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10065,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 400,
              padding: "1.5rem",
              borderRadius: "14px",
              border: `1px solid ${T.border}`,
              background: T.headerBg,
              boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
            }}
          >
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.2rem", color: T.textPrimary, marginBottom: "0.75rem" }}>Wallet & plan</h2>
            <p style={{ fontSize: "0.82rem", color: T.textSecondary, lineHeight: 1.65, marginBottom: "0.75rem" }}>
              Your subscription is managed through Stripe. Receipts are emailed to you after purchase.
            </p>
            <div style={{ padding: "0.75rem", borderRadius: "10px", background: T.cardBg, border: `1px solid ${T.border}`, marginBottom: "0.75rem" }}>
              <div style={{ fontSize: "0.68rem", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>Current plan</div>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: T.textPrimary }}>{PLANS[userPlan]?.label || userPlan}</div>
              {(userPlan === "sprint" || userPlan === "student_plus") && planExpiresLabel ? (
                <div style={{ fontSize: "0.78rem", color: T.textMuted, marginTop: "0.4rem" }}>
                  Full access until <strong style={{ color: T.textSecondary }}>{planExpiresLabel}</strong>
                </div>
              ) : userPlan === "pro" ? (
                <div style={{ fontSize: "0.78rem", color: T.textMuted, marginTop: "0.4rem" }}>No expiration — ongoing access.</div>
              ) : userPlan === "free" ? (
                <div style={{ fontSize: "0.78rem", color: T.textMuted, marginTop: "0.4rem" }}>Upgrade to unlock every tool.</div>
              ) : (userPlan === "sprint" || userPlan === "student_plus") && !planExpiresLabel ? (
                <div style={{ fontSize: "0.78rem", color: T.textMuted, marginTop: "0.4rem" }}>
                  Time-boxed plan — 30 days from purchase or campus grant (refresh if dates are missing).
                </div>
              ) : null}
              {adminPlan ? (
                <div style={{ fontSize: "0.72rem", color: "#a78bfa", marginTop: "0.5rem" }}>Admin test override active (local only).</div>
              ) : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              {userPlan === "pro" ? (
                <button
                  type="button"
                  disabled
                  style={{
                    padding: "0.6rem 1rem",
                    borderRadius: "10px",
                    border: `1px solid ${T.border}`,
                    background: T.cardBg,
                    color: T.textMuted,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "not-allowed",
                    fontFamily: "inherit",
                  }}
                >
                  Highest plan — no upgrade available
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setWalletModalOpen(false);
                    setAuthModal("upgrade");
                  }}
                  style={{
                    padding: "0.6rem 1rem",
                    borderRadius: "10px",
                    border: "none",
                    background: "#1d4ed8",
                    color: "white",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {userPlan === "free" ? "View plans & upgrade" : "Change plan"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setWalletModalOpen(false)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "10px",
                  border: `1px solid ${T.border}`,
                  background: "transparent",
                  color: T.textMuted,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
        }}>
          <span style={{ fontSize: "1.1rem" }}>🎉</span>
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#4ade80" }}>
              {checkoutSuccess === "sprint"
                ? "Offer Sprint"
                : checkoutSuccess === "student_plus"
                  ? "Student Plus"
                  : "Offer in Hand"}{" "}
              unlocked!
            </div>
            <div style={{ fontSize: "0.72rem", color: "#86efac", maxWidth: 320, lineHeight: 1.35 }}>
              {checkoutSuccess === "sprint" || checkoutSuccess === "student_plus"
                ? "Coach, benchmark, calculator, role-play and log win — 30 days from checkout. Upgrade to Pro anytime for Templates, Playbook, History & no expiry."
                : "Core tools plus Templates, Playbook and History — no expiry. Start below."}
            </div>
          </div>
          <button
            onClick={() => setCheckoutSuccess(null)}
            style={{ marginLeft: "0.5rem", background: "transparent", border: "none", color: "#4ade80", fontSize: "1rem", cursor: "pointer", lineHeight: 1, padding: 0 }}
          >×</button>
        </div>
      )}

      {/* Sprint Plan Expiration Countdown */}
      {(isLoaded && isSignedIn
        && (clerkPlan === "sprint" || clerkPlan === "student_plus")
        && !isTimedPlanExpired
        && planWindowExpiresAtIso) && (
        <div style={{
          background: daysLeftOnTimedPlan <= 3 
            ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
            : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          color: "white",
          padding: "0.65rem 1rem",
          textAlign: "center",
          fontSize: "0.8rem",
          fontWeight: 500,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}>
          <span>
            {daysLeftOnTimedPlan <= 0
              ? "⏰ Your access ends today"
              : daysLeftOnTimedPlan <= 3
                ? `⏰ Your plan expires in ${daysLeftOnTimedPlan} day${daysLeftOnTimedPlan !== 1 ? "s" : ""}`
                : `✅ ${clerkPlan === "student_plus" ? "Student Plus" : "Sprint"} active — ${daysLeftOnTimedPlan} days remaining`}
          </span>
          {daysLeftOnTimedPlan <= 3 && (
            <button 
              onClick={() => setAuthModal("upgrade")}
              style={{
                background: "rgba(255,255,255,0.2)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.4)",
                padding: "0.3rem 0.75rem",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: 600,
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.3)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
            >
              Upgrade to Pro →
            </button>
          )}
        </div>
      )}

      {/* Sprint Plan Expired Banner */}
      {isLoaded && isSignedIn && isTimedPlanExpired && (
        <div style={{
          background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
          color: "white",
          padding: "0.75rem 1rem",
          textAlign: "center",
          fontSize: "0.82rem",
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}>
          <span>
            ⏱️ Your limited-time plan (Sprint or Student Plus) has ended. Upgrade to Pro for lifetime access.
          </span>
          <button 
            onClick={() => setAuthModal("upgrade")}
            style={{
              background: "white",
              color: "#dc2626",
              border: "none",
              padding: "0.4rem 0.9rem",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 600,
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
          >
            Upgrade to Pro $49 →
          </button>
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
          {["free", "sprint", "student_plus", "pro"].map((p) => (
            <button key={p} onClick={() => setTestPlan(p)}
              style={{ padding: "2px 10px", borderRadius: "10px", border: `1px solid ${userPlan === p ? "#7c3aed" : "#4c1d95"}`, background: userPlan === p ? "#7c3aed" : "transparent", color: userPlan === p ? "white" : "#a78bfa", fontSize: "0.65rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
              {p === "sprint" ? "Sprint" : p === "pro" ? "Pro" : p === "student_plus" ? "Stud+" : "Free"}
            </button>
          ))}
          <button onClick={() => setTestPlan("off")}
            style={{ marginLeft: "auto", padding: "2px 10px", borderRadius: "10px", border: "1px solid #4c1d95", background: "transparent", color: "#64748b", fontSize: "0.65rem", cursor: "pointer", fontFamily: "inherit" }}>
            ✕ Exit admin
          </button>
        </div>
      )}

            <div style={{ padding: "0.7rem 1.25rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem 0.75rem", background: T.headerBg, position: "sticky", top: 0, zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
          <LogoMark size={30} />
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: "0.97rem", color: T.textPrimary, letterSpacing: "-0.01em" }}>
              Offer<span style={{ color: "#2563eb" }}>Advisor</span>
            </div>
            <div style={{ fontSize: "0.6rem", color: T.textMuted, letterSpacing: "0.07em", textTransform: "uppercase" }}>AI Offer Coach</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 }}>
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

          {/* Auth section — while Clerk loads we show a hint (was null before, so Sign in vanished in dev if Clerk hung) */}
          {!isLoaded ? (
            <span style={{ fontSize: "0.68rem", color: T.textMuted, whiteSpace: "nowrap", padding: "0.2rem 0" }} title="Connecting to Clerk…">
              Session…
            </span>
          ) : isSignedIn ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              {/* Plan badge */}
              <div style={{
                fontSize: "0.65rem", padding: "2px 8px", borderRadius: "8px", fontWeight: 600, letterSpacing: "0.02em",
                ...(userPlan === "pro"
                  ? { background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", border: "1px solid #7c3aed", boxShadow: "0 0 8px rgba(124,58,237,0.35)" }
                  : userPlan === "sprint"
                  ? { background: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "#fff", border: "1px solid #2563eb", boxShadow: "0 0 8px rgba(37,99,235,0.35)" }
                  : userPlan === "student_plus"
                  ? { background: "linear-gradient(135deg, #0d9488, #0f766e)", color: "#fff", border: "1px solid #0d9488", boxShadow: "0 0 8px rgba(13,148,136,0.35)" }
                  : { background: T.cardBg, color: T.textMuted, border: `1px solid ${T.border}` }),
              }}>
                {PLANS[userPlan]?.label || "Free"}
              </div>
              <div ref={accountMenuRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  onClick={() => setAccountMenuOpen((o) => !o)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    padding: "0.25rem 0.45rem 0.25rem 0.25rem",
                    borderRadius: "10px",
                    border: `1px solid ${T.border}`,
                    background: T.cardBg,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    maxWidth: "min(200px, 42vw)",
                  }}
                >
                  {user?.imageUrl ? (
                    <img
                      alt=""
                      src={user.imageUrl}
                      width={28}
                      height={28}
                      style={{ borderRadius: "8px", flexShrink: 0, objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: "8px", flexShrink: 0, background: "#334155", color: "#e2e8f0", fontSize: "0.75rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {(accountDisplayName[0] || "?").toUpperCase()}
                    </div>
                  )}
                  <span style={{ fontSize: "0.78rem", fontWeight: 500, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {accountDisplayName}
                  </span>
                  <span style={{ fontSize: "0.55rem", color: T.textMuted, flexShrink: 0 }}>▼</span>
                </button>
                {accountMenuOpen && (
                  <div
                    role="menu"
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 6px)",
                      minWidth: 240,
                      maxWidth: 300,
                      padding: "0.35rem 0",
                      borderRadius: "12px",
                      border: `1px solid ${T.border}`,
                      background: T.headerBg,
                      boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
                      zIndex: 10060,
                    }}
                  >
                    <div style={{ padding: "0.5rem 0.85rem 0.65rem", borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{accountDisplayName}</div>
                      {accountEmail ? (
                        <div style={{ fontSize: "0.68rem", color: T.textMuted, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{accountEmail}</div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        setShowUserProfileModal(true);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "0.55rem 0.85rem",
                        border: "none",
                        background: "transparent",
                        color: T.textSecondary,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      View / edit profile
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        setWalletModalOpen(true);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "0.55rem 0.85rem",
                        border: "none",
                        background: "transparent",
                        color: T.textSecondary,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Wallet & plan
                    </button>
                    <div style={{ height: 1, background: T.border, margin: "0.25rem 0" }} />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={async () => {
                        setAccountMenuOpen(false);
                        await signOut({ redirectUrl: `${window.location.origin}/` });
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "0.55rem 0.85rem",
                        border: "none",
                        background: "transparent",
                        color: "#f87171",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
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
