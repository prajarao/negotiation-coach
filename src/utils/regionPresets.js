/** localStorage key for salary/market region preset (US default). */
export const REGION_STORAGE_KEY = "offeradvisor_region";

/** @typedef {"US"|"UK"|"IN"} RegionId */

/** Draft keys cleared when switching region (student salary surfaces). */
export const STUDENT_SALARY_STORAGE_KEYS = ["offeradvisor_student_benchmark_v1", "offeradvisor_student_five_year_v1"];

/** Career path explorer persisted assessment + results. */
export const STUDENT_CAREER_PATH_STORAGE_KEY = "offeradvisor_student_career_path_v1";

export function clearRegionalSalaryDraftStorage() {
  for (const k of STUDENT_SALARY_STORAGE_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.removeItem(STUDENT_CAREER_PATH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** @returns {RegionId} */
export function readStoredRegionId() {
  try {
    const v = localStorage.getItem(REGION_STORAGE_KEY);
    if (v === "UK" || v === "IN" || v === "US") return v;
  } catch {
    /* ignore */
  }
  return "US";
}

/**
 * @typedef {{ id: RegionId; label: string; shortLabel: string; defaultLocation: string; apiFallbackLocation: string; currency: string }} RegionPreset
 */

/** Header / picker options (stable order). */
export const REGION_OPTIONS = /** @type {const} */ ([
  { id: "US", pickerLabel: "US · USD" },
  { id: "UK", pickerLabel: "UK · GBP" },
  { id: "IN", pickerLabel: "India · INR" },
]);

/** @type {Record<RegionId, RegionPreset>} */
export const REGION_PRESETS = {
  US: {
    id: "US",
    label: "United States",
    shortLabel: "US",
    defaultLocation: "United States",
    apiFallbackLocation: "United States",
    currency: "USD",
  },
  UK: {
    id: "UK",
    label: "United Kingdom",
    shortLabel: "UK",
    defaultLocation: "London UK",
    apiFallbackLocation: "London UK",
    currency: "GBP",
  },
  IN: {
    id: "IN",
    label: "India",
    shortLabel: "India",
    defaultLocation: "Bangalore India",
    apiFallbackLocation: "Bangalore India",
    currency: "INR",
  },
};

/** @param {string} id */
export function getPreset(id) {
  if (id === "UK" || id === "IN") return REGION_PRESETS[id];
  return REGION_PRESETS.US;
}
