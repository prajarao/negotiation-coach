import { SignIn, SignUp } from "@clerk/clerk-react";

/**
 * AuthModal
 * ---------
 * mode: "signin" | "signup" | "upgrade" | null
 * onClose: () => void
 * T: theme object from parent
 *
 * Fixes applied vs previous version:
 *  - Inline @keyframes so animations work outside the main component tree
 *  - routing="hash" instead of "virtual" — works reliably on Vercel SPAs
 *  - afterSignInUrl / afterSignUpUrl removed — let Clerk use its defaults
 *  - signUpUrl / signInUrl set to "#" removed — caused silent navigation errors
 *  - Close button uses onMouseDown to fire before any blur events swallow it
 *  - zIndex bumped to 9999 — above Clerk's own internal overlays
 */
export default function AuthModal({ mode, onClose, T }) {
  if (!mode) return null;

  return (
    <>
      {/* Inline keyframes — needed because this component is outside the
          main <style> block and won't inherit its @keyframes */}
      <style>{`
        @keyframes oa-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes oa-slide-up {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>

      {/* Overlay */}
      <div
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          animation: "oa-fade-in 0.18s ease forwards",
        }}
      >
        {/* Close button — always visible top-right */}
        <button
          onMouseDown={(e) => { e.stopPropagation(); onClose(); }}
          aria-label="Close"
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(30,41,59,0.9)",
            color: "#94a3b8",
            fontSize: "1.15rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            lineHeight: 1,
            fontFamily: "inherit",
          }}
        >
          ×
        </button>

        {/* Upgrade modal */}
        {mode === "upgrade" && (
          <div style={{
            background: "#0d1424",
            border: "1px solid #1e293b",
            borderRadius: "16px",
            padding: "2rem",
            maxWidth: 440,
            width: "100%",
            animation: "oa-slide-up 0.22s ease forwards",
          }}>
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.4rem", color: "#e2e8f0", marginBottom: "0.5rem" }}>
                Unlock all tools
              </div>
              <p style={{ fontSize: "0.84rem", color: "#94a3b8", lineHeight: 1.65, margin: 0 }}>
                Salary benchmarking, counter calculator, recruiter role-play, email scripts,
                and outcome tracking — for 30 days.
              </p>
            </div>
            <div style={{ border: "1.5px solid #1d4ed8", borderRadius: "12px", padding: "1.25rem", marginBottom: "1rem", background: "rgba(29,78,216,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <div>
                  <div style={{ fontSize: "1rem", fontWeight: 600, color: "#e2e8f0" }}>Offer Sprint</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>One-time · 30 days full access</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#e2e8f0" }}>$29</div>
                  <div style={{ fontSize: "0.7rem", color: "#64748b" }}>one time</div>
                </div>
              </div>
              {["Unlimited coaching sessions", "Salary benchmark (US, UK, India)", "Counter-offer calculator + 4yr view", "Recruiter role-play mode", "Email & script generator", "Outcome tracker"].map(f => (
                <div key={f} style={{ display: "flex", gap: "6px", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "4px", alignItems: "center" }}>
                  <span style={{ color: "#34d399", flexShrink: 0 }}>✓</span> {f}
                </div>
              ))}
              <button
                onClick={() => {
                  alert("Stripe checkout coming soon. Email hello@offeradvisor.ai to upgrade manually.");
                  onClose();
                }}
                style={{ width: "100%", marginTop: "1rem", padding: "0.65rem", borderRadius: "10px", border: "none", background: "#1d4ed8", color: "white", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
              >
                Get Offer Sprint for $29 →
              </button>
            </div>
            <p style={{ textAlign: "center", fontSize: "0.7rem", color: "#475569", margin: 0 }}>
              Average user negotiates $12–18K more · 400× ROI on this purchase
            </p>
          </div>
        )}

        {/* Sign In */}
        {mode === "signin" && (
          <div style={{ animation: "oa-slide-up 0.22s ease forwards", width: "100%", maxWidth: 420 }}>
            <SignIn
              routing="hash"
              appearance={{
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
                },
              }}
            />
          </div>
        )}

        {/* Sign Up */}
        {mode === "signup" && (
          <div style={{ animation: "oa-slide-up 0.22s ease forwards", width: "100%", maxWidth: 420 }}>
            <SignUp
              routing="hash"
              appearance={{
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
                },
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}
