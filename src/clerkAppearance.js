/**
 * Shared Clerk `<Appearance />` for OfferAdvisor’s dark shell.
 * Social (OAuth) rows default to dark text; without a light button surface the
 * “Google” label disappears against our `colorBackground`.
 */
export function offeradvisorClerkAppearance(extraElements = {}) {
  return {
    variables: {
      colorPrimary: "#1d4ed8",
      colorBackground: "#0d1424",
      colorInputBackground: "#0a0f1a",
      colorInputText: "#e2e8f0",
      colorText: "#e2e8f0",
      colorTextSecondary: "#94a3b8",
      borderRadius: "10px",
      fontFamily: "'DM Sans', system-ui, sans-serif",
    },
    elements: {
      card: { border: "1px solid #1e293b", boxShadow: "none" },
      headerTitle: { fontFamily: "'DM Serif Display', serif", fontWeight: 500 },
      formButtonPrimary: { backgroundColor: "#1d4ed8" },
      footerActionLink: { color: "#3b82f6" },
      socialButtonsBlockButton: {
        backgroundColor: "#f8fafc",
        color: "#0f172a",
        border: "1px solid #cbd5e1",
      },
      socialButtonsBlockButtonText: {
        color: "#0f172a",
        fontWeight: 500,
      },
      socialButtonsIconButton: {
        backgroundColor: "#f8fafc",
        color: "#0f172a",
        border: "1px solid #cbd5e1",
      },
      ...extraElements,
    },
  };
}
