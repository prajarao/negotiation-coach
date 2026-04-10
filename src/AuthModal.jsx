import { SignIn, SignUp } from "@clerk/clerk-react";

/**
 * AuthModal
 * ---------
 * mode: "signin" | "signup" | "upgrade"
 * onClose: () => void
 * T: theme object from parent
 */
export default function AuthModal({ mode, onClose, T }) {
  if (!mode) return null;

  const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    zIndex: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
    animation: "fadeIn 0.18s ease",
  };

  const closeBtn = {
    position: "absolute",
    top: 18,
    right: 18,
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#94a3b8",
    fontSize: "1.1rem",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  };

  // ── Upgrade prompt (pre-Stripe — will be wired to checkout in Step 6) ────────
  if (mode === "upgrade") {
    return (
      <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={overlay}>
        <button onClick={onClose} aria-label="Close" style={closeBtn}>×</button>
        <div style={{ background: "#0d1424", border: "1px solid #1e293b", borderRadius: "16px", padding: "2rem", maxWidth: 440, width: "100%", animation: "slideIn 0.22s ease" }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.4rem", color: "#e2e8f0", marginBottom: "0.5rem" }}>Unlock all tools</div>
            <p style={{ fontSize: "0.84rem", color: "#94a3b8", lineHeight: 1.65, margin: 0 }}>Salary benchmarking, counter calculator, recruiter role-play, email scripts, and outcome tracking — for 30 days.</p>
          </div>
          {/* Offer Sprint plan card */}
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
                // Stripe checkout will be wired here in Step 6
                alert("Stripe checkout coming in Step 6. For now, contact support to upgrade.");
                onClose();
              }}
              style={{ width: "100%", marginTop: "1rem", padding: "0.65rem", borderRadius: "10px", border: "none", background: "#1d4ed8", color: "white", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
              Get Offer Sprint for $29 →
            </button>
          </div>
          <p style={{ textAlign: "center", fontSize: "0.7rem", color: "#475569", margin: 0 }}>
            Average user negotiates $12–18K more · 400× ROI on this purchase
          </p>
        </div>
      </div>
    );
  }

  // ── Sign In / Sign Up ─────────────────────────────────────────────────────────
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={overlay}
    >
      <button onClick={onClose} aria-label="Close" style={closeBtn}>×</button>
      {mode === "signin" ? (
        <SignIn
          routing="virtual"
          afterSignInUrl="/"
          signUpUrl="#"
          appearance={{ elements: { rootBox: { width: "100%", maxWidth: 420 } } }}
        />
      ) : (
        <SignUp
          routing="virtual"
          afterSignUpUrl="/"
          signInUrl="#"
          appearance={{ elements: { rootBox: { width: "100%", maxWidth: 420 } } }}
        />
      )}
    </div>
  );
}
