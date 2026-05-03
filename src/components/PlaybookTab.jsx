import { useState } from "react";
import { OA_CONTENT_MAX_PRIMARY, OA_PAGE_PAD_X } from "../constants/appLayout.js";

/**
 * OfferAdvisor Playbook — original material for Pro subscribers.
 * Not a reproduction of any external book or course; frameworks are industry-standard language only.
 */

const PLAYBOOK_META = {
  title: "OfferAdvisor Playbook",
  subtitle: "Salary & offer negotiation — field guide",
  version: "1.0",
  tagline: "Sharper offers. Calmer conversations. Better outcomes.",
};

const SECTIONS = [
  {
    id: "promise",
    title: "What this playbook is",
    bullets: [
      "OfferAdvisor helps you prepare, practice, and execute compensation conversations with clarity.",
      "Use it alongside the Coach, Benchmark, and Calculator tabs — this document is the map; those tools are the instruments.",
      "Nothing here is legal, tax, or investment advice. When stakes are high, involve qualified professionals.",
    ],
  },
  {
    id: "north-star",
    title: "Your north star",
    paragraphs: [
      "A strong negotiation protects three things at once: your relationship with the hiring team, your credibility, and your economics. When those conflict, fix the sequencing: relationship and credibility first on small moves, economics once trust and process are stable.",
      "Write down one sentence before every live conversation: “If I walk away with ___, this was worth my time.” That line is your internal compass — not necessarily what you say out loud.",
    ],
  },
  {
    id: "contexts",
    title: "Two contexts you will switch between",
    paragraphs: [
      "Most offer talks swing between **push** and **partner** modes. Push mode is appropriate when numbers are unresolved and you need clear trade-offs on the table. Partner mode is appropriate when you are designing packages, solving constraints together, or repairing tension after a sharp exchange.",
      "Label the room silently before you speak. If you use partner language in a push moment, you can sound vague; if you use push language in a partner moment, you can sound brittle. OfferAdvisor’s Practice tab exists so you can rehearse both.",
    ],
  },
  {
    id: "prep",
    title: "Pre-flight checklist (10 minutes)",
    bullets: [
      "Role scope, level, location, and reporting line — written in one place.",
      "Your target cash, equity band, and signing flexibility — three numbers, not ten.",
      "Two credible data points (Benchmark tab + one other: comp survey, peer signal, recruiter range).",
      "Your best alternative if this offer disappears — one honest sentence.",
      "Three questions you will ask before you defend any number.",
      "One concession you can trade — only if it buys something you care about.",
    ],
  },
  {
    id: "leverage",
    title: "Leverage without theatrics",
    paragraphs: [
      "Leverage is the overlap of **value you can prove**, **urgency they feel**, and **credible alternatives**. You do not need to perform leverage; you need to make it legible: impact stories, comparable scope, and timelines that are true.",
      "Avoid empty threats. If you cannot walk away, do not imply you can. Instead, anchor on scope, ramp, or structure that improves ROI for both sides.",
    ],
  },
  {
    id: "anchors",
    title: "Anchors, brackets, and ranges",
    paragraphs: [
      "When you open with a number, make it **defensible**, not theatrical. Tie it to market structure, responsibility, or outcomes you will own in the first 180 days.",
      "Ranges are useful when you explain what inside the range means (e.g., base vs. bonus vs. equity trade). A bracket without a story feels arbitrary; a bracket with a story feels like analysis.",
      "If you receive their anchor first, slow down. Ask how the number was built (bands, internal equity, geography). Questions reduce the sting of a low anchor without rewarding it with instant counter-yelling.",
    ],
  },
  {
    id: "concessions",
    title: "Concessions that buy something",
    paragraphs: [
      "Never give a concession for free. If you move, name what you need back: timing, title, review date, equity refresh language, or a smaller item bundled with a larger one.",
      "Package concessions in pairs: “If we can align on A, I can be flexible on B.” That sentence is boring on purpose — boring is enforceable and calm.",
    ],
  },
  {
    id: "silence",
    title: "Silence, pace, and written follow-ups",
    bullets: [
      "After a material ask, stop talking. Let the other side fill space — often with information.",
      "Summarize live calls in email: agenda, what moved, open items, and your proposed next step. Written rhythm reduces misunderstandings and speeds approvals.",
      "Use the Templates tab for tone-safe drafts; customize every bracket before you send.",
    ],
  },
  {
    id: "objections",
    title: "Common objections — OfferAdvisor responses",
    subsections: [
      {
        h: "“That’s above our band.”",
        p: "Translate the band: which component is actually constrained? Move value across base, bonus, equity, signing, or review timing. Ask what would make an exception plausible on their side.",
      },
      {
        h: "“We need an answer by Friday.”",
        p: "Acknowledge the business need. Offer a partial answer (e.g., yes to role and start window) while you finalize comp, or trade a faster decision for a specific improvement you can measure.",
      },
      {
        h: "“Other candidates accepted less.”",
        p: "Avoid the comparison trap. Return to scope and outcomes: the work you will deliver, the risk you absorb, and the market for that scope at your level.",
      },
    ],
  },
  {
    id: "close",
    title: "Close cleanly",
    paragraphs: [
      "When you accept, express satisfaction for what moved — even if not everything moved. When you decline, do it with respect and a short reason; networks are long.",
      "Confirm next steps in writing: title, start date, compensation components, and any review or equity language you relied on verbally.",
    ],
  },
  {
    id: "inside-offeradvisor",
    title: "How this maps to OfferAdvisor",
    bullets: [
      "Coach — scenario planning, scripts, and role-play.",
      "Benchmark — external credibility for your bracket.",
      "Calculator — four-year view of trade-offs before you speak.",
      "Practice — recruiter-style pressure testing.",
      "Log win — capture outcomes so your next negotiation starts smarter.",
      "Templates — async drafts you can personalize quickly.",
    ],
  },
];

