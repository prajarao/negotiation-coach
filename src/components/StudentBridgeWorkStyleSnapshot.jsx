import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { WORK_STYLE_THEMES } from "../constants/workStyleThemes.js";
import { BRIDGE_VOCATIONAL_INTEREST_ITEMS } from "../data/bridgeVocationalInterestItems.js";
import { formatBridgeInterestCoachMessage } from "../utils/bridgeInterestCoachPayload.js";
import {
  freeSnapshotCoachUsed,
  markFreeSnapshotCoachUsed,
} from "../utils/bridgeSnapshotCoachQuota.js";
import {
  scoreWorkStyleThemes,
  rankThemes,
  themeLabel,
  isCompleteAssessment,
} from "../utils/vocationalInterestScore.js";

const STORAGE_KEY = "offeradvisor_bridge_interest_v1";

const LIKERT = [
  { v: 1, short: "No", long: "Not at all for me" },
  { v: 2, short: "Slight no", long: "Mostly no" },
  { v: 3, short: "Mixed", long: "Neutral / depends" },
  { v: 4, short: "Slight yes", long: "Mostly yes" },
  { v: 5, short: "Yes", long: "Very much yes" },
];

/** Desktop/tablet: several prompts per page; mobile (narrow): one prompt at a time. */
const CAREER_BLUEPRINT_DESKTOP_PAGE_SIZE = 6;
const CAREER_BLUEPRINT_MOBILE_PAGE_SIZE = 1;
const CAREER_BLUEPRINT_MOBILE_MQ = "(max-width: 639px)";

/** @returns {number} */
function getCareerBlueprintPageSize() {
  if (typeof window === "undefined") return CAREER_BLUEPRINT_DESKTOP_PAGE_SIZE;
  return window.matchMedia(CAREER_BLUEPRINT_MOBILE_MQ).matches
    ? CAREER_BLUEPRINT_MOBILE_PAGE_SIZE
    : CAREER_BLUEPRINT_DESKTOP_PAGE_SIZE;
}

/**
 * OfferAdvisor Career Blueprint — original prompts, no third-party inventories.
 *
 * @param {object} props
 * @param {object} props.T
 * @param {(text: string) => boolean | void | Promise<boolean | void>} [props.onDiscussWithCoach]
 * @param {boolean} [props.isSignedIn]
 * @param {boolean} [props.guestCareerBlueprintCoachExhausted] — signed-out visitor used one try-on reply (browser)
 * @param {string | null | undefined} [props.userId] — Clerk user id for free-tier quota
 * @param {string} [props.userPlan]
 * @param {() => void} [props.onSignIn]
 * @param {() => void} [props.onViewPlans] — opens plan / upgrade modal when free quota exhausted
 * @param {(enabled: boolean) => void} [props.onCoachStripAvailabilityChange] — `true` when results phase (coach strip may show)
 */
