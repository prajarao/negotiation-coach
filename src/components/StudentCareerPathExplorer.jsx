import { useState, useEffect, useCallback } from "react";
import { useRegionPreferences } from "../context/RegionPreferencesContext.jsx";

const STORAGE_KEY = "offeradvisor_student_career_path_v1";

function emptyAssessment() {
  return {
    assumedCareerTitle: "",
    majorOrFocus: "",
    technicalIdentity: "breadth_first",
    projectsHighlights: "",
    collaborationStyle: "pair_teammate",
    domainsCurious: "",
    constraintsNotes: "",
    careerRisk: "balanced",
  };
}

/**
 * @param {object} props
 * @param {object} props.T — theme tokens (border, cardBg, …)
 * @param {(msg: string) => void | Promise<void>} [props.onDiscussWithCoach]
 * @param {() => Promise<string | null>} props.getToken
 * @param {boolean} props.isSignedIn
 */
export default function StudentCareerPathExplorer({ T, onDiscussWithCoach, getToken, isSignedIn }) {
  const { regionSeq } = useRegionPreferences();
  const [assessment, setAssessment] = useState(() => emptyAssessment());
  /** @type {null | { baselineEcho: object, alternatives: object[], globalDisclaimer: string, confidenceNote?: string }} */
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const resetForm = useCallback(() => {
    setAssessment(emptyAssessment());
    setResult(null);
    setError(null);
    setLoading(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (regionSeq === 0) return;
    resetForm();
  }, [regionSeq, resetForm]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.assessment && typeof parsed.assessment === "object") {
        setAssessment({ ...emptyAssessment(), ...parsed.assessment });
      }
      if (parsed.result && typeof parsed.result === "object") setResult(parsed.result);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ assessment, result }));
    } catch {
      /* ignore */
    }
  }, [assessment, result]);

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
    minHeight: "88px",
    resize: "vertical",
    lineHeight: 1.45,
  };

  const canSubmit =
    isSignedIn &&
    assessment.assumedCareerTitle.trim().length > 1 &&
    assessment.majorOrFocus.trim().length > 1 &&
    assessment.projectsHighlights.trim().length >= 12;

  const runExploration = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const jwt = await getToken();
      if (!jwt) {
        setError("Could not load session. Try signing in again.");
        return;
      }
      const res = await fetch("/api/student-career-paths", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ assessment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.message || `Request failed (${res.status})`);
        setResult(null);
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e?.message || "Network error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const discussWithCoach = useCallback(async () => {
    if (!result || typeof onDiscussWithCoach !== "function") return;
    const a = assessment;
    const base = result.baselineEcho;
    const alts = result.alternatives || [];
    const lines = [
      "I'd like to discuss career trajectory options — I used the Path explorer to compare my default assumption with lateral paths grounded in my skills.",
      "",
      "--- My inputs ---",
      `Assumed path: ${a.assumedCareerTitle.trim()}`,
      `Major / focus: ${a.majorOrFocus.trim()}`,
      `Technical lean: ${a.technicalIdentity}`,
      `Collaboration style: ${a.collaborationStyle}`,
      `Risk appetite: ${a.careerRisk}`,
      `Projects & achievements:\n${a.projectsHighlights.trim()}`,
      a.domainsCurious?.trim() ? `Domains curious about:\n${a.domainsCurious.trim()}` : "",
      a.constraintsNotes?.trim() ? `Constraints:\n${a.constraintsNotes.trim()}` : "",
      "",
      "--- Explorer summary ---",
      base?.title ? `Baseline echoed as: ${base.title}` : "",
      base?.summary ? base.summary : "",
      "",
      "Alternatives suggested:",
      ...alts.map((alt, i) => {
        const parts = [
          `${i + 1}. ${alt.title || "Option"} — ${alt.tagline || ""}`,
          ...(Array.isArray(alt.fitRationale) ? alt.fitRationale.map((x) => `   • ${x}`) : []),
          alt.differsFromBaseline ? `   Differs from my default: ${alt.differsFromBaseline}` : "",
        ];
        return parts.filter(Boolean).join("\n");
      }),
      "",
      typeof result.globalDisclaimer === "string" ? `Disclaimer: ${result.globalDisclaimer}` : "",
      typeof result.confidenceNote === "string" && result.confidenceNote.trim()
        ? `Note on confidence: ${result.confidenceNote.trim()}`
        : "",
      "",
      "Please help me pressure-test these arcs against what I actually want next year: realistic prep, hiring accessibility, and tradeoffs vs my baseline assumption.",
    ];
    await onDiscussWithCoach(lines.filter(Boolean).join("\n"));
  }, [result, assessment, onDiscussWithCoach]);

  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: "12px",
        padding: "1rem",
        background: T.cardBg,
      }}
    >
      <h3 style={{ fontSize: "1rem", fontWeight: 600, color: T.textPrimary, margin: "0 0 0.25rem" }}>
        Career path explorer
      </h3>
      <p style={{ fontSize: "0.78rem", color: T.textSecondary, margin: "0 0 0.65rem", lineHeight: 1.55 }}>
        Short assessment grounded in your projects and strengths — then compare your default career assumption with three lateral arcs that tie back to what you wrote (not generic job lists).
      </p>

      {!isSignedIn ? (
        <p style={{ fontSize: "0.74rem", color: T.textMuted, margin: "0 0 0.75rem", lineHeight: 1.5 }}>
          Sign in to generate paths. Draft answers restore from this browser after refresh.
        </p>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.65rem", marginBottom: "0.65rem" }}>
        <label>
          <span style={labelStyle}>Default career assumption *</span>
          <input
            type="text"
            value={assessment.assumedCareerTitle}
            onChange={(e) => {
              setAssessment((p) => ({ ...p, assumedCareerTitle: e.target.value }));
              setError(null);
            }}
            placeholder='e.g. "SWE at a large tech company"'
            autoComplete="off"
            style={inputStyle}
          />
        </label>
        <label>
          <span style={labelStyle}>Major / focus *</span>
          <input
            type="text"
            value={assessment.majorOrFocus}
            onChange={(e) => {
              setAssessment((p) => ({ ...p, majorOrFocus: e.target.value }));
              setError(null);
            }}
            placeholder="e.g. Computer Science · HCI minor"
            autoComplete="off"
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.65rem", marginBottom: "0.65rem" }}>
        <label>
          <span style={labelStyle}>Technical identity</span>
          <select
            value={assessment.technicalIdentity}
            onChange={(e) => setAssessment((p) => ({ ...p, technicalIdentity: e.target.value }))}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value="systems_low_level">Systems / infra / performance–oriented</option>
            <option value="product_ui">Product engineering / UX-heavy</option>
            <option value="data_ml">Data / ML / experimentation</option>
            <option value="security">Security / reliability mindset</option>
            <option value="breadth_first">Breadth-first · generalist builder</option>
            <option value="unsure">Still figuring it out</option>
          </select>
        </label>
        <label>
          <span style={labelStyle}>How you prefer to work</span>
          <select
            value={assessment.collaborationStyle}
            onChange={(e) => setAssessment((p) => ({ ...p, collaborationStyle: e.target.value }))}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value="solo_deep">Deep solo ownership</option>
            <option value="pair_teammate">Pairing / small team</option>
            <option value="cross_functional">Docs, stakeholders, cross-functional</option>
          </select>
        </label>
      </div>

      <label style={{ display: "block", marginBottom: "0.65rem" }}>
        <span style={labelStyle}>Projects & achievements *</span>
        <textarea
          value={assessment.projectsHighlights}
          onChange={(e) => {
            setAssessment((p) => ({ ...p, projectsHighlights: e.target.value }));
            setError(null);
          }}
          placeholder="Internships, research, OSS, coursework builds — what you owned and outcomes you care about."
          rows={4}
          style={textareaStyle}
        />
      </label>

      <label style={{ display: "block", marginBottom: "0.65rem" }}>
        <span style={labelStyle}>Domains you&apos;re curious about (optional)</span>
        <textarea
          value={assessment.domainsCurious}
          onChange={(e) => setAssessment((p) => ({ ...p, domainsCurious: e.target.value }))}
          placeholder="e.g. climate, education, fintech, gov/regulated…"
          rows={2}
          style={textareaStyle}
        />
      </label>

      <label style={{ display: "block", marginBottom: "0.65rem" }}>
        <span style={labelStyle}>Constraints & priorities (optional)</span>
        <textarea
          value={assessment.constraintsNotes}
          onChange={(e) => setAssessment((p) => ({ ...p, constraintsNotes: e.target.value }))}
          placeholder="Geography, visa, grad school, stability vs startup risk…"
          rows={2}
          style={textareaStyle}
        />
      </label>

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        <span style={labelStyle}>Risk appetite</span>
        <select
          value={assessment.careerRisk}
          onChange={(e) => setAssessment((p) => ({ ...p, careerRisk: e.target.value }))}
          style={{ ...inputStyle, maxWidth: "280px", cursor: "pointer" }}
        >
          <option value="conservative">Conservative · predictable ramps</option>
          <option value="balanced">Balanced</option>
          <option value="high_upside">Higher upside · tolerate ambiguity</option>
        </select>
      </label>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", marginBottom: error ? "0.5rem" : "0.65rem" }}>
        <button
          type="button"
          disabled={!canSubmit || loading}
          onClick={runExploration}
          title={!isSignedIn ? "Sign in to generate paths" : undefined}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "10px",
            border: "none",
            background: !canSubmit || loading ? T.border : "#1d4ed8",
            color: !canSubmit || loading ? T.textMuted : "white",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: !canSubmit || loading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {loading ? "Generating paths…" : "Explore lateral paths →"}
        </button>
        <button
          type="button"
          onClick={resetForm}
          style={{
            padding: "0.45rem 0.85rem",
            borderRadius: "10px",
            border: `1px solid ${T.border}`,
            background: "transparent",
            color: T.textMuted,
            fontSize: "0.78rem",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Clear saved draft
        </button>
      </div>

      {error ? (
        <p style={{ fontSize: "0.78rem", color: "#f87171", margin: "0 0 0.65rem", lineHeight: 1.55 }}>{error}</p>
      ) : null}

      {result && !loading ? (
        <div style={{ marginTop: "0.35rem", paddingTop: "0.85rem", borderTop: `1px solid ${T.border}` }}>
          <div
            style={{
              padding: "0.65rem 0.75rem",
              borderRadius: "10px",
              border: `1px solid ${T.border}`,
              background: T.surfaceBg || T.cardBg,
              marginBottom: "0.75rem",
            }}
          >
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: T.textPrimary, marginBottom: "0.35rem" }}>
              Your baseline assumption (echoed)
            </div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: T.textPrimary, marginBottom: "0.35rem" }}>
              {result.baselineEcho?.title}
            </div>
            <p style={{ fontSize: "0.76rem", color: T.textSecondary, margin: "0 0 0.45rem", lineHeight: 1.55 }}>
              {result.baselineEcho?.summary}
            </p>
            {Array.isArray(result.baselineEcho?.signalsUsed) ? (
              <div style={{ fontSize: "0.68rem", color: T.textMuted, lineHeight: 1.45 }}>
                Signals from your answers: {result.baselineEcho.signalsUsed.join(" · ")}
              </div>
            ) : null}
          </div>

          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: T.textPrimary, marginBottom: "0.45rem" }}>
            Three lateral arcs (compare to your default)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "0.75rem" }}>
            {(result.alternatives || []).map((alt, idx) => (
              <div
                key={idx}
                style={{
                  border: `1px solid ${T.border}`,
                  borderRadius: "10px",
                  padding: "0.65rem 0.75rem",
                  background: "rgba(37, 99, 235, 0.04)",
                }}
              >
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: T.textPrimary }}>{alt.title}</div>
                <div style={{ fontSize: "0.74rem", color: T.textSecondary, marginBottom: "0.45rem", lineHeight: 1.45 }}>
                  {alt.tagline}
                </div>
                <div style={{ fontSize: "0.68rem", fontWeight: 600, color: T.textMuted, marginBottom: "0.25rem" }}>Why it fits you</div>
                <ul style={{ margin: "0 0 0.45rem", paddingLeft: "1.05rem", fontSize: "0.74rem", color: T.textSecondary, lineHeight: 1.55 }}>
                  {(alt.fitRationale || []).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
                <div style={{ fontSize: "0.68rem", fontWeight: 600, color: T.textMuted, marginBottom: "0.25rem" }}>Prep / gaps</div>
                <ul style={{ margin: "0 0 0.45rem", paddingLeft: "1.05rem", fontSize: "0.74rem", color: T.textSecondary, lineHeight: 1.55 }}>
                  {(alt.prepOrGaps || []).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
                <p style={{ fontSize: "0.74rem", color: T.textSecondary, margin: "0 0 0.35rem", lineHeight: 1.5 }}>
                  <strong style={{ color: T.textPrimary }}>vs your default:</strong> {alt.differsFromBaseline}
                </p>
                {alt.comparisonAxes ? (
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: T.textMuted,
                      lineHeight: 1.45,
                      paddingTop: "0.35rem",
                      borderTop: `1px dashed ${T.border}`,
                    }}
                  >
                    Learning curve: {alt.comparisonAxes.learningCurve}
                    {" · "}
                    Early-career accessibility: {alt.comparisonAxes.hireAccessibilityEarlyCareer}
                    {" · "}
                    Mobility: {alt.comparisonAxes.mobility}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {result.confidenceNote ? (
            <p style={{ fontSize: "0.72rem", color: T.textSecondary, margin: "0 0 0.65rem", lineHeight: 1.55 }}>
              <strong style={{ color: T.textPrimary }}>Confidence:</strong> {result.confidenceNote}
            </p>
          ) : null}

          <p style={{ fontSize: "0.68rem", color: T.textMuted, margin: "0 0 0.65rem", lineHeight: 1.55 }}>{result.globalDisclaimer}</p>

          <button
            type="button"
            disabled={typeof onDiscussWithCoach !== "function"}
            onClick={discussWithCoach}
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
            Discuss paths with coach →
          </button>
        </div>
      ) : null}
    </div>
  );
}
