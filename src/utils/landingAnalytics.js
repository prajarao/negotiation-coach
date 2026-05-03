/**
 * Lightweight funnel hooks for landing → app (works without GTM).
 * Consumers can listen: window.addEventListener('offeradvisor_analytics', (e) => { ... e.detail })
 */
export function trackLandingEvent(eventName, payload = {}) {
  const detail = { event: eventName, ...payload, ts: Date.now() };
  try {
    window.dispatchEvent(new CustomEvent("offeradvisor_analytics", { detail }));
  } catch {
    /* ignore */
  }
  try {
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: eventName, ...payload });
    }
  } catch {
    /* ignore */
  }
}

/** Call once when SPA loads from app.html */
export function recordAppLandTimestamp() {
  try {
    if (!sessionStorage.getItem("oa_app_land_ts")) {
      sessionStorage.setItem("oa_app_land_ts", String(Date.now()));
    }
  } catch {
    /* ignore */
  }
}

/** Fire if user signs in soon after hitting /app */
export function maybeTrackQuickSignupAfterLand(isSignedIn) {
  try {
    const landTs = Number(sessionStorage.getItem("oa_app_land_ts"));
    if (!landTs || !isSignedIn) return;
    const key = "oa_quick_signup_tracked";
    if (sessionStorage.getItem(key)) return;
    const elapsed = Date.now() - landTs;
    if (elapsed <= 60_000) {
      sessionStorage.setItem(key, "1");
      trackLandingEvent("oa_signup_within_60s_of_app_land", { elapsed_ms: elapsed });
    }
  } catch {
    /* ignore */
  }
}
