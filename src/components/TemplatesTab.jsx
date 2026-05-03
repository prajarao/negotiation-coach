import { useState } from "react";
import { OA_CONTENT_MAX_PRIMARY, OA_PAGE_PAD_X } from "../constants/appLayout.js";

/** Shown in preview and appended to copy / download so the author receives credit. */
const ATTRIBUTION_FOOTER =
  "Adapted from Negotiation Made Simple by John Lowry (HarperCollins Leadership, © 2023). "
  + "Educational template only—personalize for your situation and obtain professional advice before sending.";

export default function TemplatesTab({ T }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [copied, setCopied] = useState(false);

  const templates = [
    {
      id: 1,
      title: "Counter-offer with bracket + rationale",
      subtitle: "Competitive context — anchor without insulting",
      icon: "📧",
      bookIdea: "Strategy wins; know your leverage before you move.",
      whenToUse: "After you have market data and a target range. You are in a competitive negotiation on numbers.",
      subject: "Re: [ROLE] offer — proposed package",
      body: `Hi [RECRUITER_NAME],

Thank you again for the offer at [COMPANY]. I'm excited about [ROLE] and the team.

I've reviewed the package against comparable roles in [MARKET / GEO]. Based on that research, a fair range for this scope looks like $[P25]–$[P75] all-in, depending on equity and bonus structure.

To land in a place that reflects the responsibility of the role and the outcomes I'll own, I'd like to propose: base $[COUNTER_BASE], [EQUITY ASK], and [SIGNING/BONUS ASK if any]. I'm happy to discuss trade-offs if we need to rebalance across components.

Could we schedule a 20-minute call this week to walk through what flexibility exists on your side?

Best regards,
[YOUR_NAME]`,
    },
    {
      id: 2,
      title: "When they say “that’s our best”",
      subtitle: "Shift from position → interests + options",
      icon: "💰",
      bookIdea: "Creative cooperation — uncover what “best” really protects.",
      whenToUse: "They claim a hard cap. You want to explore total comp and non-cash levers without burning the relationship.",
      subject: "Re: [ROLE] — exploring flexibility",
      body: `Hi [RECRUITER_NAME],

I appreciate you being direct about constraints—that helps me respond constructively.

To make sure I’m solving for the right problem: is the constraint primarily [base / budget band / internal equity / approval limits], or something else? Understanding that helps me propose options that work on your side too.

If base is tight, could we look at any combination of [higher equity / signing bonus / performance bonus / start date / title / review timing] that still clears the bar for both of us?

I’m motivated to find a workable path—happy to share a short written summary of priorities if that’s easier than a live call.

Thanks,
[YOUR_NAME]`,
    },
    {
      id: 3,
      title: "Concede with purpose (trade, don’t cave)",
      subtitle: "Offer a give — tied to a get",
      icon: "⚖️",
      bookIdea: "Master your most important move; concede with purpose.",
      whenToUse: "You can flex on one item if they move on another. Signals good faith without unilateral discounting.",
      subject: "Re: [ROLE] — package trade",
      body: `Hi [RECRUITER_NAME],

Thanks for the conversation and for moving on [WHAT THEY IMPROVED].

To keep momentum, I can be flexible on [YOUR GIVE — e.g. start date / one component of title / a smaller ask on signing] if we can close the gap on [YOUR GET — e.g. base within $X / equity refresh language / review at 12 months].

Does that trade work on your side, or is there a different pairing that fits your approval path better?

Best,
[YOUR_NAME]`,
    },
    {
      id: 4,
      title: "Base is fixed — strengthen total comp",
      subtitle: "Reframe to value and components",
      icon: "📈",
      bookIdea: "Ambitious competition + cooperation on package design.",
      whenToUse: "They say base cannot move. You still need market-aligned total reward.",
      subject: "Re: [ROLE] — total compensation options",
      body: `Hi [RECRUITER_NAME],

Understood on base at $[BASE]—thanks for confirming.

To align total compensation with market for this scope, could we explore any of the following (even modest moves help):
- Equity: [RSU refresh / grant size / vesting cliff / four-year value]
- Variable pay: [bonus target % / performance criteria clarity]
- Sign-on / relocation: [amount or structure]
- Cadence: [salary review at 9–12 months tied to clear metrics]

If you share what’s easiest to approve internally, I’ll focus my ask there first.

Thanks,
[YOUR_NAME]`,
    },
    {
      id: 5,
      title: "Pre-call agenda (comp discussion)",
      subtitle: "Prepare for the process",
      icon: "📋",
      bookIdea: "Prepare for the process; control tempo and information.",
      whenToUse: "Before a live comp negotiation. Reduces surprises and keeps you strategic.",
      subject: "Re: [ROLE] — quick agenda for our call",
      body: `Hi [RECRUITER_NAME],

Looking forward to our call on [DATE/TIME]. To use the time well, here’s what I’d like to cover—please add anything you need on your side:

1) Confirm role scope, level, and success metrics for year one
2) Walk through current offer components (base, bonus, equity, benefits, signing)
3) Discuss any flexibility across those levers
4) Agree on next steps and timeline

If you prefer, I’m happy to receive any standard ranges or bands in writing ahead of the call.

Best,
[YOUR_NAME]`,
    },
    {
      id: 6,
      title: "Bonus target below market",
      subtitle: "Evidence + confidence, not entitlement",
      icon: "🎯",
      bookIdea: "Competitive discipline with professional tone.",
      whenToUse: "Target bonus % lags peers; you want a data-backed adjustment.",
      subject: "Re: [ROLE] — bonus structure",
      body: `Hi [RECRUITER_NAME],

Thanks for outlining the bonus plan. For similar roles in [INDUSTRY], I’m commonly seeing targets around [MARKET_BONUS]% with comparable upside mechanics.

Would [YOUR_BONUS_REQUEST]% be feasible if we align the plan to [metrics you can influence — pipeline, revenue, delivery milestones]? I’m confident in hitting strong outcomes and want the structure to reflect that.

Open to your guidance on what’s approvable.

Best,
[YOUR_NAME]`,
    },
    {
      id: 7,
      title: "Accept with satisfaction (relationship intact)",
      subtitle: "Close cleanly; leave goodwill",
      icon: "✅",
      bookIdea: "Know the secrets of satisfaction—end well even if you didn’t win every point.",
      whenToUse: "They won’t move further; you’re taking the offer. Protects reputation and future optionality.",
      subject: "Re: [ROLE] — acceptance",
      body: `Hi [RECRUITER_NAME],

Thank you for working through the details with me—I appreciate the time and the movement on [WHAT THEY DID MOVE ON].

After weighing everything, I’m pleased to accept the offer as discussed. I’m looking forward to contributing in [ROLE] and partnering with you and the team.

Please send [offer letter / DocuSign / next paperwork] at your convenience, and let me know any deadlines on my side.

Thanks again,
[YOUR_NAME]`,
    },
    {
      id: 8,
      title: "Performance-based revisit (12 months)",
      subtitle: "Lock a future review without reopening today",
      icon: "🔄",
      bookIdea: "Deliver the deal — clarity on what “good” unlocks later.",
      whenToUse: "You’re accepting but want a documented path to revisit comp after proof.",
      subject: "Re: [ROLE] — acceptance + performance review discussion",
      body: `Hi [RECRUITER_NAME],

I’m excited to accept and join [COMPANY] as [ROLE].

One item I’d like aligned in writing before I sign: a performance-based compensation discussion after [12] months based on [2–3 measurable outcomes — e.g. shipped milestones, revenue, team goals]. If I’m tracking ahead of those, could we agree to revisit base and/or equity at that point?

I’m asking because it aligns incentives and reflects confidence on both sides. If your policy uses a standard review cycle instead, I’m happy to mirror that language.

Thanks,
[YOUR_NAME]`,
    },
    {
      id: 9,
      title: "Empathy first — de-escalate then pivot",
      subtitle: "Cooperative move after tension",
      icon: "🤝",
      bookIdea: "The power of empathy; transition from positions to problem-solving.",
      whenToUse: "After a sharp exchange or stall. Acknowledge their constraint, restate shared goal, propose a path.",
      subject: "Re: [ROLE] — path forward",
      body: `Hi [RECRUITER_NAME],

I know the last exchange was a bit compressed on time—I appreciate you sticking with it.

I want to be clear: I’m still very interested in [ROLE], and I’m trying to solve for [fair total comp / clarity on scope / timeline], not to create friction.

If it helps, I can simplify my side to [ONE CLEAR REQUEST]. On your side, what would need to be true for that to be realistic?

Thanks for your patience,

[YOUR_NAME]`,
    },
  ];

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const formatEmail = (template) =>
    `Subject: ${template.subject}\n\n${template.body}\n\n---\n${ATTRIBUTION_FOOTER}`;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: `1.25rem ${OA_PAGE_PAD_X}`, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ maxWidth: OA_CONTENT_MAX_PRIMARY, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.3rem", color: T.textPrimary, margin: "0 0 0.3rem" }}>
            Negotiation email templates
          </h2>
          <p style={{ fontSize: "0.82rem", color: T.textSecondary, margin: "0 0 0.5rem", lineHeight: 1.6 }}>
            Stronger scripts inspired by <strong style={{ color: T.textPrimary }}>Negotiation Made Simple</strong> by <strong style={{ color: T.textPrimary }}>John Lowry</strong> (HarperCollins Leadership)—strategy, purposeful concessions, preparation, empathy, and closing well. Replace every <code style={{ fontSize: "0.78em", color: T.textMuted }}>[placeholder]</code> before sending.
          </p>
          <p style={{ fontSize: "0.72rem", color: T.textMuted, margin: 0, lineHeight: 1.5 }}>
            Attribution is included when you copy or download so the author is credited. Remove the final lines if your situation does not require them (e.g. some external recipients).
          </p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: `1.25rem ${OA_PAGE_PAD_X}`, display: "flex", gap: "1rem" }}>
        <div style={{ flex: selectedTemplateId ? 0.4 : 1, minWidth: 0 }}>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplateId(template.id)}
                style={{
                  padding: "0.9rem",
                  background: selectedTemplateId === template.id ? T.cardBg : "transparent",
                  border: `1px solid ${selectedTemplateId === template.id ? "#3b82f6" : T.border}`,
                  borderRadius: "10px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                  color: T.textPrimary,
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#3b82f6";
                  e.currentTarget.style.background = T.cardBg;
                }}
                onMouseLeave={(e) => {
                  if (selectedTemplateId !== template.id) {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div style={{ fontSize: "1rem", marginBottom: "0.3rem" }}>{template.icon}</div>
                <div style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.2rem" }}>
                  {template.title}
                </div>
                <div style={{ fontSize: "0.7rem", color: T.textMuted, marginBottom: "0.35rem" }}>
                  {template.subtitle}
                </div>
                <div style={{ fontSize: "0.65rem", color: "#a78bfa", lineHeight: 1.4 }}>
                  From the book: {template.bookIdea}
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedTemplate && (
          <div style={{ flex: 0.6, minWidth: 0, borderLeft: `1px solid ${T.border}`, paddingLeft: "1rem" }}>
            <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "1rem" }}>
              <div>
                <div style={{ fontSize: "0.7rem", color: T.textMuted, textTransform: "uppercase", marginBottom: "0.3rem", fontWeight: 600 }}>
                  When to use
                </div>
                <p style={{ fontSize: "0.8rem", color: T.textSecondary, margin: "0 0 0.5rem", lineHeight: 1.5 }}>
                  {selectedTemplate.whenToUse}
                </p>
                <div style={{ fontSize: "0.68rem", color: "#a78bfa", lineHeight: 1.45, padding: "0.5rem 0.65rem", borderRadius: "8px", border: "1px solid rgba(124,58,237,0.25)", background: "rgba(124,58,237,0.06)" }}>
                  <strong style={{ color: T.textSecondary }}>Credit:</strong> Structure and phrasing draw on <em>Negotiation Made Simple</em> by John Lowry (HarperCollins Leadership, © 2023).
                </div>
              </div>

              <div style={{ flex: 1, background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "0.9rem", overflowY: "auto", fontFamily: "monospace", fontSize: "0.75rem", color: T.textSecondary, lineHeight: 1.6 }}>
                <div style={{ color: T.textMuted, marginBottom: "0.5rem", fontWeight: 600 }}>
                  Subject: {selectedTemplate.subject}
                </div>
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {selectedTemplate.body}
                </div>
                <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: `1px dashed ${T.border}`, color: T.textMuted, fontSize: "0.7rem", fontStyle: "italic", whiteSpace: "pre-wrap" }}>
                  {`---\n${ATTRIBUTION_FOOTER}`}
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleCopy(formatEmail(selectedTemplate))}
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: "0.65rem",
                    background: "#1d4ed8",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#1e40af"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#1d4ed8"; }}
                >
                  {copied ? "✓ Copied!" : "📋 Copy (includes credit)"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const email = formatEmail(selectedTemplate);
                    const blob = new Blob([email], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${selectedTemplate.title.replace(/[^\w\s-]/g, "").trim().slice(0, 60) || "template"}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: "0.65rem",
                    background: "transparent",
                    color: "#1d4ed8",
                    border: "1px solid #1d4ed8",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(29,78,216,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  📥 Download (includes credit)
                </button>
              </div>

              <div style={{ fontSize: "0.7rem", color: T.textMuted, padding: "0.75rem", background: T.cardBg, borderRadius: "6px", lineHeight: 1.5 }}>
                💡 Replace bracketed placeholders. John Lowry’s book is the source framework—this app does not replace legal, tax, or employment advice.
              </div>
            </div>
          </div>
        )}

        {!selectedTemplate && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: T.textMuted, textAlign: "center", padding: "2rem" }}>
            <div>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📧</div>
              <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.6 }}>
                Select a template to preview the full email and author attribution.<br />
                Copy or download includes credit to John Lowry by default.
              </p>
            </div>
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, padding: "0.65rem 1rem", borderTop: `1px solid ${T.border}`, background: T.headerBg }}>
        <p style={{ margin: 0, fontSize: "0.68rem", color: T.textMuted, textAlign: "center", lineHeight: 1.5 }}>
          <em>Negotiation Made Simple</em> © 2023 John Lowry · HarperCollins Leadership. Templates are educational adaptations—not excerpts from the book.
        </p>
      </div>
    </div>
  );
}
