/**
 * OfferAdvisor-original activity prompts for the BRIDGE work-style snapshot.
 */

/** @typedef {import('../constants/workStyleThemes.js').WorkStyleThemeId} WorkStyleThemeId */

/**
 * @type {{ id: string, themeId: WorkStyleThemeId, text: string }[]}
 */
export const BRIDGE_VOCATIONAL_INTEREST_ITEMS = [
  // Hands-on & operational — 7
  { id: "b1", themeId: "build", text: "Assemble or tune physical equipment until it performs reliably." },
  { id: "b2", themeId: "build", text: "Walk through a workspace to spot quality issues before something ships." },
  { id: "b3", themeId: "build", text: "Use specialized tools or machinery to fabricate a one-off prototype." },
  { id: "b4", themeId: "build", text: "Restore or troubleshoot something broken under time pressure." },
  { id: "b5", themeId: "build", text: "Set up lab, studio, or field gear so others can repeat a task safely." },
  { id: "b6", themeId: "build", text: "Follow structured steps to assemble complex components correctly the first time." },
  { id: "b7", themeId: "build", text: "Maintain systems that keep a building or operation running day to day." },

  // Analytical & exploratory — 7
  { id: "a1", themeId: "analyze", text: "Reconcile disparate numbers until a variance finally makes sense." },
  { id: "a2", themeId: "analyze", text: "Trace symptoms backward through logs or datasets to find root cause." },
  { id: "a3", themeId: "analyze", text: "Read technical briefs or research summaries and stress-test their claims." },
  { id: "a4", themeId: "analyze", text: "Model what happens if assumptions change—including edge cases nobody wants." },
  { id: "a5", themeId: "analyze", text: "Design a repeatable way to measure something fuzzy (quality, fairness, risk)." },
  { id: "a6", themeId: "analyze", text: "Compare options with a disciplined rubric—not gut feel alone." },
  { id: "a7", themeId: "analyze", text: "Translate domain jargon into clarity for teammates who aren’t specialists." },

  // Creative & expressive — 7
  { id: "c1", themeId: "create", text: "Draft wording, visuals, or story beats that change how people feel." },
  { id: "c2", themeId: "create", text: "Start from a vague brief and iterate until the concept feels unmistakable." },
  { id: "c3", themeId: "create", text: "Shape brand voice so every touchpoint sounds like the same organization." },
  { id: "c4", themeId: "create", text: "Edit someone else’s rough work until it sings without losing their intent." },
  { id: "c5", themeId: "create", text: "Direct or perform live—stage, podcast, demo, pitch—energy included." },
  { id: "c6", themeId: "create", text: "Prototype an experience flow (signup, onboarding, onboarding story) users enjoy." },
  { id: "c7", themeId: "create", text: "Build a persuasive narrative backed by pacing, imagery, or metaphor—not only facts." },

  // Collaborative & people-centered — 7
  { id: "n1", themeId: "connect", text: "Coach someone past a confidence block without doing the task for them." },
  { id: "n2", themeId: "connect", text: "Mediate conflicting priorities across two teammates who both mean well." },
  { id: "n3", themeId: "connect", text: "Onboard newcomers so they ramp without slowing the whole team." },
  { id: "n4", themeId: "connect", text: "Run a session where quiet voices still get heard and decisions stick." },
  { id: "n5", themeId: "connect", text: "Support people navigating stress—change, setbacks, ambiguity—with empathy." },
  { id: "n6", themeId: "connect", text: "Design fair group norms (roles, agendas, feedback) that people actually follow." },
  { id: "n7", themeId: "connect", text: "Facilitate a workshop where participants leave aligned on next steps." },

  // Persuasive & opportunity-driven — 7
  { id: "i1", themeId: "influence", text: "Pitch an idea cold and adapt on the fly when objections appear." },
  { id: "i2", themeId: "influence", text: "Negotiate scope, timelines, or price while preserving the relationship." },
  { id: "i3", themeId: "influence", text: "Recruit allies across functions to unblock a stalled initiative." },
  { id: "i4", themeId: "influence", text: "Package a roadmap so executives fund it with confidence." },
  { id: "i5", themeId: "influence", text: "Close a loose loop: secure budget, signatures, or a firm commitment." },
  { id: "i6", themeId: "influence", text: "Spot a latent customer need before competitors ship on it." },
  { id: "i7", themeId: "influence", text: "Handle a skeptical audience with calm answers and credible proof." },

  // Structured & detail-oriented — 7
  { id: "o1", themeId: "organize", text: "Build a spreadsheet or ledger that survives audit-style scrutiny." },
  { id: "o2", themeId: "organize", text: "Document a process so a new hire doesn’t reinvent it from memory." },
  { id: "o3", themeId: "organize", text: "Track commitments across threads until nothing slips through." },
  { id: "o4", themeId: "organize", text: "Reconcile inventories, schedules, or budgets when small errors compound." },
  { id: "o5", themeId: "organize", text: "Enforce checklist discipline on a checklist-averse team—without shutting them down." },
  { id: "o6", themeId: "organize", text: "Standardize messy inputs (files, naming, tagging) into a single source of truth." },
  { id: "o7", themeId: "organize", text: "Coordinate logistics so deadlines, owners, and handoffs stay visible." },
];
