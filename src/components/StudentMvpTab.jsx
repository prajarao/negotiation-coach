import { useState, useEffect } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import StudentCareerPathExplorer from "./StudentCareerPathExplorer.jsx";
import { inferSalaryCurrencyFromLocation, salaryCurrencySymbol } from "../utils/inferSalaryCurrency.js";
import { salaryBenchmarkMethodologyLine } from "../utils/salaryBenchmarkMethodology.js";

/**
 * Shared benchmark result UI for single-offer and compare flows.
 */
function StudentBenchmarkResultCard({ T, label, subtitle, salaryData, offeredSalaryStr, inferredCurrency, embedded }) {
  const sym = salaryData?.currencySymbol || salaryCurrencySymbol(inferredCurrency || salaryData?.currency || "USD");
  const topRule =
    embedded === true
      ? {}
      : { paddingTop: "0.85rem", borderTop: `1px solid ${T.border}` };
  return (
    <div style={topRule}>
      {label ? (
        <div style={{ fontSize: "0.72rem", fontWeight: 600, color: T.textPrimary, marginBottom: embedded ? "0.35rem" : "0.5rem" }}>{label}</div>
      ) : null}
      {subtitle ? (
        <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "0.45rem", lineHeight: 1.45 }}>{subtitle}</div>
      ) : null}
      <div style={{ fontSize: "0.68rem", color: T.textMuted, marginBottom: "0.65rem" }}>
        {salaryData.occupation} · {salaryData.location} · {salaryData.source}
        {salaryData.estimateKind === "entry_level_adjusted" && salaryData.occupationWidePercentiles?.median != null ? (
          <span>
            {" "}
            · BLS occupation-wide median ~{sym}
            {salaryData.occupationWidePercentiles.median.toLocaleString()} (before entry-oriented adjustment)
          </span>
        ) : null}
      </div>
      {(() => {
        const methodologyLine = salaryBenchmarkMethodologyLine(salaryData);
        return methodologyLine ? (
          <p style={{ fontSize: "0.72rem", color: T.textSecondary, margin: "0 0 0.65rem", lineHeight: 1.55 }}>
            {methodologyLine}
          </p>
        ) : null;
      })()}
      {salaryData.benchmarkDisclaimer ? (
        <p style={{ fontSize: "0.72rem", color: T.textSecondary, margin: "0 0 0.65rem", lineHeight: 1.55 }}>
          {salaryData.benchmarkDisclaimer}
        </p>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", marginBottom: "0.65rem" }}>
        {[
          { key: "p25", label: "25th percentile", value: salaryData.p25, color: "#f59e0b" },
          { key: "med", label: "Median (50th)", value: salaryData.median, color: "#3b82f6" },
          { key: "p75", label: "75th percentile", value: salaryData.p75, color: "#10b981" },
        ].map(({ key, label: ln, value, color }) => (
          <div key={key} style={{ padding: "0.55rem 0.65rem", background: T.surfaceBg || T.cardBg, borderRadius: "8px", border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: "0.62rem", color: T.textMuted, marginBottom: "3px" }}>{ln}</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, color }}>{value != null ? `${sym}${value.toLocaleString()}` : "—"}</div>
          </div>
        ))}
      </div>
      {salaryData.offeredSalary != null && salaryData.p25 != null ? (
        <div style={{ padding: "0.55rem 0.75rem", background: T.surfaceBg || T.cardBg, borderRadius: "8px", border: `1px solid ${T.border}`, fontSize: "0.75rem", marginBottom: "0.75rem" }}>
          Your offer <strong style={{ color: T.textPrimary }}>{sym}{salaryData.offeredSalary.toLocaleString()}</strong> is{" "}
          <span style={{ color: ["very strong", "strong"].includes(salaryData.negotiationStrength) ? "#10b981" : "#f59e0b" }}>
            {salaryData.percentileRating} · {salaryData.negotiationStrength} leverage
          </span>
        </div>
      ) : offeredSalaryStr?.trim() ? (
        <p style={{ fontSize: "0.72rem", color: T.textMuted, margin: "0 0 0.65rem", lineHeight: 1.55 }}>
          Add a valid offer amount to see percentile leverage (same currency as location).
        </p>
      ) : null}
    </div>
  );
}

/** @returns {'intern'|'new_grad'|'early_career'} */
function coerceCareerStage(v) {
  return v === "intern" || v === "new_grad" || v === "early_career" ? v : "new_grad";
}

function normalizedYears(raw) {
  const y = parseInt(String(raw ?? 0), 10);
  return Number.isFinite(y) ? Math.min(Math.max(y, 0), 60) : 0;
}

function pctVsMedian(offeredRaw, median) {
  const o = offeredRaw ? parseFloat(String(offeredRaw)) : NaN;
  if (!Number.isFinite(o) || median == null || median <= 0) return null;
  return ((o - median) / median) * 100;
}

/** Sum of annual compensation over 5 years; same YoY raise applied after each year (year 1 = base). */
function cumulativeFiveYearEarnings(baseAnnual, annualRaisePct) {
  const b = Number(baseAnnual);
  if (!Number.isFinite(b) || b <= 0) return null;
  let r = Number(annualRaisePct) / 100;
  if (!Number.isFinite(r)) r = 0;
  r = Math.min(Math.max(r, -0.35), 1);
  let sum = 0;
  let yearSalary = b;
  for (let i = 0; i < 5; i++) {
    sum += yearSalary;
    yearSalary *= 1 + r;
  }
  return sum;
}

function emptyCompareOffer() {
  return {
    jobTitle: "",
    company: "",
    location: "",
    offeredSalary: "",
    roleContext: "",
    careerStage: /** @type {'intern'|'new_grad'|'early_career'} */ ("new_grad"),
    experienceYears: 0,
  };
}

/**
 * Student onboarding: POST /api/student-verify-university;
 * GET /api/student-verification-status hydrates verified state after refresh.
 */
