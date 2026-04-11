import { useState } from "react";
import { SignIn, SignUp, useUser } from "@clerk/clerk-react";

/**
 * AuthModal
 * ---------
 * mode: "signin" | "signup" | "upgrade" | null
 * onClose: () => void
 * T: theme object from parent
 */
export default function AuthModal({ mode, onClose, T }) {
  const { user } = useUser();
  const [checkoutLoading, setCheckoutLoading] = useState(null); // "sprint" | "pro" | null
  const [checkoutError, setCheckoutError]     = useState(null);

  if (!mode) return null;

  // ── Redirect to Stripe Checkout ─────────────────────────────────────────────
  const handleCheckout = async (plan) => {
    setCheckoutLoading(plan);
    setCheckoutError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          clerkUserId: user?.id,
          userEmail:   user?.primaryEmailAddress?.emailAddress || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout");
      }

      // Redirect to Stripe-hosted checkout page
      window.location.href = data.url;

    } catch (err) {
      console.error("Checkout error:", err);
      setCheckoutError(err.message || "Something went wrong. Please try again.");
      setCheckoutLoading(null);
    }
  };

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
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        .oa-plan-card { transition: border-color 0.15s, background 0.15s; }
        .oa-plan-card:hover { border-color: #2563eb !important; }
        .oa-checkout-btn { transition: opacity 0.15s; }
        .oa-checkout-btn:hover { opacity: 0.88; }
        .oa-checkout-btn:disabled { opacity: 0.55; cursor: not-allowed; }
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
          overflowY: "auto",
          animation: "oa-fade-in 0.18s ease forwards",
        }}
      >
        {/* Close button */}
        <button
          onMouseDown={(e) => { e.stopPropagation(); onClose(); }}
          aria-label="Close"
          style={{
            position: "fixed",
            top: 16, right: 16,
            width: 36, height: 36,
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

        {/* ── Upgrade modal ─────────────────────────────────────────────────── */}
        {mode === "upgrade" && (
          <div style={{
            background: "#0d1424",
            border: "1px solid #1e293b",
            borderRadius: "16px",
            padding: "2rem",
            maxWidth: 520,
            width: "100%",
            animation: "oa-slide-up 0.22s ease forwards",
          }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.45rem", color: "#e2e8f0", marginBottom: "0.45rem" }}>
                Unlock all tools
              </div>
              <p style={{ fontSize: "0.83rem", color: "#94a3b8", lineHeight: 1.65, margin: 0 }}>
                One-time payment. No subscription. Full access for 30 days.
              </p>
            </div>

            {/* Plan cards — side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>

              {/* Offer Sprint — $29 */}
              <div className="oa-plan-card" style={{ border: "1.5px solid #1d4ed8", borderRadius: "12px", padding: "1.15rem", background: "rgba(29,78,216,0.06)", display: "flex", flexDirection: "column" }}>
                <div style={{ marginBottom: "0.6rem" }}>
                  <div style={{ fontSize: "0.68rem", color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Most popular</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#e2e8f0" }}>Offer Sprint</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginTop: "6px" }}>
                    <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#e2e8f0" }}>$29</span>
                    <span style={{ fontSize: "0.72rem", color: "#64748b" }}>one-time</span>
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#475569", marginTop: "2px" }}>30 days full access</div>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem", flex: 1 }}>
                  {["Unlimited sessions", "Salary benchmark", "Counter calculator", "Role-play mode", "Email scripts", "Outcome tracker"].map(f => (
                    <li key={f} style={{ display: "flex", gap: "5px", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "4px", alignItems: "center" }}>
                      <span style={{ color: "#34d399", flexShrink: 0 }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button
                  className="oa-checkout-btn"
                  onClick={() => handleCheckout("sprint")}
                  disabled={!!checkoutLoading}
                  style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "none", background: "#1d4ed8", color: "white", fontSize: "0.8rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {checkoutLoading === "sprint" ? "Redirecting…" : "Get Offer Sprint →"}
                </button>
              </div>

              {/* Offer in Hand — $49 */}
              <div className="oa-plan-card" style={{ border: "1px solid #2d1b69", borderRadius: "12px", padding: "1.15rem", background: "rgba(124,58,237,0.05)", display: "flex", flexDirection: "column" }}>
                <div style={{ marginBottom: "0.6rem" }}>
                  <div style={{ fontSize: "0.68rem", color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>High-stakes offers</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#e2e8f0" }}>Offer in Hand</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginTop: "6px" }}>
                    <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#e2e8f0" }}>$49</span>
                    <span style={{ fontSize: "0.72rem", color: "#64748b" }}>one-time</span>
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#475569", marginTop: "2px" }}>30 days full access</div>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem", flex: 1 }}>
                  {["Everything in Sprint", "4-year comp projection", "Benefits valuation", "Comp report export", "Follow-up coaching", "Priority support"].map(f => (
                    <li key={f} style={{ display: "flex", gap: "5px", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "4px", alignItems: "center" }}>
                      <span style={{ color: "#a78bfa", flexShrink: 0 }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button
                  className="oa-checkout-btn"
                  onClick={() => handleCheckout("pro")}
                  disabled={!!checkoutLoading}
                  style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "none", background: "#6d28d9", color: "white", fontSize: "0.8rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {checkoutLoading === "pro" ? "Redirecting…" : "Get Offer in Hand →"}
                </button>
              </div>
            </div>

            {/* Error message */}
            {checkoutError && (
              <div style={{ padding: "0.6rem 0.85rem", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "8px", fontSize: "0.78rem", color: "#fca5a5", marginBottom: "0.75rem" }}>
                {checkoutError}
              </div>
            )}

            {/* Trust signals */}
            <div style={{ display: "flex", justifyContent: "center", gap: "1.25rem", flexWrap: "wrap" }}>
              {["🔒 Secure checkout via Stripe", "↩ 30-day money-back guarantee", "📊 Avg user gains $12–18K"].map(t => (
                <span key={t} style={{ fontSize: "0.68rem", color: "#475569" }}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Sign In ────────────────────────────────────────────────────────── */}
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

        {/* ── Sign Up ────────────────────────────────────────────────────────── */}
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