export default function StudentBridgeWorkStyleSnapshot({
  T,
  onDiscussWithCoach,
  isSignedIn = false,
  guestCareerBlueprintCoachExhausted = false,
  userId = null,
  userPlan = "free",
  onSignIn,
  onViewPlans,
  onCoachStripAvailabilityChange,
}) {
  /** @type {Record<string, number>} */
  const [responses, setResponses] = useState({});
  /** 'intro' | 'flow' | 'results' */
  const [phase, setPhase] = useState("intro");
  const [page, setPage] = useState(0);
  const [coachNote, setCoachNote] = useState("");
  const [coachSending, setCoachSending] = useState(false);
  const [freeCoachExhausted, setFreeCoachExhausted] = useState(false);
  /** Steps per swipe/page: 1 on small phones, 6 on wider viewports */
  const [pageSize, setPageSize] = useState(() => getCareerBlueprintPageSize());
  const prevPageSizeRef = useRef(pageSize);
  /** Pages after the first: “How to answer” is a collapsible hint (default closed). */
  const [howToHintOpen, setHowToHintOpen] = useState(false);

  const isFreePlan = userPlan === "free";

  useEffect(() => {
    if (page > 0) setHowToHintOpen(false);
  }, [page]);

  useEffect(() => {
    if (!isSignedIn || !userId || !isFreePlan) {
      setFreeCoachExhausted(false);
      return;
    }
    setFreeCoachExhausted(freeSnapshotCoachUsed(userId));
  }, [isSignedIn, userId, isFreePlan]);

  useEffect(() => {
    const mq = window.matchMedia(CAREER_BLUEPRINT_MOBILE_MQ);
    const sync = () => setPageSize(getCareerBlueprintPageSize());
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const items = BRIDGE_VOCATIONAL_INTEREST_ITEMS;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    const prev = prevPageSizeRef.current;
    if (prev === pageSize || items.length === 0) return;
    setPage((p) => {
      const sliceStart = p * prev;
      const maxPage = Math.max(0, Math.ceil(items.length / pageSize) - 1);
      return Math.min(Math.max(0, Math.floor(sliceStart / pageSize)), maxPage);
    });
    prevPageSizeRef.current = pageSize;
  }, [pageSize, items.length]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.responses && typeof parsed.responses === "object") setResponses(parsed.responses);
      if (parsed.phase === "flow" || parsed.phase === "results") setPhase(parsed.phase);
      if (typeof parsed.page === "number" && parsed.page >= 0) setPage(parsed.page);
      if (typeof parsed.coachNote === "string") setCoachNote(parsed.coachNote);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    onCoachStripAvailabilityChange?.(phase === "results");
  }, [phase, onCoachStripAvailabilityChange]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ responses, phase, page, coachNote }));
    } catch {
      /* ignore */
    }
  }, [responses, phase, page, coachNote]);

  const scored = useMemo(() => scoreWorkStyleThemes(items, responses), [items, responses]);
  const ranked = useMemo(() => rankThemes(scored), [scored]);
  const complete = useMemo(() => isCompleteAssessment(items, responses), [items, responses]);

  const pageSlice = items.slice(page * pageSize, page * pageSize + pageSize);

  const startFresh = useCallback(() => {
    setResponses({});
    setPage(0);
    setPhase("flow");
    setCoachNote("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const goToResults = useCallback(() => {
    if (complete) setPhase("results");
  }, [complete]);

  const handleLikert = (itemId, v) => {
    setResponses((prev) => ({ ...prev, [itemId]: v }));
  };

  const discussWithCoach = async () => {
    if (!complete || typeof onDiscussWithCoach !== "function") return;

    if (!isSignedIn) {
      if (guestCareerBlueprintCoachExhausted) {
        onSignIn?.();
        return;
      }
    } else if (isFreePlan && userId && freeSnapshotCoachUsed(userId)) {
      onViewPlans?.();
      return;
    }

    const text = formatBridgeInterestCoachMessage({ scored, ranked, userNote: coachNote });
    setCoachSending(true);
    try {
      const ok = Boolean(await Promise.resolve(onDiscussWithCoach(text)));
      if (isFreePlan && userId && ok) {
        markFreeSnapshotCoachUsed(userId);
        setFreeCoachExhausted(true);
      }
    } finally {
      setCoachSending(false);
    }
  };

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

  const card = {
    border: `1px solid ${T.border}`,
    borderRadius: "12px",
    padding: "1rem",
    background: T.cardBg,
  };

  if (phase === "intro") {
    return (
      <div style={card}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, color: T.textPrimary, margin: "0 0 0.35rem" }}>
          Career Blueprint
        </h3>
        <p style={{ fontSize: "0.78rem", color: T.textSecondary, margin: "0 0 0.85rem", lineHeight: 1.55 }}>
          A quick {items.length}-prompt pulse on where your work energy points. Rate each line on your terms—use it for reflection or to seed a coach thread.
        </p>
        {!isSignedIn && (
          <p style={{ fontSize: "0.74rem", color: T.textMuted, margin: "0 0 0.85rem", lineHeight: 1.55 }}>
            Without signing in you can try <strong style={{ color: T.textSecondary }}>one complimentary AI reply</strong> when you send your Career Blueprint to the coach (this device). Then create a free account for another complimentary reply from Career Blueprint plus the rest of the app.
          </p>
        )}
        {isSignedIn && isFreePlan && (
          <p style={{ fontSize: "0.74rem", color: T.textMuted, margin: "0 0 0.85rem", lineHeight: 1.55 }}>
            Free accounts receive <strong style={{ color: T.textSecondary }}>one complimentary AI reply</strong> when you send these results to the coach. Paid plans unlock ongoing coaching conversations.
          </p>
        )}
        <p style={{ fontSize: "0.74rem", color: T.textMuted, margin: "0 0 0.85rem", lineHeight: 1.5 }}>
          For reflection and conversation only—not career counseling or psychological testing.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          {WORK_STYLE_THEMES.map((t) => (
            <div
              key={t.id}
              style={{
                padding: "0.5rem 0.65rem",
                borderRadius: "8px",
                border: `1px solid ${T.border}`,
                background: T.surfaceBg || T.cardBg,
                fontSize: "0.72rem",
              }}
            >
              <strong style={{ color: T.textPrimary, display: "block", marginBottom: "4px" }}>{t.label}</strong>
              <span style={{ color: T.textMuted, lineHeight: 1.45 }}>{t.blurb}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={startFresh}
            style={{
              padding: "0.45rem 1rem",
              borderRadius: "10px",
              border: "none",
              background: "#2563eb",
              color: "white",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Start Career Blueprint
          </button>
          {Object.keys(responses).length > 0 && (
            <button
              type="button"
              onClick={() => {
                setPhase(complete ? "results" : "flow");
              }}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: "10px",
                border: `1px solid ${T.border}`,
                background: T.surfaceBg || T.cardBg,
                color: T.textSecondary,
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Resume
            </button>
          )}
        </div>
      </div>
    );
  }

  if (phase === "results" && complete) {
    const topThree = ranked.slice(0, 3);
    const coachNoteDisabled =
      (!isSignedIn && guestCareerBlueprintCoachExhausted) ||
      (isFreePlan && isSignedIn && freeCoachExhausted);
    return (
      <div style={{ ...card, display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: T.textPrimary, margin: "0 0 0.35rem" }}>Your Career Blueprint readout</h3>
          <p style={{ fontSize: "0.78rem", color: T.textMuted, margin: 0, lineHeight: 1.5 }}>
            Strongest currents in this snapshot (by total score)—use as a hypothesis, not a verdict.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginBottom: "0.35rem" }}>
          {topThree.map((r) => (
            <span
              key={r.themeId}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: "999px",
                background: "rgba(37, 99, 235, 0.12)",
                color: "#1d4ed8",
                fontSize: "0.78rem",
                fontWeight: 600,
              }}
            >
              {themeLabel(r.themeId)}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {ranked.map((r) => (
            <div key={r.themeId}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.76rem", color: T.textPrimary, fontWeight: 600 }}>{themeLabel(r.themeId)}</span>
                <span style={{ fontSize: "0.72rem", color: T.textMuted }}>{r.sum} pts · {r.pct}% span</span>
              </div>
              <div style={{ height: "8px", borderRadius: "4px", background: T.surfaceBg || T.border, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, r.pct)}%`,
                    background: "linear-gradient(90deg, #2563eb, #6366f1)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.72rem", color: T.textMuted }}>Focus for coach (optional)</span>
          <textarea
            value={coachNote}
            onChange={(e) => setCoachNote(e.target.value)}
            disabled={coachNoteDisabled}
            rows={3}
            placeholder='e.g. "Intern debating return offer vs startup"…'
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.45 }}
          />
        </label>

        {!isSignedIn && guestCareerBlueprintCoachExhausted && (
          <div
            style={{
              padding: "0.75rem 0.95rem",
              borderRadius: "10px",
              border: `1px solid rgba(29,78,216,0.35)`,
              background: "rgba(29,78,216,0.08)",
              fontSize: "0.78rem",
              color: T.textSecondary,
              lineHeight: 1.55,
            }}
          >
            You’ve used your try-on coach reply from Career Blueprint on this browser.{" "}
            <strong style={{ color: T.textPrimary }}>Sign in or create a free account</strong> to get another complimentary reply and keep going.
          </div>
        )}

        {isFreePlan && isSignedIn && freeCoachExhausted && (
          <div
            style={{
              padding: "0.75rem 0.95rem",
              borderRadius: "10px",
              border: `1px solid rgba(29,78,216,0.35)`,
              background: "rgba(29,78,216,0.08)",
              fontSize: "0.78rem",
              color: T.textSecondary,
              lineHeight: 1.55,
            }}
          >
            You’ve already used your <strong style={{ color: T.textPrimary }}>complimentary coach reply</strong> from Career Blueprint on the Free plan.
            Upgrade to keep working with the coach on your interests, offers, and next steps.
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          {!isSignedIn && guestCareerBlueprintCoachExhausted ? (
            <button
              type="button"
              onClick={() => onSignIn?.()}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: "10px",
                border: "none",
                background: "#2563eb",
                color: "white",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: onSignIn ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                opacity: onSignIn ? 1 : 0.6,
              }}
            >
              Sign in or create account to continue →
            </button>
          ) : !isSignedIn ? (
            <button
              type="button"
              disabled={typeof onDiscussWithCoach !== "function" || coachSending}
              onClick={() => void discussWithCoach()}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: "10px",
                border: `1px solid ${T.border}`,
                background:
                  typeof onDiscussWithCoach === "function" && !coachSending ? "rgba(29, 78, 216, 0.12)" : T.border,
                color: typeof onDiscussWithCoach === "function" && !coachSending ? "#1d4ed8" : T.textMuted,
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: typeof onDiscussWithCoach === "function" && !coachSending ? "pointer" : "not-allowed",
                fontFamily: "inherit",
              }}
            >
              {coachSending ? "Opening coach…" : "Discuss Career Blueprint with coach →"}
            </button>
          ) : isFreePlan && freeCoachExhausted ? (
            <button
              type="button"
              onClick={() => onViewPlans?.()}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: "10px",
                border: `1px solid ${T.border}`,
                background: "rgba(29, 78, 216, 0.12)",
                color: "#1d4ed8",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: onViewPlans ? "pointer" : "not-allowed",
                fontFamily: "inherit",
              }}
            >
              View plans for more coaching →
            </button>
          ) : (
            <button
              type="button"
              disabled={typeof onDiscussWithCoach !== "function" || coachSending}
              onClick={() => void discussWithCoach()}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: "10px",
                border: `1px solid ${T.border}`,
                background:
                  typeof onDiscussWithCoach === "function" && !coachSending ? "rgba(29, 78, 216, 0.12)" : T.border,
                color: typeof onDiscussWithCoach === "function" && !coachSending ? "#1d4ed8" : T.textMuted,
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: typeof onDiscussWithCoach === "function" && !coachSending ? "pointer" : "not-allowed",
                fontFamily: "inherit",
              }}
            >
              {coachSending ? "Opening coach…" : "Discuss Career Blueprint with coach →"}
            </button>
          )}
          {!isSignedIn && !guestCareerBlueprintCoachExhausted && (
            <span style={{ fontSize: "0.7rem", color: T.textHint, maxWidth: "280px", lineHeight: 1.45 }}>
              Try-on: one AI reply without an account—then sign in when you’re ready for more.
            </span>
          )}
          {isFreePlan && isSignedIn && !freeCoachExhausted && (
            <span style={{ fontSize: "0.7rem", color: T.textHint, maxWidth: "280px", lineHeight: 1.45 }}>
              Free plan: one AI reply after you send Career Blueprint. Tap when you’re ready.
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              startFresh();
            }}
            style={{
              padding: "0.45rem 1rem",
              borderRadius: "10px",
              border: `1px solid ${T.border}`,
              background: "transparent",
              color: T.textSecondary,
              fontSize: "0.82rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Retake Career Blueprint
          </button>
          <button
            type="button"
            onClick={() => setPhase("flow")}
            style={{
              padding: "0.45rem 1rem",
              borderRadius: "10px",
              border: `1px solid ${T.border}`,
              background: "transparent",
              color: T.textMuted,
              fontSize: "0.8rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Review prompts
          </button>
        </div>
      </div>
    );
  }

  /** flow phase */
  const isCompactBlueprintFlow = pageSize === CAREER_BLUEPRINT_MOBILE_PAGE_SIZE;
  const likertBtnPadding =
    isCompactBlueprintFlow
      ? { padding: "0.42rem 0.7rem", fontSize: "0.78rem" }
      : { padding: "0.32rem 0.55rem", fontSize: "0.7rem" };

  /** First pagination page (shows full How to answer); later pages use a collapsible hint. */
  const isFirstPromptPage = page === 0;

  const howToAnswerScaleBody = (
    <>
      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: T.textMuted, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        How to answer
      </div>
      <p style={{ fontSize: "0.8rem", color: T.textPrimary, margin: "0 0 0.55rem", lineHeight: 1.5 }}>
        {isCompactBlueprintFlow ? (
          <>For this prompt, rate <strong>how much you’d enjoy</strong> spending time on that kind of work—not whether you’ve done it before.</>
        ) : (
          <>For each prompt below, rate <strong>how much you’d enjoy</strong> spending time on that kind of work—not whether you’ve done it before.</>
        )}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center", fontSize: "0.7rem", color: T.textMuted }}>
        {LIKERT.map((opt) => (
          <span key={opt.v} style={{ padding: "0.2rem 0.45rem", borderRadius: "6px", border: `1px solid ${T.border}`, background: T.cardBg }}>
            <strong style={{ color: T.textSecondary }}>{opt.short}</strong> · {opt.long}
          </span>
        ))}
      </div>
    </>
  );

  const blueprintHowToBlock = (
    <div
      style={{
        padding: "0.75rem 0.95rem",
        borderRadius: "10px",
        border: `1px solid ${T.border}`,
        background: T.surfaceBg || T.cardBg,
      }}
    >
      {howToAnswerScaleBody}
    </div>
  );

  const howToAnswerLaterPage = !isFirstPromptPage ? (
    <div
      style={{
        borderRadius: "10px",
        border: `1px solid ${T.border}`,
        background: T.surfaceBg || T.cardBg,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setHowToHintOpen((o) => !o)}
        aria-expanded={howToHintOpen}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          padding: "0.55rem 0.75rem",
          border: "none",
          background: "transparent",
          color: T.textSecondary,
          fontSize: "0.78rem",
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <span>How to answer (rating scale)</span>
        <span style={{ fontSize: "0.65rem", color: T.textMuted }}>{howToHintOpen ? "Hide ▲" : "Show ▼"}</span>
      </button>
      {howToHintOpen ? (
        <div style={{ padding: "0.75rem 0.95rem", borderTop: `1px solid ${T.border}` }}>{howToAnswerScaleBody}</div>
      ) : null}
    </div>
  ) : null;

  const blueprintPromptCards = pageSlice.map((row) => (
    <div
      key={row.id}
      style={{
        padding: "0.65rem",
        borderRadius: "10px",
        border: `1px solid ${T.border}`,
        background: T.surfaceBg || T.cardBg,
      }}
    >
      <p style={{ fontSize: "0.82rem", color: T.textPrimary, margin: "0 0 0.6rem", lineHeight: 1.5 }}>
        <strong>{row.text}</strong>
      </p>
      <div
        role="radiogroup"
        aria-label={`Enjoyment rating for prompt ${row.id}`}
        style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}
      >
        {LIKERT.map((opt) => {
          const selected = responses[row.id] === opt.v;
          return (
            <button
              key={opt.v}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => handleLikert(row.id, opt.v)}
              title={opt.long}
              style={{
                ...likertBtnPadding,
                borderRadius: "8px",
                border: selected ? "2px solid #2563eb" : `1px solid ${T.border}`,
                background: selected ? "rgba(37, 99, 235, 0.14)" : T.cardBg,
                color: selected ? "#1e40af" : T.textSecondary,
                fontWeight: selected ? 600 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {opt.short}
            </button>
          );
        })}
      </div>
    </div>
  ));

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: T.textPrimary, margin: "0 0 0.35rem" }}>Career Blueprint prompts</h3>
          <p style={{ fontSize: "0.74rem", color: T.textMuted, margin: 0, lineHeight: 1.5 }}>
            {isCompactBlueprintFlow ? (
              isFirstPromptPage ? (
                <>
                  Prompt {page + 1} of {items.length}. Answer on this prompt, then <strong style={{ color: T.textSecondary }}>Next prompt</strong> to continue.
                </>
              ) : (
                <>
                  Prompt {page + 1} of {items.length}. Open <strong>How to answer</strong> below if you need the rating scale.
                </>
              )
            ) : isFirstPromptPage ? (
              <>
                Page {page + 1} of {totalPages}. Use the “How to answer” guide above this page’s prompts.
              </>
            ) : (
              <>
                Page {page + 1} of {totalPages}. Rate each prompt on this page—open <strong>How to answer</strong> above if you need the scale.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPhase("intro")}
          style={{
            padding: "0.35rem 0.65rem",
            borderRadius: "8px",
            border: `1px solid ${T.border}`,
            background: "transparent",
            color: T.textMuted,
            fontSize: "0.74rem",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          About Career Blueprint
        </button>
      </div>

      {isCompactBlueprintFlow ? (
        <>
          {blueprintPromptCards}
          {isFirstPromptPage ? blueprintHowToBlock : howToAnswerLaterPage}
        </>
      ) : (
        <>
          {isFirstPromptPage ? blueprintHowToBlock : howToAnswerLaterPage}
          {blueprintPromptCards}
        </>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "0.45rem" }}>
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            style={{
              padding: "0.42rem 0.85rem",
              borderRadius: "8px",
              border: `1px solid ${T.border}`,
              background: page <= 0 ? T.surfaceBg || T.border : "transparent",
              color: page <= 0 ? T.textHint : T.textSecondary,
              fontSize: "0.78rem",
              cursor: page <= 0 ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            style={{
              padding: "0.42rem 0.85rem",
              borderRadius: "8px",
              border: `1px solid ${T.border}`,
              background: page >= totalPages - 1 ? T.surfaceBg || T.border : "transparent",
              color: page >= totalPages - 1 ? T.textHint : T.textSecondary,
              fontSize: "0.78rem",
              cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            Next {isCompactBlueprintFlow ? "prompt" : "page"}
          </button>
        </div>
        <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={!complete}
            onClick={goToResults}
            style={{
              padding: "0.42rem 0.95rem",
              borderRadius: "8px",
              border: complete ? "2px solid #2563eb" : `1px solid ${T.border}`,
              background: complete ? "#2563eb" : T.surfaceBg || T.border,
              color: complete ? "white" : T.textHint,
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: complete ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}
          >
            See results
          </button>
        </div>
      </div>
      <p style={{ fontSize: "0.68rem", color: T.textHint, margin: 0, lineHeight: 1.45 }}>
        Complete all prompts to unlock results {complete ? "(ready)" : `( ${Object.keys(responses).length} / ${items.length} )`}.
      </p>
    </div>
  );
}
