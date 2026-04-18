import { useState } from "react";

export default function TemplatesTab({ T }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [copied, setCopied] = useState(false);

  // Template data
  const templates = [
    {
      id: 1,
      title: "Initial Counter-Offer Email",
      subtitle: "Professional counter proposal",
      icon: "📧",
      whenToUse: "After you calculate your counter-offer",
      subject: "Follow-up: [ROLE] Offer Discussion",
      body: `Hi [RECRUITER_NAME],

Thank you for the offer for [ROLE] at [COMPANY]. I'm excited about the opportunity and appreciate the comprehensive package you've outlined.

Based on my research and experience, market data for this role ranges from $[P25] to $[P75]. I'd like to propose a base salary of $[COUNTER], which aligns with the market rate for this position.

I'm confident I can bring significant value to the team, and I believe this reflects fair compensation.

Are you available for a brief call this week to discuss?

Best regards,
[YOUR_NAME]`,
    },
    {
      id: 2,
      title: "Handling 'That's Not in Our Budget'",
      subtitle: "Graceful pushback on budget constraint",
      icon: "💰",
      whenToUse: "When recruiter says budget is fixed",
      subject: "Re: Salary Discussion",
      body: `Hi [RECRUITER_NAME],

I appreciate you getting back to me. I understand budgetary constraints are important.

To make sure we're on the same page, I have a couple of questions:
- What is the maximum base salary range available for this role?
- Could we explore other ways to strengthen the package? (additional equity, signing bonus, flexible start date)

I'm genuinely excited about this role and want to find a solution that works for both of us.

Looking forward to hearing from you.

Best,
[YOUR_NAME]`,
    },
    {
      id: 3,
      title: "Negotiating Equity When Base is Fixed",
      subtitle: "Shift focus to total compensation",
      icon: "📈",
      whenToUse: "Base salary is locked, negotiate equity instead",
      subject: "Re: Compensation Discussion",
      body: `Hi [RECRUITER_NAME],

I understand the base salary is set at $[BASE]. However, given the market data for this role, I'd like to explore strengthening the total compensation package.

Would it be possible to adjust:
- Additional stock options to reach market-rate total compensation
- Increased signing bonus
- Or a combination approach

This way, we're respecting the base constraint while aligning to market rates overall.

What options might be available?

Thanks,
[YOUR_NAME]`,
    },
    {
      id: 4,
      title: "Negotiating Bonus Percentage",
      subtitle: "Request higher target bonus",
      icon: "🎯",
      whenToUse: "Bonus % is below market standard",
      subject: "Re: Offer Details - Bonus Structure",
      body: `Hi [RECRUITER_NAME],

Thanks for clarifying the bonus structure. I noticed the target bonus is [BONUS_PCT]%, and based on my research, similar roles in this industry typically have targets of [MARKET_BONUS]%.

Would there be flexibility to adjust the target bonus to [YOUR_BONUS_REQUEST]%? This would better reflect industry standards and demonstrate confidence in my ability to achieve targets.

I'm committed to exceeding expectations and driving results.

Can we discuss this?

Best,
[YOUR_NAME]`,
    },
    {
      id: 5,
      title: "Gracefully Accepting (When They Won't Budge)",
      subtitle: "Professional acceptance while keeping door open",
      icon: "✅",
      whenToUse: "Negotiation ends, they won't move further",
      subject: "Re: [ROLE] Offer - Acceptance",
      body: `Hi [RECRUITER_NAME],

Thank you for working with me on this offer and for taking the time to discuss compensation. I appreciate the additional [equity/signing bonus/flexibility] we were able to add.

While the base is slightly below where I'd hoped, I'm genuinely excited about the opportunity to [company mission/problem]. This role aligns well with my career goals, and I'm confident in the value I can bring.

I'm pleased to accept the offer as discussed.

What are the next steps, and when do you need my formal acceptance?

Thanks again for the opportunity.

Best,
[YOUR_NAME]`,
    },
    {
      id: 6,
      title: "Requesting Revisit After 6-12 Months",
      subtitle: "Lock in performance-based revisit clause",
      icon: "🔄",
      whenToUse: "Accept offer but want revisit option",
      subject: "Offer Acceptance + 6-Month Revisit Discussion",
      body: `Hi [RECRUITER_NAME],

I'm excited to accept the offer for [ROLE]. Before I formally sign, I wanted to discuss one additional point.

I'd like to propose that we revisit compensation after 6-12 months based on my performance and impact. If I exceed expectations in [key metrics], would there be flexibility to revisit base salary or equity?

This aligns incentives and demonstrates mutual confidence in my ability to deliver.

Can we include this in our discussion?

Looking forward to joining the team.

Best,
[YOUR_NAME]`,
    },
  ];

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const formatEmail = (template) => {
    return `Subject: ${template.subject}\n\n${template.body}`;
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "1.25rem 1rem", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.3rem", color: T.textPrimary, margin: "0 0 0.3rem" }}>
            📧 Negotiation Email Templates
          </h2>
          <p style={{ fontSize: "0.82rem", color: T.textSecondary, margin: 0, lineHeight: 1.6 }}>
            Copy-paste-ready scripts for every negotiation scenario. Customize with your details and send.
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1rem", display: "flex", gap: "1rem" }}>
        {/* Template List (Left) */}
        <div style={{ flex: selectedTemplateId ? 0.4 : 1, minWidth: 0 }}>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplateId(template.id)}
                style={{
                  padding: "0.9rem",
                  background: selectedTemplateId === template.id ? T.cardBg : "transparent",
                  border: `1px solid ${selectedTemplateId === template.id ? "#3b82f6" : T.border}`,
                  borderRadius: "10px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                  color: T.textPrimary,
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#3b82f6";
                  e.currentTarget.style.background = T.cardBg;
                }}
                onMouseLeave={(e) => {
                  if (selectedTemplateId !== template.id) {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div style={{ fontSize: "1rem", marginBottom: "0.3rem" }}>{template.icon}</div>
                <div style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.2rem" }}>
                  {template.title}
                </div>
                <div style={{ fontSize: "0.7rem", color: T.textMuted }}>
                  {template.subtitle}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Template Preview (Right) */}
        {selectedTemplate && (
          <div style={{ flex: 0.6, minWidth: 0, borderLeft: `1px solid ${T.border}`, paddingLeft: "1rem" }}>
            <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "1rem" }}>
              {/* Info */}
              <div>
                <div style={{ fontSize: "0.7rem", color: T.textMuted, textTransform: "uppercase", marginBottom: "0.3rem", fontWeight: 600 }}>
                  When to use
                </div>
                <p style={{ fontSize: "0.8rem", color: T.textSecondary, margin: 0, lineHeight: 1.5 }}>
                  {selectedTemplate.whenToUse}
                </p>
              </div>

              {/* Email Preview */}
              <div style={{ flex: 1, background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "0.9rem", overflowY: "auto", fontFamily: "monospace", fontSize: "0.75rem", color: T.textSecondary, lineHeight: 1.6 }}>
                <div style={{ color: T.textMuted, marginBottom: "0.5rem", fontWeight: 600 }}>
                  Subject: {selectedTemplate.subject}
                </div>
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {selectedTemplate.body}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => handleCopy(formatEmail(selectedTemplate))}
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: "0.65rem",
                    background: "#1d4ed8",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#1e40af"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#1d4ed8"}
                >
                  {copied ? "✓ Copied!" : "📋 Copy to Clipboard"}
                </button>
                <button
                  onClick={() => {
                    const email = formatEmail(selectedTemplate);
                    const blob = new Blob([email], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${selectedTemplate.title.replace(/[^\w\s-]/g, "").trim().slice(0, 60) || "template"}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: "0.65rem",
                    background: "transparent",
                    color: "#1d4ed8",
                    border: "1px solid #1d4ed8",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(29,78,216,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  📥 Download
                </button>
              </div>

              {/* Help Text */}
              <div style={{ fontSize: "0.7rem", color: T.textMuted, padding: "0.75rem", background: T.cardBg, borderRadius: "6px" }}>
                💡 Replace [BRACKETS] with your specific details before sending. Customize tone and language to match your style.
              </div>
            </div>
          </div>
        )}

        {/* No Selection State */}
        {!selectedTemplate && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: T.textMuted, textAlign: "center", padding: "2rem" }}>
            <div>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📧</div>
              <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.6 }}>
                Select a template to see the full email script.<br/>
                Copy, customize, and send immediately.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}