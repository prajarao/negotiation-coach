import { THEME_ORDER, WORK_STYLE_THEMES } from "../constants/workStyleThemes.js";

/** @typedef {import('../constants/workStyleThemes.js').WorkStyleThemeId} WorkStyleThemeId */

/**
 * @param {{ id: string, themeId: WorkStyleThemeId }[]} items
 * @param {Record<string, number>} responses keyed by item id, values 1–5
 * @returns {{ themeId: WorkStyleThemeId, sum: number, count: number, avg: number, pct: number }[]}
 */
export function scoreWorkStyleThemes(items, responses) {
  /** @type {Record<WorkStyleThemeId, { sum: number, count: number }>} */
  const acc = {};
  for (const t of THEME_ORDER) {
    acc[t] = { sum: 0, count: 0 };
  }
  for (const row of items) {
    const v = responses[row.id];
    if (typeof v !== "number" || Number.isNaN(v)) continue;
    if (v < 1 || v > 5) continue;
    if (!acc[row.themeId]) acc[row.themeId] = { sum: 0, count: 0 };
    acc[row.themeId].sum += v;
    acc[row.themeId].count += 1;
  }
  return THEME_ORDER.map((themeId) => {
    const { sum, count } = acc[themeId] || { sum: 0, count: 0 };
    const avg = count > 0 ? sum / count : 0;
    const minSum = count;
    const maxSum = count * 5;
    const pct =
      count > 0 && maxSum > minSum ? ((sum - minSum) / (maxSum - minSum)) * 100 : 0;
    return {
      themeId,
      sum,
      count,
      avg: Math.round(avg * 100) / 100,
      pct: Math.round(pct * 10) / 10,
    };
  });
}

/**
 * Highest sum first; ties broken by THEME_ORDER index ascending.
 */
export function rankThemes(scoredRows) {
  const orderIndex = /** @type {Record<string, number>} */ (
    Object.fromEntries(THEME_ORDER.map((id, i) => [id, i]))
  );
  return [...scoredRows].sort((x, y) => {
    if (y.sum !== x.sum) return y.sum - x.sum;
    return (orderIndex[x.themeId] ?? 99) - (orderIndex[y.themeId] ?? 99);
  });
}

export function themeLabel(themeId) {
  return WORK_STYLE_THEMES.find((t) => t.id === themeId)?.label ?? themeId;
}

export function themeBlurb(themeId) {
  return WORK_STYLE_THEMES.find((t) => t.id === themeId)?.blurb ?? "";
}

/**
 * True when every item has a valid response.
 */
export function isCompleteAssessment(items, responses) {
  for (const row of items) {
    const v = responses[row.id];
    if (typeof v !== "number" || v < 1 || v > 5 || Number.isNaN(v)) return false;
  }
  return true;
}
