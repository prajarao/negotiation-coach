import { themeLabel } from "./vocationalInterestScore.js";

/**
 * @param {{
 *   scored: { themeId: string, sum: number, count: number, avg: number, pct: number }[],
 *   ranked: { themeId: string, sum: number }[],
 *   userNote?: string,
 * }} opts
 */
export function formatBridgeInterestCoachMessage(opts) {
  const { scored, ranked, userNote } = opts;
  const top3 = ranked.slice(0, 3).map((r) => themeLabel(r.themeId));
  const lines = [
    "I'd like your take on my Career Blueprint work-style snapshot.",
    "",
    "Career Blueprint is OfferAdvisor’s short self-check (original prompts)—exploratory only, not a licensed or normed psychological test.",
    "",
    "--- My theme scores ---",
    "Scale per theme: sum of ratings 1–5 across 7 prompts (possible range 7–35); percentage is a convenience display (≈ strength within that snapshot).",
    ...scored.map(
      (r) =>
        `${themeLabel(r.themeId)}: sum ${Math.round(r.sum)} / ${r.count * 5} (${r.pct}% of the snapshot scale for this theme)`
    ),
    "",
    "--- Strongest themes (by sum) ---",
    top3.length ? top3.join(" → ") : "(Incomplete)",
    "",
    userNote?.trim()
      ? `--- What I want to focus on ---\n${userNote.trim()}`
      : "",
    "",
    "Please help me turn this snapshot into concrete next steps: environments and role shapes that fit, what to sanity-check before committing, and informational interviews or experiments I could try. Keep it grounded and avoid clinical labels.",
  ];
  return lines.filter(Boolean).join("\n");
}
