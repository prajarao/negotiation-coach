/**
 * Mirrors App.jsx benchmark tab currency inference for /api/salary requests.
 * @param {string} location
 * @param {string} [fallbackCurrency="USD"]
 */
export function inferSalaryCurrencyFromLocation(location, fallbackCurrency = "USD") {
  const locLower = String(location || "").toLowerCase();
  if (
    locLower.includes("uk") ||
    locLower.includes("london") ||
    locLower.includes("england") ||
    locLower.includes("manchester") ||
    locLower.includes("edinburgh") ||
    locLower.includes("glasgow")
  ) {
    return "GBP";
  }
  if (
    locLower.includes("india") ||
    locLower.includes("bangalore") ||
    locLower.includes("bengaluru") ||
    locLower.includes("mumbai") ||
    locLower.includes("delhi") ||
    locLower.includes("hyderabad") ||
    locLower.includes("pune")
  ) {
    return "INR";
  }
  if (
    locLower.includes("europe") ||
    locLower.includes("germany") ||
    locLower.includes("france") ||
    locLower.includes("berlin") ||
    locLower.includes("paris")
  ) {
    return "EUR";
  }
  if (locLower.includes("canada") || locLower.includes("toronto") || locLower.includes("vancouver")) {
    return "CAD";
  }
  if (locLower.includes("australia") || locLower.includes("sydney") || locLower.includes("melbourne")) {
    return "AUD";
  }
  if (locLower.includes("singapore")) return "SGD";
  if (locLower.includes("dubai") || locLower.includes("uae")) return "AED";
  return fallbackCurrency;
}

/** Display symbol for inferSalaryCurrencyFromLocation codes */
export function salaryCurrencySymbol(code) {
  const m = {
    USD: "$",
    GBP: "£",
    INR: "₹",
    EUR: "€",
    CAD: "CA$",
    AUD: "A$",
    SGD: "S$",
    AED: "د.إ",
  };
  return m[code] || "$";
}