function buildPlaybookExport() {
  const lines = [
    `${PLAYBOOK_META.title}`,
    `${PLAYBOOK_META.subtitle}`,
    `Version ${PLAYBOOK_META.version}`,
    "",
    PLAYBOOK_META.tagline,
    "",
    "---",
    "OfferAdvisor — https://offeradvisor.ai",
    "This document is original material for OfferAdvisor Pro subscribers.",
    "Not a substitute for professional advice.",
    "",
    "===",
    "",
  ];

  for (const sec of SECTIONS) {
    lines.push(`## ${sec.title}`);
    lines.push("");
    if (sec.paragraphs) {
      for (const p of sec.paragraphs) {
        lines.push(p.replace(/\*\*(.*?)\*\*/g, "$1"));
        lines.push("");
      }
    }
    if (sec.bullets) {
      for (const b of sec.bullets) {
        lines.push(`- ${b}`);
      }
      lines.push("");
    }
    if (sec.subsections) {
      for (const sub of sec.subsections) {
        lines.push(`### ${sub.h}`);
        lines.push(sub.p);
        lines.push("");
      }
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`Generated from the in-app OfferAdvisor Playbook (${new Date().toISOString().slice(0, 10)}).`);
  return lines.join("\n").trim() + "\n";
}

export default function PlaybookTab({ T }) {
  const [exported, setExported] = useState(false);

  const download = () => {
    const body = buildPlaybookExport();
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "OfferAdvisor-Playbook.txt";
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: `1.15rem ${OA_PAGE_PAD_X}`, borderBottom: `1px solid ${T.border}`, flexShrink: 0, background: T.headerBg }}>
        <div style={{ maxWidth: OA_CONTENT_MAX_PRIMARY, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "#a78bfa", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.35rem" }}>
              OfferAdvisor Pro
            </div>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.35rem", color: T.textPrimary, margin: "0 0 0.25rem" }}>
              {PLAYBOOK_META.title}
            </h2>
            <p style={{ margin: 0, fontSize: "0.88rem", color: T.textSecondary, lineHeight: 1.5 }}>
              {PLAYBOOK_META.subtitle} · <span style={{ color: T.textMuted }}>v{PLAYBOOK_META.version}</span>
            </p>
            <p style={{ margin: "0.45rem 0 0", fontSize: "0.78rem", color: T.textMuted, maxWidth: 640, lineHeight: 1.55 }}>
              {PLAYBOOK_META.tagline} Original guide for subscribers — not a copy of any third-party book or PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={download}
            style={{
              padding: "0.55rem 1rem",
              borderRadius: "10px",
              border: "none",
              background: "#6d28d9",
              color: "white",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            {exported ? "Downloaded ✓" : "Download .txt"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: `1.25rem ${OA_PAGE_PAD_X}` }}>
        <article style={{ maxWidth: OA_CONTENT_MAX_PRIMARY, margin: "0 auto" }}>
          {SECTIONS.map((sec) => (
            <section key={sec.id} style={{ marginBottom: "1.75rem" }}>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.08rem", color: T.textPrimary, margin: "0 0 0.65rem", borderBottom: `1px solid ${T.border}`, paddingBottom: "0.35rem" }}>
                {sec.title}
              </h3>
              {sec.paragraphs?.map((p, i) => (
                <p key={i} style={{ fontSize: "0.86rem", color: T.textSecondary, lineHeight: 1.7, margin: "0 0 0.65rem" }}>
                  {p.split("**").map((chunk, j) => (j % 2 === 1 ? <strong key={j} style={{ color: T.textPrimary }}>{chunk}</strong> : chunk))}
                </p>
              ))}
              {sec.bullets && (
                <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.15rem", color: T.textSecondary, fontSize: "0.86rem", lineHeight: 1.65 }}>
                  {sec.bullets.map((b, bi) => (
                    <li key={`${sec.id}-b-${bi}`} style={{ marginBottom: "0.35rem" }}>{b}</li>
                  ))}
                </ul>
              )}
              {sec.subsections?.map((sub) => (
                <div key={sub.h} style={{ marginTop: "0.75rem" }}>
                  <h4 style={{ fontSize: "0.82rem", fontWeight: 600, color: T.textPrimary, margin: "0 0 0.35rem" }}>{sub.h}</h4>
                  <p style={{ fontSize: "0.84rem", color: T.textSecondary, lineHeight: 1.65, margin: 0 }}>{sub.p}</p>
                </div>
              ))}
            </section>
          ))}

          <footer style={{ marginTop: "2rem", padding: "1rem", borderRadius: "10px", border: `1px solid ${T.border}`, background: T.cardBg }}>
            <p style={{ margin: 0, fontSize: "0.72rem", color: T.textMuted, lineHeight: 1.55 }}>
              <strong style={{ color: T.textSecondary }}>OfferAdvisor</strong> — Pro playbook. Content is produced for this product and may be updated without notice. Use the Coach for situations that are not covered here.
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}
