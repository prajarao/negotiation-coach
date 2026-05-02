import { useState } from "react";
import { SignIn, SignUp, useUser } from "@clerk/clerk-react";
import { offeradvisorClerkAppearance } from "./clerkAppearance.js";
import { BRIDGE_EXPANDED, BRIDGE_TAB_LABEL } from "./constants/bridgeProgram.js";

/**
 * AuthModal
 * ---------
 * mode: "signin" | "signup" | "upgrade" | null
 * onClose: () => void
 * T: theme object from parent
 */
export default function AuthModal({ mode, onClose, T }) {
  const { user } = useUser();
  const [checkoutLoading, setCheckoutLoading] = useState(null); // "sprint" | "pro" | "student_plus" | null
  const [checkoutError, setCheckoutError]     = useState(null);
  const [promotionCode, setPromotionCode]       = useState("");

  if (!mode) return null;

  // Match App.jsx: Sprint expiry in metadata; expired Sprint is treated like free for upgrades.
  // Sync with Stripe webhook: plan "student_plus" uses same 30-day expiresAt metadata as sprint.
  const clerkPlan = (user?.publicMetadata?.plan) || "free";
  const planWindowExpiresAtIso =
    user?.publicMetadata?.expiresAt ?? user?.publicMetadata?.planExpiresAt ?? null;
  const isTimedPlanExpired =
    (clerkPlan === "sprint" || clerkPlan === "student_plus")
    && planWindowExpiresAtIso
    && new Date() > new Date(planWindowExpiresAtIso);
  const effectivePlan = isTimedPlanExpired ? "free" : clerkPlan;
  const isActiveSprint = effectivePlan === "sprint";
  const isActiveStudentPlus = effectivePlan === "student_plus";
  const isPro = effectivePlan === "pro";

  // ── Redirect to Stripe Checkout ─────────────────────────────────────────────
  const handleCheckout = async (plan) => {
    if (plan === "student_plus" && isActiveStudentPlus) {
      setCheckoutError("You're already on Student Plus.");
      return;
    }
    if (plan === "sprint" && isActiveStudentPlus) {
      setCheckoutError("You already have Student Plus (same access tier). Upgrade to Pro for Templates, Playbook, History & no expiry.");
      return;
    }
    if (plan === "student_plus" && isActiveSprint) {
      setCheckoutError("You already have Offer Sprint (same access tier). Upgrade to Pro for Templates, Playbook, History & no expiry.");
      return;
    }
    if (plan === "sprint" && isActiveSprint) {
      setCheckoutError("You're already on Offer Sprint.");
      return;
    }
    if (plan === "pro" && isPro) {
      setCheckoutError("You're already on Offer in Hand — there's no higher plan.");
      return;
    }

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
          promotionCode: promotionCode.trim() || undefined,
        }),
      });

      // Parse the response — even on error it returns JSON
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server returned ${res.status} with no JSON body`);
      }

      if (!res.ok) {
        // Surface the exact server error — not a generic message
        throw new Error(data.error || `Server error ${res.status}`);
      }

      if (!data.url) {
        throw new Error("Checkout session created but no URL returned");
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
            maxWidth: isPro ? 440 : 800,
            width: "100%",
            animation: "oa-slide-up 0.22s ease forwards",
          }}>
            {isPro ? (
              <>
                <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                  <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.45rem", color: "#e2e8f0", marginBottom: "0.45rem" }}>
                    You're on the top plan
                  </div>
                  <p style={{ fontSize: "0.83rem", color: "#94a3b8", lineHeight: 1.65, margin: 0 }}>
                    Offer in Hand includes every tool we sell, with no expiry. There is no further upgrade.
                  </p>
                </div>
                <div style={{ padding: "1rem", borderRadius: "12px", border: "1px solid #4c1d95", background: "rgba(124,58,237,0.08)", marginBottom: "1rem" }}>
                  <div style={{ fontSize: "0.72rem", color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Current plan</div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "#e2e8f0" }}>Offer in Hand</div>
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => { e.stopPropagation(); onClose(); }}
                  style={{ width: "100%", padding: "0.65rem", borderRadius: "10px", border: `1px solid #334155`, background: "#1e293b", color: "#e2e8f0", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Close
                </button>
              </>
            ) : (
              <>
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
                  <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.45rem", color: "#e2e8f0", marginBottom: "0.45rem" }}>
                    {isActiveSprint ? "Upgrade to Offer in Hand" : "Unlock all tools"}
                  </div>
                  <p style={{ fontSize: "0.83rem", color: "#94a3b8", lineHeight: 1.65, margin: 0 }}>
                    {isActiveSprint
                      ? "You're on Offer Sprint. Move to Pro for no expiry and Pro-only tabs — one-time payment, no subscription."
                      : "One-time payments, no subscription. Sprint & Student Plus: 30 days from purchase. Pro: no expiry."}
                  </p>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <label htmlFor="oa-promo-code" style={{ display: "block", fontSize: "0.72rem", color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Invite code (optional)
                  </label>
                  <input
                    id="oa-promo-code"
                    type="text"
                    autoComplete="off"
                    value={promotionCode}
                    onChange={(e) => setPromotionCode(e.target.value)}
                    placeholder="e.g. FRIEND50"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "10px",
                      border: "1px solid #334155",
                      background: "#0a0f1a",
                      color: "#e2e8f0",
                      fontSize: "0.85rem",
                      fontFamily: "inherit",
                      letterSpacing: "0.04em",
                    }}
                  />
                  <p style={{ fontSize: "0.68rem", color: "#475569", margin: "6px 0 0", lineHeight: 1.45 }}>
                    Private invite codes apply automatically on Stripe. Leave blank for list price — you can still enter a promotion on Stripe’s checkout when no invite code is used here.
                  </p>
                </div>

                {/* Plan cards — side by side */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>

                  {/* Offer Sprint — $29 */}
                  <div
                    className="oa-plan-card"
                    style={{
                      border: isActiveSprint ? "1.5px solid #334155" : "1.5px solid #1d4ed8",
                      borderRadius: "12px",
                      padding: "1.15rem",
                      background: isActiveSprint ? "rgba(51,65,85,0.2)" : "rgba(29,78,216,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      opacity: isActiveSprint ? 0.92 : 1,
                    }}
                  >
                    <div style={{ marginBottom: "0.6rem" }}>
                      <div style={{ fontSize: "0.68rem", color: isActiveSprint ? "#94a3b8" : "#60a5fa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                        {isActiveSprint ? "Current plan" : "Most popular"}
                      </div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#e2e8f0" }}>Offer Sprint</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginTop: "6px" }}>
                        <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#e2e8f0" }}>$29</span>
                        <span style={{ fontSize: "0.72rem", color: "#64748b" }}>one-time</span>
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "#475569", marginTop: "2px" }}>30 days from purchase</div>
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem", flex: 1 }}>
                      {["Unlimited sessions", "Salary benchmark", "Counter calculator", "Role-play mode", "Log win & outcome tracker", "Multi-currency benchmark"].map(f => (
                        <li key={f} style={{ display: "flex", gap: "5px", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "4px", alignItems: "center" }}>
                          <span style={{ color: "#34d399", flexShrink: 0 }}>✓</span>{f}
                        </li>
                      ))}
                    </ul>
                    <button
                      className="oa-checkout-btn"
                      type="button"
                      onClick={() => handleCheckout("sprint")}
                      disabled={!!checkoutLoading || isActiveSprint}
                      style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "none", background: isActiveSprint ? "#334155" : "#1d4ed8", color: "white", fontSize: "0.8rem", fontWeight: 500, cursor: isActiveSprint ? "default" : "pointer", fontFamily: "inherit" }}
                    >
                      {isActiveSprint ? "Current plan" : checkoutLoading === "sprint" ? "Redirecting…" : "Get Offer Sprint →"}
                    </button>
                  </div>

                  {/* Student Plus — USD list (set identical one-time Price in Stripe) */}
                  <div
                    className="oa-plan-card"
                    style={{
                      border: isActiveStudentPlus ? "1.5px solid #334155" : "1.5px solid #0d9488",
                      borderRadius: "12px",
                      padding: "1.15rem",
                      background: isActiveStudentPlus ? "rgba(51,65,85,0.2)" : "rgba(13,148,136,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      opacity: isActiveStudentPlus ? 0.92 : 1,
                    }}
                  >
                    <div style={{ marginBottom: "0.6rem" }}>
                      <div style={{ fontSize: "0.68rem", color: isActiveStudentPlus ? "#94a3b8" : "#5eead4", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                        {isActiveStudentPlus ? "Current plan" : `${BRIDGE_TAB_LABEL} & campus`}
                      </div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#e2e8f0" }}>Student Plus</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginTop: "6px" }}>
                        <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#e2e8f0" }}>$19.99</span>
                        <span style={{ fontSize: "0.72rem", color: "#64748b" }}>USD · one-time</span>
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "#475569", marginTop: "2px" }}>30-day access · invite codes adjust price at checkout</div>
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem", flex: 1 }}>
                      {[
                        `${BRIDGE_TAB_LABEL} workspace — benchmarks, compare offers, paths & campus verification (${BRIDGE_EXPANDED})`,
                        `Coach chat strip while you're on ${BRIDGE_TAB_LABEL} (Share offer tab is Sprint / Pro)`,
                        "Built for new grads & campus programs",
                        "Optional invite code for school pricing · campuses can grant access",
                      ].map((f) => (
                        <li key={f} style={{ display: "flex", gap: "5px", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "4px", alignItems: "center" }}>
                          <span style={{ color: "#2dd4bf", flexShrink: 0 }}>✓</span>{f}
                        </li>
                      ))}
                    </ul>
                    <button
                      className="oa-checkout-btn"
                      type="button"
                      onClick={() => handleCheckout("student_plus")}
                      disabled={!!checkoutLoading || isActiveStudentPlus}
                      style={{
                        width: "100%",
                        padding: "0.6rem",
                        borderRadius: "8px",
                        border: "none",
                        background: isActiveStudentPlus ? "#334155" : "#0f766e",
                        color: "white",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        cursor: isActiveStudentPlus ? "default" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {isActiveStudentPlus ? "Current plan" : checkoutLoading === "student_plus" ? "Redirecting…" : "Get Student Plus →"}
                    </button>
                  </div>

                  {/* Offer in Hand — $49 */}
                  <div
                    className="oa-plan-card"
                    style={{
                      border: (isActiveSprint || isActiveStudentPlus) ? "2px solid #7c3aed" : "1px solid #2d1b69",
                      borderRadius: "12px",
                      padding: "1.15rem",
                      background: (isActiveSprint || isActiveStudentPlus) ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.05)",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ marginBottom: "0.6rem" }}>
                      <div style={{ fontSize: "0.68rem", color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                        {(isActiveSprint || isActiveStudentPlus) ? "Upgrade" : "High-stakes offers"}
                      </div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#e2e8f0" }}>Offer in Hand</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginTop: "6px" }}>
                        <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#e2e8f0" }}>$49</span>
                        <span style={{ fontSize: "0.72rem", color: "#64748b" }}>one-time</span>
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "#475569", marginTop: "2px" }}>No expiry · full access</div>
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem", flex: 1 }}>
                      {["Everything in Sprint", "No expiry after purchase", "Templates, Playbook guide & History tab", "4-year view in calculator (same as Sprint)", "Priority support", "New Pro features as shipped"].map(f => (
                        <li key={f} style={{ display: "flex", gap: "5px", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "4px", alignItems: "center" }}>
                          <span style={{ color: "#a78bfa", flexShrink: 0 }}>✓</span>{f}
                        </li>
                      ))}
                    </ul>
                    <button
                      className="oa-checkout-btn"
                      type="button"
                      onClick={() => handleCheckout("pro")}
                      disabled={!!checkoutLoading}
                      style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "none", background: "#6d28d9", color: "white", fontSize: "0.8rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {checkoutLoading === "pro" ? "Redirecting…" : (isActiveSprint || isActiveStudentPlus) ? "Upgrade to Pro →" : "Get Offer in Hand →"}
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
              </>
            )}
          </div>
        )}

        {/* ── Sign In ────────────────────────────────────────────────────────── */}
        {mode === "signin" && (
          <div style={{ animation: "oa-slide-up 0.22s ease forwards", width: "100%", maxWidth: 420 }}>
            <SignIn routing="hash" appearance={offeradvisorClerkAppearance()} />
          </div>
        )}

        {/* ── Sign Up ────────────────────────────────────────────────────────── */}
        {mode === "signup" && (
          <div style={{ animation: "oa-slide-up 0.22s ease forwards", width: "100%", maxWidth: 420 }}>
            <SignUp routing="hash" appearance={offeradvisorClerkAppearance()} />
          </div>
        )}
      </div>
    </>
  );
}