export default function StudentMvpTab({ T, onSignIn, onDiscussWithCoach }) {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const [path, setPath] = useState(null);
  /** @type {'domain' | 'invite_only'} */
  const [univVerifyMode, setUnivVerifyMode] = useState("domain");
  const [uniEmail, setUniEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [uniName, setUniName] = useState("");
  const [degree, setDegree] = useState("undergraduate");
  const [major, setMajor] = useState("");
  const [gradTerm, setGradTerm] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState(null);
  const [verifySuccess, setVerifySuccess] = useState(null);

  const STORAGE_KEY_STUDENT_BENCHMARK = "offeradvisor_student_benchmark_v1";
  const STORAGE_KEY_STUDENT_FIVE_YEAR = "offeradvisor_student_five_year_v1";
  const STORAGE_KEY_STUDENT_SECTION_TAB = "offeradvisor_student_section_tab_v1";

  /** @type {'offers' | 'paths' | 'school'} */
  const [studentSectionTab, setStudentSectionTab] = useState(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY_STUDENT_SECTION_TAB);
      if (v === "offers" || v === "paths" || v === "school") return v;
    } catch {
      /* ignore */
    }
    return "paths";
  });

  const [fiveYearSalaryA, setFiveYearSalaryA] = useState("");
  const [fiveYearSalaryB, setFiveYearSalaryB] = useState("");
  const [fiveYearRaisePct, setFiveYearRaisePct] = useState("3");

  const [studentJobTitle, setStudentJobTitle] = useState("");
  const [studentJobLocation, setStudentJobLocation] = useState("");
  const [studentOfferedSalary, setStudentOfferedSalary] = useState("");
  /** @type {'intern'|'new_grad'|'early_career'} */
  const [studentCareerStage, setStudentCareerStage] = useState("new_grad");
  const [studentExperienceYears, setStudentExperienceYears] = useState(0);
  const [studentSalaryLoading, setStudentSalaryLoading] = useState(false);
  const [studentSalaryData, setStudentSalaryData] = useState(null);
  const [studentSalaryError, setStudentSalaryError] = useState(null);
  const [studentCurrencyUsed, setStudentCurrencyUsed] = useState("USD");

  /** @type {'single'|'compare'} */
  const [benchmarkMode, setBenchmarkMode] = useState("single");
  const [compareA, setCompareA] = useState(() => emptyCompareOffer());
  const [compareB, setCompareB] = useState(() => emptyCompareOffer());
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState(null);
  const [compareResultA, setCompareResultA] = useState(null);
  const [compareResultB, setCompareResultB] = useState(null);
  const [compareCurrencyA, setCompareCurrencyA] = useState("USD");
  const [compareCurrencyB, setCompareCurrencyB] = useState("USD");
  /** Shared notes for mentor-style coaching (priorities beyond pay). */
  const [compareMentorNotes, setCompareMentorNotes] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STUDENT_BENCHMARK);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.studentJobTitle != null) setStudentJobTitle(String(parsed.studentJobTitle));
      if (parsed.studentJobLocation != null) setStudentJobLocation(String(parsed.studentJobLocation));
      if (parsed.studentOfferedSalary != null) setStudentOfferedSalary(String(parsed.studentOfferedSalary));
      if (parsed.studentCurrencyUsed) setStudentCurrencyUsed(parsed.studentCurrencyUsed);
      if (parsed.studentCareerStage === "intern" || parsed.studentCareerStage === "new_grad" || parsed.studentCareerStage === "early_career") {
        setStudentCareerStage(parsed.studentCareerStage);
      }
      if (parsed.studentExperienceYears != null && parsed.studentExperienceYears !== "") {
        const y = parseInt(String(parsed.studentExperienceYears), 10);
        if (Number.isFinite(y) && y >= 0) setStudentExperienceYears(Math.min(y, 60));
      }
      if (parsed.studentSalaryData?.median) setStudentSalaryData(parsed.studentSalaryData);
      if (parsed.benchmarkMode === "compare") setBenchmarkMode("compare");
      if (parsed.compareA && typeof parsed.compareA === "object") {
        setCompareA({
          ...emptyCompareOffer(),
          ...parsed.compareA,
          company: parsed.compareA.company != null ? String(parsed.compareA.company) : "",
          roleContext: parsed.compareA.roleContext != null ? String(parsed.compareA.roleContext) : "",
          careerStage: coerceCareerStage(parsed.compareA.careerStage),
          experienceYears: normalizedYears(parsed.compareA.experienceYears),
        });
      }
      if (parsed.compareB && typeof parsed.compareB === "object") {
        setCompareB({
          ...emptyCompareOffer(),
          ...parsed.compareB,
          company: parsed.compareB.company != null ? String(parsed.compareB.company) : "",
          roleContext: parsed.compareB.roleContext != null ? String(parsed.compareB.roleContext) : "",
          careerStage: coerceCareerStage(parsed.compareB.careerStage),
          experienceYears: normalizedYears(parsed.compareB.experienceYears),
        });
      }
      if (parsed.compareResultA?.median != null) setCompareResultA(parsed.compareResultA);
      if (parsed.compareResultB?.median != null) setCompareResultB(parsed.compareResultB);
      if (parsed.compareCurrencyA) setCompareCurrencyA(parsed.compareCurrencyA);
      if (parsed.compareCurrencyB) setCompareCurrencyB(parsed.compareCurrencyB);
      if (typeof parsed.compareMentorNotes === "string") setCompareMentorNotes(parsed.compareMentorNotes);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STUDENT_FIVE_YEAR);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.fiveYearSalaryA != null) setFiveYearSalaryA(String(parsed.fiveYearSalaryA));
      if (parsed.fiveYearSalaryB != null) setFiveYearSalaryB(String(parsed.fiveYearSalaryB));
      if (parsed.fiveYearRaisePct != null && parsed.fiveYearRaisePct !== "") setFiveYearRaisePct(String(parsed.fiveYearRaisePct));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_STUDENT_FIVE_YEAR,
        JSON.stringify({
          fiveYearSalaryA,
          fiveYearSalaryB,
          fiveYearRaisePct,
        })
      );
    } catch {
      /* ignore */
    }
  }, [fiveYearSalaryA, fiveYearSalaryB, fiveYearRaisePct]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_STUDENT_SECTION_TAB, studentSectionTab);
    } catch {
      /* ignore */
    }
  }, [studentSectionTab]);

  useEffect(() => {
    let cancelled = false;
    async function loadVerificationStatus() {
      if (!isSignedIn) {
        setVerifySuccess(null);
        return;
      }
      try {
        const jwt = await getToken();
        if (!jwt || cancelled) return;
        const r = await fetch("/api/student-verification-status", {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        const j = await r.json().catch(() => ({}));
        if (cancelled || !r.ok || !j.ok || !j.verified || !j.universities?.length) return;
        const u = j.universities[0];
        setVerifySuccess({
          name: u.name,
          slug: u.slug,
          alreadyVerified: true,
        });
      } catch {
        /* ignore */
      }
    }
    loadVerificationStatus();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  const card = {
    border: `1px solid ${T.border}`,
    borderRadius: "12px",
    padding: "1rem",
    background: T.cardBg,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  };

  const labelStyle = { fontSize: "0.68rem", color: T.textMuted, marginBottom: "6px", display: "block" };
  const inputStyle = {
    width: "100%",
    padding: "0.45rem 0.65rem",
    borderRadius: "8px",
    border: `1px solid ${T.border}`,
    background: T.surfaceBg || T.cardBg,
    color: T.textPrimary,
    fontSize: "0.85rem",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const textareaStyle = {
    ...inputStyle,
    minHeight: "76px",
    resize: "vertical",
    lineHeight: 1.45,
  };

  const clearVerifyError = () => setVerifyError(null);

  const resetUniversityVerifyState = () => {
    setVerifyError(null);
    setVerifySuccess(null);
  };

  const handleVerifyUniversity = async () => {
    setVerifyError(null);
    if (!isSignedIn) return;
    setVerifyLoading(true);
    try {
      const jwt = await getToken();
      if (!jwt) {
        setVerifyError("Could not load session. Try signing in again.");
        return;
      }
      const payload =
        univVerifyMode === "invite_only"
          ? { mode: "invite_only", inviteCode: inviteCode.trim() }
          : {
              email: uniEmail.trim(),
              inviteCode: inviteCode.trim(),
              universityNameHint: uniName.trim() || undefined,
            };

      const r = await fetch("/api/student-verify-university", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setVerifyError(j.error || j.message || `Request failed (${r.status})`);
        return;
      }
      if (j.ok && j.university) {
        setVerifySuccess({
          name: j.university.name,
          slug: j.university.slug,
          alreadyVerified: Boolean(j.alreadyVerified),
        });
      }
    } catch (e) {
      setVerifyError(e?.message || "Network error");
    } finally {
      setVerifyLoading(false);
    }
  };

  const studentLookupSalary = async () => {
    if (!studentJobTitle.trim() || !isSignedIn) return;
    setStudentSalaryLoading(true);
    setStudentSalaryData(null);
    setStudentSalaryError(null);
    const currency = inferSalaryCurrencyFromLocation(studentJobLocation);
    setStudentCurrencyUsed(currency);
    try {
      const jwt = await getToken();
      if (!jwt) {
        setStudentSalaryError("Could not load session. Try signing in again.");
        return;
      }
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          jobTitle: studentJobTitle.trim(),
          location: studentJobLocation.trim() || "United States",
          offeredSalary: studentOfferedSalary ? parseFloat(studentOfferedSalary) : null,
          currency,
          careerStage: studentCareerStage,
          experienceYears: studentExperienceYears,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStudentSalaryError(data.error || data.message || `Request failed (${res.status})`);
        return;
      }
      setStudentSalaryData(data);
      try {
        localStorage.setItem(
          STORAGE_KEY_STUDENT_BENCHMARK,
          JSON.stringify({
            benchmarkMode: "single",
            studentJobTitle,
            studentJobLocation,
            studentOfferedSalary,
            studentCareerStage,
            studentExperienceYears,
            studentSalaryData: data,
            studentCurrencyUsed: currency,
          })
        );
      } catch {
        /* ignore */
      }
    } catch (e) {
      setStudentSalaryError(e?.message || "Network error");
    } finally {
      setStudentSalaryLoading(false);
    }
  };

  const fetchSalaryForOfferInput = async (offer) => {
    const jwt = await getToken();
    if (!jwt) return { ok: false, error: "Could not load session. Try signing in again.", data: null };
    const currency = inferSalaryCurrencyFromLocation(offer.location);
    const res = await fetch("/api/salary", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        jobTitle: offer.jobTitle.trim(),
        location: offer.location.trim() || "United States",
        offeredSalary: offer.offeredSalary ? parseFloat(String(offer.offeredSalary)) : null,
        currency,
        careerStage: offer.careerStage,
        experienceYears: offer.experienceYears,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || data.message || `Request failed (${res.status})`, data: null };
    }
    return { ok: true, error: null, data, currency };
  };

  const studentCompareBenchmarks = async () => {
    if (!compareA.jobTitle.trim() || !compareB.jobTitle.trim() || !isSignedIn) return;
    setCompareLoading(true);
    setCompareError(null);
    setCompareResultA(null);
    setCompareResultB(null);
    try {
      const [ra, rb] = await Promise.all([fetchSalaryForOfferInput(compareA), fetchSalaryForOfferInput(compareB)]);
      if (!ra.ok) {
        setCompareError(ra.error || "Offer A lookup failed.");
        return;
      }
      if (!rb.ok) {
        setCompareError(rb.error || "Offer B lookup failed.");
        return;
      }
      setCompareResultA(ra.data);
      setCompareResultB(rb.data);
      setCompareCurrencyA(ra.currency);
      setCompareCurrencyB(rb.currency);
      try {
        localStorage.setItem(
          STORAGE_KEY_STUDENT_BENCHMARK,
          JSON.stringify({
            benchmarkMode: "compare",
            studentJobTitle,
            studentJobLocation,
            studentOfferedSalary,
            studentCareerStage,
            studentExperienceYears,
            studentSalaryData,
            studentCurrencyUsed,
            compareA,
            compareB,
            compareResultA: ra.data,
            compareResultB: rb.data,
            compareCurrencyA: ra.currency,
            compareCurrencyB: rb.currency,
            compareMentorNotes,
          })
        );
      } catch {
        /* ignore */
      }
    } catch (e) {
      setCompareError(e?.message || "Network error");
    } finally {
      setCompareLoading(false);
    }
  };

  const studentDiscussCoach = async () => {
    if (!studentSalaryData?.median || typeof onDiscussWithCoach !== "function") return;
    const currency = studentCurrencyUsed || inferSalaryCurrencyFromLocation(studentJobLocation);
    const sym = studentSalaryData.currencySymbol || salaryCurrencySymbol(currency);
    const offerNum = studentOfferedSalary ? parseFloat(studentOfferedSalary) : NaN;
    const offerPart =
      Number.isFinite(offerNum) && studentSalaryData.p25
        ? `Offer of ${sym}${offerNum.toLocaleString()} is ${studentSalaryData.percentileRating} — ${studentSalaryData.negotiationStrength} leverage. `
        : "";
    const cohortLabel =
      studentCareerStage === "intern"
        ? "internship"
        : studentCareerStage === "early_career"
          ? "early-career"
          : "new grad / first full-time";
    const yoePart =
      typeof studentExperienceYears === "number"
        ? ` · ~${studentExperienceYears} yr(s) experience`
        : "";
    const tail =
      typeof studentSalaryData.benchmarkDisclaimer === "string" && studentSalaryData.benchmarkDisclaimer.trim()
        ? `\nNote: ${studentSalaryData.benchmarkDisclaimer.trim()}`
        : "";
    const msg = `I'm preparing to negotiate (${cohortLabel}${yoePart}). Here's my market benchmark — please coach me on leverage and next steps.\n\n[Market Data] ${studentSalaryData.occupation} in ${studentSalaryData.location}: 25th=${sym}${studentSalaryData.p25?.toLocaleString()}, Median=${sym}${studentSalaryData.median?.toLocaleString()}, 75th=${sym}${studentSalaryData.p75?.toLocaleString()}. ${offerPart}Source: ${studentSalaryData.source}${tail}`;
    await onDiscussWithCoach(msg);
  };

  const studentDiscussCompareCoach = async () => {
    if (!compareResultA?.median || !compareResultB?.median || typeof onDiscussWithCoach !== "function") return;
    const symA = compareResultA.currencySymbol || salaryCurrencySymbol(compareCurrencyA);
    const symB = compareResultB.currencySymbol || salaryCurrencySymbol(compareCurrencyB);

    const block = (tag, offer, sym, data) => {
      const cohort =
        offer.careerStage === "intern"
          ? "internship"
          : offer.careerStage === "early_career"
            ? "early-career"
            : "new grad / first full-time";
      const off = offer.offeredSalary ? parseFloat(String(offer.offeredSalary)) : NaN;
      const offerLine =
        Number.isFinite(off) && data.p25
          ? `Stated compensation ${sym}${off.toLocaleString()} → ${data.percentileRating} (${data.negotiationStrength} negotiation leverage vs this market band). `
          : "";
      const disc =
        typeof data.benchmarkDisclaimer === "string" && data.benchmarkDisclaimer.trim()
          ? `Cohort note: ${data.benchmarkDisclaimer.trim()} `
          : "";
      const employer = offer.company?.trim()
        ? `Employer / company: ${offer.company.trim()}`
        : "Employer / company: (not specified—I still want advice on how to evaluate employers like this.)";
      const ctx = offer.roleContext?.trim()
        ? `Role & team context: ${offer.roleContext.trim()}`
        : "";
      return (
        `${tag} (${cohort}, ~${offer.experienceYears} yr exp)\n` +
        `${employer}\n` +
        `Job title I applied for: "${offer.jobTitle.trim()}" · Benchmark occupation label: ${data.occupation}\n` +
        `${ctx ? `${ctx}\n` : ""}` +
        `Location (market): ${data.location}\n` +
        `Market percentiles — 25th=${sym}${data.p25?.toLocaleString()}, Median=${sym}${data.median?.toLocaleString()}, 75th=${sym}${data.p75?.toLocaleString()}.\n` +
        `${offerLine}${disc}Source: ${data.source}`
      );
    };

    const priorities =
      compareMentorNotes.trim().length > 0
        ? `\nWhat matters to me beyond headline pay:\n${compareMentorNotes.trim()}\n`
        : "";

    const msg =
      `I'm comparing two opportunities as a student/new grad and want mentor-style coaching—not only whether the numbers match the market.\n\n` +
      `Please help me weigh company (reputation, stage, learning curve, stability), role (scope, ownership, team, stack), location, and compensation vs benchmarks. Suggest how to negotiate each offer and what tradeoffs might be worth it.${priorities}\n` +
      `---\n${block("Offer A", compareA, symA, compareResultA)}\n\n---\n${block("Offer B", compareB, symB, compareResultB)}`;

    await onDiscussWithCoach(msg);
  };

  const fillFiveYearFromCompareOffers = () => {
    const pa = compareA.offeredSalary ? parseFloat(String(compareA.offeredSalary)) : NaN;
    const pb = compareB.offeredSalary ? parseFloat(String(compareB.offeredSalary)) : NaN;
    if (Number.isFinite(pa)) setFiveYearSalaryA(String(Math.round(pa)));
    if (Number.isFinite(pb)) setFiveYearSalaryB(String(Math.round(pb)));
  };

  const studentDiscussFiveYearCoach = async () => {
    if (typeof onDiscussWithCoach !== "function") return;
    const r = parseFloat(String(fiveYearRaisePct));
    const raise = Number.isFinite(r) ? r : 3;
    const fa = parseFloat(String(fiveYearSalaryA));
    const fb = parseFloat(String(fiveYearSalaryB));
    const cumA = cumulativeFiveYearEarnings(fa, raise);
    const cumB = cumulativeFiveYearEarnings(fb, raise);
    if (cumA == null || cumB == null) return;
    const delta = cumB - cumA;
    const msg =
      `I'd like mentor perspective on five-year earnings—not just first-year pay.\n\n` +
      `Illustrative model: same ${raise}% annual merit/market raise assumption applied to both tracks; cumulative cash compensation over five years.\n` +
      `Track A starting salary (annual): ${fa.toLocaleString()} → five-year cumulative ≈ ${Math.round(cumA).toLocaleString()}.\n` +
      `Track B starting salary (annual): ${fb.toLocaleString()} → five-year cumulative ≈ ${Math.round(cumB).toLocaleString()}.\n` +
      `Difference (B − A) over five years ≈ ${delta >= 0 ? "+" : ""}${Math.round(delta).toLocaleString()}.\n\n` +
      `How should I weigh this against company fit, learning, and location as a student / new grad?`;

    await onDiscussWithCoach(msg);
  };

  const primaryEmail = user?.primaryEmailAddress?.emailAddress || "";
  const studentSymDisplay = studentSalaryData?.currencySymbol || salaryCurrencySymbol(studentCurrencyUsed);
  const inferredStudentCurrency = inferSalaryCurrencyFromLocation(studentJobLocation);
  const inferredCompareA = inferSalaryCurrencyFromLocation(compareA.location);
  const inferredCompareB = inferSalaryCurrencyFromLocation(compareB.location);

  const compareSameCurrency =
    compareResultA &&
    compareResultB &&
    compareResultA.currency === compareResultB.currency &&
    compareResultA.median != null &&
    compareResultB.median != null;
  const pctA = compareSameCurrency ? pctVsMedian(compareA.offeredSalary, compareResultA.median) : null;
  const pctB = compareSameCurrency ? pctVsMedian(compareB.offeredSalary, compareResultB.median) : null;

  const fyRaiseParsed = parseFloat(String(fiveYearRaisePct));
  const fyRaiseEffective = Number.isFinite(fyRaiseParsed) ? fyRaiseParsed : 3;
  const fyBaseA = parseFloat(String(fiveYearSalaryA));
  const fyBaseB = parseFloat(String(fiveYearSalaryB));
  const fyCumA = cumulativeFiveYearEarnings(fyBaseA, fyRaiseEffective);
  const fyCumB = cumulativeFiveYearEarnings(fyBaseB, fyRaiseEffective);
  const fyDelta = fyCumA != null && fyCumB != null ? fyCumB - fyCumA : null;

  const canFillFiveYearFromCompare = (() => {
    const pa = compareA.offeredSalary ? parseFloat(String(compareA.offeredSalary)) : NaN;
    const pb = compareB.offeredSalary ? parseFloat(String(compareB.offeredSalary)) : NaN;
    return Number.isFinite(pa) || Number.isFinite(pb);
  })();

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.35rem", color: T.textPrimary, marginBottom: "0.35rem" }}>
            Students & fresh grads
          </h2>
          <p style={{ fontSize: "0.82rem", color: T.textSecondary, margin: 0, lineHeight: 1.6 }}>
            Negotiation coaching for professionals — plus benchmarks, compare offers, career path explorer, and university verification when your school partners with us.
          </p>
        </div>

        <div role="tablist" aria-label="Student tools" style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginBottom: "0.35rem" }}>
          {[
            { id: "paths", label: "Career paths" },
            { id: "offers", label: "Offers & pay" },
            { id: "school", label: "School access" },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={studentSectionTab === id}
              onClick={() => setStudentSectionTab(/** @type {'offers' | 'paths' | 'school'} */ (id))}
              style={{
                padding: "0.45rem 0.95rem",
                borderRadius: "10px",
                border: studentSectionTab === id ? "2px solid #2563eb" : `1px solid ${T.border}`,
                background: studentSectionTab === id ? "rgba(37, 99, 235, 0.1)" : T.surfaceBg || T.cardBg,
                color: T.textPrimary,
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: "0.72rem", color: T.textMuted, margin: "0 0 1rem", lineHeight: 1.5 }}>
          {studentSectionTab === "paths" &&
            "Grounded lateral career arcs you can compare to your default assumption."}
          {studentSectionTab === "offers" &&
            "Market benchmarks, side-by-side offer compare, and a simple five-year cash illustration."}
          {studentSectionTab === "school" && "University verification or tell us you are learning independently."}
        </p>

        {studentSectionTab === "offers" && (
          <>
            <div
              style={{
                border: `1px solid ${T.border}`,
                borderRadius: "12px",
                padding: "1rem",
                background: T.cardBg,
              }}
            >
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: T.textPrimary, margin: "0 0 0.25rem" }}>Market benchmark</h3>
          <p style={{ fontSize: "0.78rem", color: T.textSecondary, margin: "0 0 0.65rem", lineHeight: 1.55 }}>
            {benchmarkMode === "single"
              ? "Enter role, location, and cohort for market ranges; optionally add your offer to see negotiation leverage—then discuss with the coach. Switch to Compare two offers when you want employer names, role context, and priorities woven into side-by-side coaching."
              : "Compare two paths side by side. Name each employer and describe each role so coaching weighs company fit and trajectory—not only pay vs benchmarks."}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginBottom: "1rem" }}>
            <button
              type="button"
              onClick={() => {
                setBenchmarkMode("single");
                setStudentSalaryError(null);
                setCompareError(null);
              }}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: "10px",
                border: benchmarkMode === "single" ? "2px solid #2563eb" : `1px solid ${T.border}`,
                background: benchmarkMode === "single" ? "rgba(37, 99, 235, 0.1)" : T.surfaceBg || T.cardBg,
                color: T.textPrimary,
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              One offer
            </button>
            <button
              type="button"
              onClick={() => {
                setBenchmarkMode("compare");
                setStudentSalaryError(null);
                setCompareError(null);
              }}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: "10px",
                border: benchmarkMode === "compare" ? "2px solid #2563eb" : `1px solid ${T.border}`,
                background: benchmarkMode === "compare" ? "rgba(37, 99, 235, 0.1)" : T.surfaceBg || T.cardBg,
                color: T.textPrimary,
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Compare two offers
            </button>
          </div>

          {benchmarkMode === "single" ? (
            <>
          {!isSignedIn && (
            <p style={{ fontSize: "0.74rem", color: T.textMuted, margin: "0 0 0.75rem", lineHeight: 1.5 }}>
              Sign in to run a market check. Your last inputs restore from this browser after refresh.
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.65rem", marginBottom: "0.65rem" }}>
            <label>
              <span style={labelStyle}>Role / job title *</span>
              <input
                type="text"
                value={studentJobTitle}
                onChange={(e) => {
                  setStudentJobTitle(e.target.value);
                  setStudentSalaryError(null);
                }}
                placeholder="e.g. Software Engineer I"
                autoComplete="organization-title"
                style={inputStyle}
              />
            </label>
            <label>
              <span style={labelStyle}>Location</span>
              <input
                type="text"
                value={studentJobLocation}
                onChange={(e) => {
                  setStudentJobLocation(e.target.value);
                  setStudentSalaryError(null);
                }}
                placeholder="e.g. Austin TX · London UK · Bengaluru India"
                autoComplete="address-level2"
                style={inputStyle}
              />
            </label>
          </div>
          <label style={{ display: "block", marginBottom: "0.75rem" }}>
            <span style={labelStyle}>
              Offer amount (annual, optional)
              {inferredStudentCurrency === "INR" ? (
                <span style={{ color: T.textHint }}> — annual CTC e.g. 1200000 for 12 LPA</span>
              ) : null}
            </span>
            <input
              type="number"
              value={studentOfferedSalary}
              onChange={(e) => {
                setStudentOfferedSalary(e.target.value);
                setStudentSalaryError(null);
              }}
              placeholder={
                inferredStudentCurrency === "INR"
                  ? "e.g. 1200000"
                  : inferredStudentCurrency === "GBP"
                    ? "e.g. 42000"
                    : "e.g. 95000"
              }
              style={inputStyle}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.65rem", marginBottom: "0.65rem" }}>
            <label>
              <span style={labelStyle}>Career stage</span>
              <select
                value={studentCareerStage}
                onChange={(e) => {
                  setStudentCareerStage(/** @type {'intern'|'new_grad'|'early_career'} */ (e.target.value));
                  setStudentSalaryError(null);
                }}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="intern">Internship</option>
                <option value="new_grad">First full-time / new grad</option>
                <option value="early_career">Early career (1–3 yrs)</option>
              </select>
            </label>
            <label>
              <span style={labelStyle}>Years experience (approx.)</span>
              <input
                type="number"
                min={0}
                max={60}
                step={1}
                value={studentExperienceYears}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setStudentExperienceYears(Number.isFinite(v) ? Math.min(Math.max(v, 0), 60) : 0);
                  setStudentSalaryError(null);
                }}
                style={inputStyle}
              />
            </label>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", marginBottom: studentSalaryError ? "0.5rem" : "0.65rem" }}>
            <button
              type="button"
              disabled={!studentJobTitle.trim() || studentSalaryLoading || !isSignedIn}
              onClick={studentLookupSalary}
              title={!isSignedIn ? "Sign in to run a market check" : undefined}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "10px",
                border: "none",
                background: !studentJobTitle.trim() || studentSalaryLoading || !isSignedIn ? T.border : "#1d4ed8",
                color: !studentJobTitle.trim() || studentSalaryLoading || !isSignedIn ? T.textMuted : "white",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: !studentJobTitle.trim() || studentSalaryLoading || !isSignedIn ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {studentSalaryLoading ? "Looking up…" : "Get market check →"}
            </button>
          </div>

          {studentSalaryError && (
            <p style={{ fontSize: "0.78rem", color: "#f87171", margin: "0 0 0.65rem", lineHeight: 1.55 }}>{studentSalaryError}</p>
          )}

          {studentSalaryData && !studentSalaryLoading && studentSalaryData.median != null && (
            <div style={{ marginTop: "0.25rem", paddingTop: "0.85rem", borderTop: `1px solid ${T.border}` }}>
              <StudentBenchmarkResultCard
                T={T}
                salaryData={studentSalaryData}
                offeredSalaryStr={studentOfferedSalary}
                inferredCurrency={studentCurrencyUsed || inferredStudentCurrency}
                embedded
              />
              <button
                type="button"
                disabled={typeof onDiscussWithCoach !== "function"}
                onClick={studentDiscussCoach}
                style={{
                  padding: "0.45rem 1rem",
                  borderRadius: "10px",
                  border: `1px solid ${T.border}`,
                  background: typeof onDiscussWithCoach === "function" ? "rgba(29, 78, 216, 0.12)" : T.border,
                  color: typeof onDiscussWithCoach === "function" ? "#1d4ed8" : T.textMuted,
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: typeof onDiscussWithCoach === "function" ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                }}
              >
                Discuss this with the coach →
              </button>
            </div>
          )}
            </>
          ) : (
            <>
              {!isSignedIn && (
                <p style={{ fontSize: "0.74rem", color: T.textMuted, margin: "0 0 0.75rem", lineHeight: 1.5 }}>
                  Sign in to compare both offers. Inputs restore from this browser after refresh.
                </p>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "0.75rem",
                  marginBottom: "0.65rem",
                }}
              >
                {[
                  {
                    tag: "Offer A",
                    offer: compareA,
                    setOffer: setCompareA,
                    inferred: inferredCompareA,
                  },
                  {
                    tag: "Offer B",
                    offer: compareB,
                    setOffer: setCompareB,
                    inferred: inferredCompareB,
                  },
                ].map(({ tag, offer, setOffer, inferred }) => (
                  <div
                    key={tag}
                    style={{
                      border: `1px solid ${T.border}`,
                      borderRadius: "10px",
                      padding: "0.75rem",
                      background: T.surfaceBg || T.cardBg,
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: T.textPrimary, marginBottom: "0.5rem" }}>{tag}</div>
                    <label style={{ display: "block", marginBottom: "0.5rem" }}>
                      <span style={labelStyle}>Role / job title *</span>
                      <input
                        type="text"
                        value={offer.jobTitle}
                        onChange={(e) => {
                          setOffer((p) => ({ ...p, jobTitle: e.target.value }));
                          setCompareError(null);
                        }}
                        placeholder="e.g. Software Engineer I"
                        autoComplete="organization-title"
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: "block", marginBottom: "0.5rem" }}>
                      <span style={labelStyle}>Company / employer (optional)</span>
                      <input
                        type="text"
                        value={offer.company}
                        onChange={(e) => {
                          setOffer((p) => ({ ...p, company: e.target.value }));
                          setCompareError(null);
                        }}
                        placeholder="e.g. Stripe · NHS Digital · Infosys"
                        autoComplete="organization"
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: "block", marginBottom: "0.5rem" }}>
                      <span style={labelStyle}>Location</span>
                      <input
                        type="text"
                        value={offer.location}
                        onChange={(e) => {
                          setOffer((p) => ({ ...p, location: e.target.value }));
                          setCompareError(null);
                        }}
                        placeholder="e.g. Austin TX · London UK"
                        autoComplete="address-level2"
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: "block", marginBottom: "0.5rem" }}>
                      <span style={labelStyle}>
                        Offer amount (annual, optional)
                        {inferred === "INR" ? (
                          <span style={{ color: T.textHint }}> — annual CTC e.g. 1200000 for 12 LPA</span>
                        ) : null}
                      </span>
                      <input
                        type="number"
                        value={offer.offeredSalary}
                        onChange={(e) => {
                          setOffer((p) => ({ ...p, offeredSalary: e.target.value }));
                          setCompareError(null);
                        }}
                        placeholder={
                          inferred === "INR" ? "e.g. 1200000" : inferred === "GBP" ? "e.g. 42000" : "e.g. 95000"
                        }
                        style={inputStyle}
                      />
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.45rem", marginBottom: "0.35rem" }}>
                      <label>
                        <span style={labelStyle}>Career stage</span>
                        <select
                          value={offer.careerStage}
                          onChange={(e) => {
                            setOffer((p) => ({
                              ...p,
                              careerStage: /** @type {'intern'|'new_grad'|'early_career'} */ (e.target.value),
                            }));
                            setCompareError(null);
                          }}
                          style={{ ...inputStyle, cursor: "pointer" }}
                        >
                          <option value="intern">Internship</option>
                          <option value="new_grad">First full-time / new grad</option>
                          <option value="early_career">Early career</option>
                        </select>
                      </label>
                      <label>
                        <span style={labelStyle}>Yrs exp.</span>
                        <input
                          type="number"
                          min={0}
                          max={60}
                          step={1}
                          value={offer.experienceYears}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            setOffer((p) => ({
                              ...p,
                              experienceYears: Number.isFinite(v) ? Math.min(Math.max(v, 0), 60) : 0,
                            }));
                            setCompareError(null);
                          }}
                          style={inputStyle}
                        />
                      </label>
                    </div>
                    <label style={{ display: "block", marginBottom: "0.35rem" }}>
                      <span style={labelStyle}>Role & team context (optional)</span>
                      <textarea
                        value={offer.roleContext}
                        onChange={(e) => {
                          setOffer((p) => ({ ...p, roleContext: e.target.value }));
                          setCompareError(null);
                        }}
                        placeholder="Team, product area, scope, stack, mentorship—anything that affects whether this role is right for you."
                        rows={3}
                        style={textareaStyle}
                      />
                    </label>
                  </div>
                ))}
              </div>

              <label style={{ display: "block", marginBottom: "0.65rem" }}>
                <span style={labelStyle}>Your priorities beyond pay (optional)</span>
                <textarea
                  value={compareMentorNotes}
                  onChange={(e) => {
                    setCompareMentorNotes(e.target.value);
                    setCompareError(null);
                  }}
                  placeholder="e.g. Learning and strong manager > max cash; need visa sponsorship; must stay in Texas; weighing startup vs big tech…"
                  rows={3}
                  style={textareaStyle}
                />
              </label>

              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", marginBottom: compareError ? "0.5rem" : "0.65rem" }}>
                <button
                  type="button"
                  disabled={!compareA.jobTitle.trim() || !compareB.jobTitle.trim() || compareLoading || !isSignedIn}
                  onClick={studentCompareBenchmarks}
                  title={!isSignedIn ? "Sign in to compare offers" : undefined}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "10px",
                    border: "none",
                    background:
                      !compareA.jobTitle.trim() || !compareB.jobTitle.trim() || compareLoading || !isSignedIn
                        ? T.border
                        : "#1d4ed8",
                    color:
                      !compareA.jobTitle.trim() || !compareB.jobTitle.trim() || compareLoading || !isSignedIn
                        ? T.textMuted
                        : "white",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor:
                      !compareA.jobTitle.trim() || !compareB.jobTitle.trim() || compareLoading || !isSignedIn
                        ? "not-allowed"
                        : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {compareLoading ? "Looking up both…" : "Compare both →"}
                </button>
              </div>

              {compareError && (
                <p style={{ fontSize: "0.78rem", color: "#f87171", margin: "0 0 0.65rem", lineHeight: 1.55 }}>{compareError}</p>
              )}

              {compareResultA &&
                compareResultB &&
                !compareLoading &&
                compareResultA.median != null &&
                compareResultB.median != null && (
                  <div style={{ marginTop: "0.35rem", paddingTop: "0.85rem", borderTop: `1px solid ${T.border}` }}>
                    <div
                      style={{
                        padding: "0.55rem 0.75rem",
                        marginBottom: "0.75rem",
                        borderRadius: "8px",
                        border: `1px solid ${T.border}`,
                        background: "rgba(37, 99, 235, 0.06)",
                      }}
                    >
                      <div style={{ fontSize: "0.7rem", fontWeight: 600, color: T.textPrimary, marginBottom: "0.35rem" }}>
                        Think like a mentor—not only vs market pay
                      </div>
                      <p style={{ fontSize: "0.72rem", color: T.textSecondary, margin: "0 0 0.45rem", lineHeight: 1.55 }}>
                        Employer names and role context you entered anchor coaching on fit and trajectory, not only percentiles.
                      </p>
                      <ul style={{ margin: 0, paddingLeft: "1.05rem", fontSize: "0.72rem", color: T.textSecondary, lineHeight: 1.55 }}>
                        <li>Company: stage, reputation, learning curve, stability</li>
                        <li>Role: ownership, team, mentorship, stack</li>
                        <li>Location & logistics: commute, cost of living, visa or relocation</li>
                      </ul>
                    </div>
                    {!compareSameCurrency ? (
                      <p style={{ fontSize: "0.72rem", color: T.textSecondary, margin: "0 0 0.75rem", lineHeight: 1.55 }}>
                        Benchmarks use different currencies ({compareResultA.currency} vs {compareResultB.currency}). Compare medians directionally rather than as exact deltas.
                      </p>
                    ) : (
                      <>
                        {(pctA != null || pctB != null) && (
                          <div
                            style={{
                              padding: "0.55rem 0.75rem",
                              background: T.surfaceBg || T.cardBg,
                              borderRadius: "8px",
                              border: `1px solid ${T.border}`,
                              fontSize: "0.74rem",
                              color: T.textSecondary,
                              marginBottom: "0.75rem",
                              lineHeight: 1.55,
                            }}
                          >
                            <strong style={{ color: T.textPrimary }}>Vs market median ({compareResultA.currency})</strong>
                            {pctA != null ? (
                              <span>
                                {" "}
                                · Offer A: {pctA >= 0 ? "+" : ""}
                                {pctA.toFixed(1)}% vs median
                              </span>
                            ) : (
                              <span> · Offer A: add an offer amount to see % vs median</span>
                            )}
                            {pctB != null ? (
                              <span>
                                {" "}
                                · Offer B: {pctB >= 0 ? "+" : ""}
                                {pctB.toFixed(1)}% vs median
                              </span>
                            ) : (
                              <span> · Offer B: add an offer amount to see % vs median</span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                        gap: "0.75rem",
                      }}
                    >
                      <div
                        style={{
                          border: `1px solid ${T.border}`,
                          borderRadius: "10px",
                          padding: "0.65rem",
                          background: T.cardBg,
                        }}
                      >
                        <StudentBenchmarkResultCard
                          T={T}
                          label="Offer A"
                          subtitle={compareA.company?.trim() ? `Employer: ${compareA.company.trim()}` : undefined}
                          salaryData={compareResultA}
                          offeredSalaryStr={compareA.offeredSalary}
                          inferredCurrency={compareCurrencyA}
                          embedded
                        />
                      </div>
                      <div
                        style={{
                          border: `1px solid ${T.border}`,
                          borderRadius: "10px",
                          padding: "0.65rem",
                          background: T.cardBg,
                        }}
                      >
                        <StudentBenchmarkResultCard
                          T={T}
                          label="Offer B"
                          subtitle={compareB.company?.trim() ? `Employer: ${compareB.company.trim()}` : undefined}
                          salaryData={compareResultB}
                          offeredSalaryStr={compareB.offeredSalary}
                          inferredCurrency={compareCurrencyB}
                          embedded
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={typeof onDiscussWithCoach !== "function"}
                      onClick={studentDiscussCompareCoach}
                      style={{
                        marginTop: "0.75rem",
                        padding: "0.45rem 1rem",
                        borderRadius: "10px",
                        border: `1px solid ${T.border}`,
                        background: typeof onDiscussWithCoach === "function" ? "rgba(29, 78, 216, 0.12)" : T.border,
                        color: typeof onDiscussWithCoach === "function" ? "#1d4ed8" : T.textMuted,
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        cursor: typeof onDiscussWithCoach === "function" ? "pointer" : "not-allowed",
                        fontFamily: "inherit",
                      }}
                    >
                      Discuss with coach →
                    </button>
                  </div>
                )}
            </>
          )}
        </div>

        <div
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: "12px",
            padding: "1rem",
            background: T.cardBg,
          }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: T.textPrimary, margin: "0 0 0.25rem" }}>
            Five-year earnings snapshot
          </h3>
          <p style={{ fontSize: "0.78rem", color: T.textSecondary, margin: "0 0 0.65rem", lineHeight: 1.55 }}>
            Rough cumulative cash over five years using the same year-over-year raise assumption for both tracks—helpful when headline salaries are close. Not tax, equity, or bonus modeling; illustrative only.
          </p>

          {canFillFiveYearFromCompare ? (
            <div style={{ marginBottom: "0.65rem" }}>
              <button
                type="button"
                onClick={fillFiveYearFromCompareOffers}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "8px",
                  border: `1px solid ${T.border}`,
                  background: T.surfaceBg || T.cardBg,
                  color: T.textPrimary,
                  fontSize: "0.76rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Fill starting salaries from compare offer amounts →
              </button>
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.65rem", marginBottom: "0.65rem" }}>
            <label>
              <span style={labelStyle}>Track A — starting salary (annual)</span>
              <input
                type="number"
                min={0}
                value={fiveYearSalaryA}
                onChange={(e) => setFiveYearSalaryA(e.target.value)}
                placeholder="e.g. 95000"
                style={inputStyle}
              />
            </label>
            <label>
              <span style={labelStyle}>Track B — starting salary (annual)</span>
              <input
                type="number"
                min={0}
                value={fiveYearSalaryB}
                onChange={(e) => setFiveYearSalaryB(e.target.value)}
                placeholder="e.g. 105000"
                style={inputStyle}
              />
            </label>
            <label>
              <span style={labelStyle}>Assumed YoY raise (both tracks)</span>
              <input
                type="number"
                step={0.5}
                value={fiveYearRaisePct}
                onChange={(e) => setFiveYearRaisePct(e.target.value)}
                placeholder="3"
                style={inputStyle}
              />
            </label>
          </div>

          <p style={{ fontSize: "0.68rem", color: T.textMuted, margin: "0 0 0.65rem", lineHeight: 1.5 }}>
            Use the same currency for both tracks. Raise applies equally so you can compare shapes of the two paths—not forecast anyone&apos;s real merit cycles.
          </p>

          {fyCumA != null && fyCumB != null ? (
            <div
              style={{
                padding: "0.65rem 0.85rem",
                borderRadius: "10px",
                border: `1px solid ${T.border}`,
                background: T.surfaceBg || T.cardBg,
                marginBottom: "0.65rem",
              }}
            >
              <div style={{ fontSize: "0.72rem", color: T.textMuted, marginBottom: "0.45rem" }}>
                Cumulative approx. cash ({fyRaiseEffective}% YoY), five years
              </div>
              <div style={{ fontSize: "0.82rem", color: T.textSecondary, lineHeight: 1.55 }}>
                <span style={{ color: T.textPrimary, fontWeight: 600 }}>Track A:</span>{" "}
                {Math.round(fyCumA).toLocaleString()}
                {" · "}
                <span style={{ color: T.textPrimary, fontWeight: 600 }}>Track B:</span>{" "}
                {Math.round(fyCumB).toLocaleString()}
              </div>
              {fyDelta != null ? (
                <div style={{ fontSize: "0.82rem", marginTop: "0.45rem", color: fyDelta >= 0 ? "#059669" : "#d97706" }}>
                  Difference (B − A): {fyDelta >= 0 ? "+" : ""}
                  {Math.round(fyDelta).toLocaleString()} over five years
                </div>
              ) : null}
            </div>
          ) : (
            <p style={{ fontSize: "0.76rem", color: T.textMuted, margin: "0 0 0.65rem" }}>
              Enter two positive starting salaries to see cumulative totals.
            </p>
          )}

          <button
            type="button"
            disabled={typeof onDiscussWithCoach !== "function" || fyCumA == null || fyCumB == null}
            onClick={studentDiscussFiveYearCoach}
            style={{
              padding: "0.45rem 1rem",
              borderRadius: "10px",
              border: `1px solid ${T.border}`,
              background:
                typeof onDiscussWithCoach === "function" && fyCumA != null && fyCumB != null
                  ? "rgba(29, 78, 216, 0.12)"
                  : T.border,
              color:
                typeof onDiscussWithCoach === "function" && fyCumA != null && fyCumB != null ? "#1d4ed8" : T.textMuted,
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor:
                typeof onDiscussWithCoach === "function" && fyCumA != null && fyCumB != null ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}
          >
            Discuss five-year tradeoffs with coach →
          </button>
        </div>
          </>
        )}

        {studentSectionTab === "paths" && (
          <StudentCareerPathExplorer
            T={T}
            getToken={getToken}
            isSignedIn={isSignedIn}
            onDiscussWithCoach={onDiscussWithCoach}
          />
        )}

        {studentSectionTab === "school" && (
          <>
        {path === null && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <button type="button" onClick={() => setPath("university")} style={card}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: T.textPrimary, marginBottom: "0.35rem" }}>Through my university</div>
              <div style={{ fontSize: "0.78rem", color: T.textSecondary, lineHeight: 1.55 }}>
                Your school shares access. We verify your email domain and invite code before unlocking sponsored tools.
              </div>
            </button>
            <button type="button" onClick={() => setPath("independent")} style={card}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: T.textPrimary, marginBottom: "0.35rem" }}>On my own</div>
              <div style={{ fontSize: "0.78rem", color: T.textSecondary, lineHeight: 1.55 }}>
                Sign up independently. Free tools to start; paid tiers for deeper comparison and coaching as we roll them out.
              </div>
            </button>
          </div>
        )}

        {path === "university" && (
          <div style={{ border: `1px solid ${T.border}`, borderRadius: "12px", padding: "1rem", background: T.cardBg }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: T.textPrimary, margin: "0 0 0.25rem" }}>University access</h3>
                <p style={{ fontSize: "0.78rem", color: T.textSecondary, margin: 0, lineHeight: 1.55 }}>
                  Verify with your school email and invite code from career services, or with a standalone invite code if your school uses that path.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPath(null);
                  setUnivVerifyMode("domain");
                  resetUniversityVerifyState();
                }}
                style={{
                  padding: "0.35rem 0.65rem",
                  borderRadius: "8px",
                  border: `1px solid ${T.border}`,
                  background: "transparent",
                  color: T.textMuted,
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Change path
              </button>
            </div>

            {isSignedIn && primaryEmail && univVerifyMode === "domain" && (
              <p style={{ fontSize: "0.74rem", color: T.textMuted, margin: "0 0 0.75rem", lineHeight: 1.5 }}>
                Signed in as <strong style={{ color: T.textSecondary }}>{primaryEmail}</strong> — enter your university email below if different.
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 420 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => {
                    setUnivVerifyMode("domain");
                    clearVerifyError();
                  }}
                  style={{
                    padding: "0.4rem 0.75rem",
                    borderRadius: "8px",
                    border:
                      univVerifyMode === "domain" ? `2px solid #2563eb` : `1px solid ${T.border}`,
                    background: univVerifyMode === "domain" ? "rgba(37, 99, 235, 0.12)" : T.surfaceBg || T.cardBg,
                    color: T.textPrimary,
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  School email + code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUnivVerifyMode("invite_only");
                    clearVerifyError();
                  }}
                  style={{
                    padding: "0.4rem 0.75rem",
                    borderRadius: "8px",
                    border:
                      univVerifyMode === "invite_only" ? `2px solid #2563eb` : `1px solid ${T.border}`,
                    background:
                      univVerifyMode === "invite_only" ? "rgba(37, 99, 235, 0.12)" : T.surfaceBg || T.cardBg,
                    color: T.textPrimary,
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Invite code only
                </button>
              </div>

              {univVerifyMode === "domain" && (
                <label>
                  <span style={labelStyle}>University email</span>
                  <input
                    type="email"
                    value={uniEmail}
                    onChange={(e) => {
                      setUniEmail(e.target.value);
                      clearVerifyError();
                    }}
                    placeholder="you@student.demo-state.edu"
                    autoComplete="email"
                    style={inputStyle}
                  />
                </label>
              )}
              {univVerifyMode === "invite_only" && (
                <p style={{ fontSize: "0.74rem", color: T.textMuted, margin: 0, lineHeight: 1.5 }}>
                  No school inbox required — your code maps to one partner school on the server.
                </p>
              )}
              <label>
                <span style={labelStyle}>Invite code</span>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value);
                    clearVerifyError();
                  }}
                  placeholder={univVerifyMode === "invite_only" ? "e.g. state-demo-invite-only" : "From career center"}
                  autoComplete="off"
                  style={inputStyle}
                />
              </label>
              {univVerifyMode === "domain" && (
                <label>
                  <span style={labelStyle}>School name (optional)</span>
                  <input
                    type="text"
                    value={uniName}
                    onChange={(e) => setUniName(e.target.value)}
                    placeholder="Not used for verification yet"
                    style={inputStyle}
                  />
                </label>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
                <button
                  type="button"
                  disabled={
                    verifyLoading ||
                    !inviteCode.trim() ||
                    !isSignedIn ||
                    (univVerifyMode === "domain" && !uniEmail.trim())
                  }
                  onClick={handleVerifyUniversity}
                  title={!isSignedIn ? "Sign in first to verify" : undefined}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "10px",
                    border: "none",
                    background:
                      verifyLoading ||
                      !inviteCode.trim() ||
                      !isSignedIn ||
                      (univVerifyMode === "domain" && !uniEmail.trim())
                        ? T.border
                        : "#1d4ed8",
                    color:
                      verifyLoading ||
                      !inviteCode.trim() ||
                      !isSignedIn ||
                      (univVerifyMode === "domain" && !uniEmail.trim())
                        ? T.textMuted
                        : "white",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor:
                      verifyLoading ||
                      !inviteCode.trim() ||
                      !isSignedIn ||
                      (univVerifyMode === "domain" && !uniEmail.trim())
                        ? "not-allowed"
                        : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {verifyLoading ? "Verifying…" : "Verify access"}
                </button>
                {!isSignedIn && (
                  <>
                    <span style={{ fontSize: "0.76rem", color: T.textMuted }}>or</span>
                    <button
                      type="button"
                      onClick={() => typeof onSignIn === "function" && onSignIn()}
                      style={{
                        padding: "0.5rem 1rem",
                        borderRadius: "10px",
                        border: `1px solid ${T.border}`,
                        background: T.cardBg,
                        color: T.textPrimary,
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Sign in to verify
                    </button>
                  </>
                )}
              </div>
              {!isSignedIn && (
                <p style={{ fontSize: "0.74rem", color: T.textSecondary, margin: 0, lineHeight: 1.5 }}>
                  {univVerifyMode === "domain"
                    ? "Verification is saved to your signed-in account. Fill email + invite code, then sign in or use Verify access after signing in."
                    : "Enter your standalone invite code, sign in, then tap Verify access."}
                </p>
              )}

              {verifyError && (
                <p style={{ fontSize: "0.78rem", color: "#f87171", margin: 0, lineHeight: 1.55 }}>{verifyError}</p>
              )}
              {verifySuccess && (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "10px",
                    border: `1px solid rgba(34, 197, 94, 0.35)`,
                    background: "rgba(34, 197, 94, 0.08)",
                  }}
                >
                  <p style={{ fontSize: "0.82rem", color: T.textPrimary, margin: "0 0 0.35rem", fontWeight: 600 }}>
                    {verifySuccess.alreadyVerified ? "Already verified" : "Access verified"}
                  </p>
                  <p style={{ fontSize: "0.78rem", color: T.textSecondary, margin: 0, lineHeight: 1.55 }}>
                    {verifySuccess.alreadyVerified ? "You're already linked to " : "You're verified for "}
                    <strong>{verifySuccess.name}</strong>
                    {verifySuccess.slug ? ` (${verifySuccess.slug})` : ""}.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {path === "independent" && (
          <div style={{ border: `1px solid ${T.border}`, borderRadius: "12px", padding: "1rem", background: T.cardBg }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: T.textPrimary, margin: "0 0 0.25rem" }}>Independent student</h3>
                <p style={{ fontSize: "0.78rem", color: T.textSecondary, margin: 0, lineHeight: 1.55 }}>
                  Tell us a bit about your situation. Full profiles and pricing will connect to checkout in a later ship.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPath(null)}
                style={{
                  padding: "0.35rem 0.65rem",
                  borderRadius: "8px",
                  border: `1px solid ${T.border}`,
                  background: "transparent",
                  color: T.textMuted,
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Change path
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
              <label>
                <span style={labelStyle}>Degree</span>
                <select value={degree} onChange={(e) => setDegree(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="undergraduate">Undergraduate</option>
                  <option value="masters">Master&apos;s</option>
                  <option value="mba">MBA</option>
                  <option value="bootcamp">Boot camp / certificate</option>
                </select>
              </label>
              <label>
                <span style={labelStyle}>Major / field</span>
                <input type="text" value={major} onChange={(e) => setMajor(e.target.value)} placeholder="e.g. Computer Science" style={inputStyle} />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                <span style={labelStyle}>Expected graduation</span>
                <input type="text" value={gradTerm} onChange={(e) => setGradTerm(e.target.value)} placeholder="e.g. Spring 2026" style={inputStyle} />
              </label>
            </div>

            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "10px",
                background: "rgba(29, 78, 216, 0.08)",
                border: `1px solid ${T.border}`,
              }}
            >
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: T.textMuted, marginBottom: "0.35rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Planned pricing (preview)
              </div>
              <p style={{ fontSize: "0.78rem", color: T.textSecondary, margin: 0, lineHeight: 1.55 }}>
                Free tier for basics; paid student tiers for deeper comparison and scripts — rates will match Stripe when we enable checkout for students.
              </p>
            </div>
          </div>
        )}
          </>
        )}

        <div style={{ border: `1px dashed ${T.border}`, borderRadius: "12px", padding: "1rem", background: T.surfaceBg || "transparent" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: T.textMuted, marginBottom: "0.5rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Roadmap
          </div>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem", color: T.textSecondary, lineHeight: 1.65 }}>
            <li>Student-safe negotiation guide & scripts</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
