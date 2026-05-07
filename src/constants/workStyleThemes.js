/**
 * Neutral work-interest themes for BRIDGE career snapshot (original instrument).
 * No third-party scale names or acronyms in user-facing strings.
 */

/** @typedef {'build' | 'analyze' | 'create' | 'connect' | 'influence' | 'organize'} WorkStyleThemeId */

/** Canonical tie-break order when scores tie (first wins). */
export const THEME_ORDER = /** @type {const} */ ([
  "build",
  "analyze",
  "create",
  "connect",
  "influence",
  "organize",
]);

export const WORK_STYLE_THEMES = [
  {
    id: "build",
    label: "Hands-on & operational",
    blurb:
      "Practical work with tools, systems you can touch, and clear physical or technical outcomes.",
  },
  {
    id: "analyze",
    label: "Analytical & exploratory",
    blurb: "Digging into how things work, checking evidence, and solving ambiguous problems.",
  },
  {
    id: "create",
    label: "Creative & expressive",
    blurb: "Shaping narrative, visuals, sound, or ideas so they resonate with others.",
  },
  {
    id: "connect",
    label: "Collaborative & people-centered",
    blurb:
      "Teaching, mentoring, coordinating groups, or helping individuals through change.",
  },
  {
    id: "influence",
    label: "Persuasive & opportunity-driven",
    blurb:
      "Presenting ideas, aligning stakeholders, negotiating, or moving deals forward.",
  },
  {
    id: "organize",
    label: "Structured & detail-oriented",
    blurb:
      "Keeping records accurate, workflows predictable, and operations running smoothly.",
  },
];
