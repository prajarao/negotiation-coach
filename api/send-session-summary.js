/**
 * api/send-session-summary.js
 * Sends negotiation session summary email to user
 * Called from chat.js when user completes a coaching session or counter-offer calculation
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("send-session-summary: RESEND_API_KEY is not set");
    return res.status(500).json({ error: "Email provider not configured" });
  }

  const {
    userEmail,
    userName,
    sessionType, // "coach" | "counter_offer" | "recruiter" | "benchmark"
    sessionData,
  } = req.body;

  // Validate required fields
  if (!userEmail || !sessionType || !sessionData) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    let html = "";

    if (sessionType === "coach") {
      html = generateCoachingEmail(sessionData, userName, userEmail);
    } else if (sessionType === "counter_offer") {
      html = generateCounterOfferEmail(sessionData, userName, userEmail);
    } else if (sessionType === "recruiter") {
      html = generateRecruiterRoleplayEmail(sessionData, userName, userEmail);
    } else if (sessionType === "benchmark") {
      html = generateBenchmarkEmail(sessionData, userName, userEmail);
    }

    if (!html) {
      return res.status(400).json({ error: "Unknown session type" });
    }

    const result = await resend.emails.send({
      from: "OfferAdvisor <noreply@offeradvisor.ai>",
      to: userEmail,
      subject: `Your ${getSubjectLine(sessionType)} Session Summary`,
      html,
      replyTo: "support@offeradvisor.ai",
    });

    console.log(`✓ Session summary email sent to ${userEmail}`, result);
    res.status(200).json({ success: true, messageId: result.id });
  } catch (error) {
    console.error("Email send error:", error);
    res.status(500).json({ error: error.message });
  }
}

function getSubjectLine(sessionType) {
  const subjects = {
    coach: "Coaching Session",
    counter_offer: "Counter-Offer Calculation",
    recruiter: "AI Recruiter Role-Play",
    benchmark: "Salary Benchmark",
  };
  return subjects[sessionType] || "Session";
}

function generateCoachingEmail(data, userName, userEmail) {
  const {
    negotiationTopic = "Salary Negotiation",
    keyPoints = [],
    practiceTranscript = "",
    feedback = "",
    nextSteps = [],
  } = data;

  const keyPointsHtml = keyPoints
    .map((point) => `<li style="margin-bottom: 8px; color: #333;">${point}</li>`)
    .join("");

  const nextStepsHtml = nextSteps
    .map((step) => `<li style="margin-bottom: 8px; color: #555;">${step}</li>`)
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f9fafb;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
          }
          .content {
            padding: 40px;
          }
          .section-title {
            font-size: 18px;
            font-weight: 700;
            color: #333;
            margin-top: 25px;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #f0f4ff;
          }
          .highlight-box {
            background: #f0f4ff;
            border-left: 4px solid #667eea;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
          }
          .key-points-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .key-points-list li {
            padding-left: 24px;
            position: relative;
            margin-bottom: 10px;
          }
          .key-points-list li:before {
            content: "→";
            position: absolute;
            left: 0;
            color: #667eea;
            font-weight: bold;
          }
          .feedback-box {
            background: #fffbf0;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            font-style: italic;
            color: #666;
          }
          .cta-button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 28px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 20px;
          }
          .footer {
            background: #f9fafb;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #999;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 Coaching Session Complete</h1>
          </div>
          
          <div class="content">
            <p>Hi ${userName ? userName.split(" ")[0] : "there"},</p>
            
            <p>Great work on completing your ${negotiationTopic} coaching session! Here's your personalized summary to review and practice.</p>
            
            <div class="section-title">Key Talking Points</div>
            <ul class="key-points-list">
              ${keyPointsHtml || "<li>Open the app to view your session notes</li>"}
            </ul>
            
            ${
              feedback
                ? `<div class="section-title">AI Coach Feedback</div>
                <div class="feedback-box">
                  ${feedback}
                </div>`
                : ""
            }
            
            ${
              nextStepsHtml
                ? `<div class="section-title">Practice Next Steps</div>
                <ol style="padding-left: 20px; color: #555;">
                  ${nextStepsHtml}
                </ol>`
                : ""
            }
            
            <div class="highlight-box">
              <strong>💡 Tip:</strong> Read through these points before your actual negotiation. Confidence comes from preparation!
            </div>
            
            <a href="https://offeradvisor.ai/dashboard" class="cta-button">
              Review Full Session →
            </a>
          </div>
          
          <div class="footer">
            <p style="margin: 0;">© 2025 OfferAdvisor. Negotiating your best offer.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function generateCounterOfferEmail(data, userName, userEmail) {
  const {
    baseOffer = 0,
    proposedCounter = 0,
    fourYearProjection = [],
    totalAdditionalCompensation = 0,
  } = data;

  const projectionHtml = fourYearProjection
    .map(
      (year, idx) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; text-align: left;">Year ${idx + 1}</td>
      <td style="padding: 12px; text-align: right; font-weight: 600; color: #667eea;">
        $${Number(year.salary).toLocaleString()}
      </td>
      <td style="padding: 12px; text-align: right; color: #666;">
        $${Number(year.cumulative).toLocaleString()}
      </td>
    </tr>`
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f9fafb;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
          }
          .content {
            padding: 40px;
          }
          .comparison-box {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 25px 0;
          }
          .offer-card {
            background: #f9fafb;
            border-radius: 6px;
            padding: 20px;
            text-align: center;
          }
          .offer-label {
            font-size: 12px;
            text-transform: uppercase;
            color: #999;
            font-weight: 600;
            margin-bottom: 10px;
          }
          .offer-amount {
            font-size: 28px;
            font-weight: 700;
            color: #333;
          }
          .increase-badge {
            background: #d1fae5;
            color: #065f46;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 10px;
            display: inline-block;
          }
          .projection-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .projection-table th {
            background: #f0f4ff;
            padding: 12px;
            text-align: left;
            font-weight: 700;
            color: #667eea;
            border-bottom: 2px solid #e5e7eb;
          }
          .highlight-total {
            background: #f0f4ff;
            border-left: 4px solid #10b981;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: 600;
            color: #065f46;
          }
          .cta-button {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 12px 28px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 20px;
          }
          .footer {
            background: #f9fafb;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #999;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 Counter-Offer Ready</h1>
          </div>
          
          <div class="content">
            <p>Hi ${userName ? userName.split(" ")[0] : "there"},</p>
            
            <p>Your counter-offer calculation is complete. Here's what you're proposing:</p>
            
            <div class="comparison-box">
              <div class="offer-card">
                <div class="offer-label">Their Offer</div>
                <div class="offer-amount">$${Number(baseOffer).toLocaleString()}</div>
              </div>
              <div class="offer-card">
                <div class="offer-label">Your Counter</div>
                <div class="offer-amount">$${Number(proposedCounter).toLocaleString()}</div>
                <div class="increase-badge">
                  +$${Number(proposedCounter - baseOffer).toLocaleString()}
                </div>
              </div>
            </div>
            
            ${
              fourYearProjection && fourYearProjection.length > 0
                ? `<div style="margin-top: 30px;">
                <h3 style="margin-bottom: 15px; color: #333;">4-Year Projection</h3>
                <table class="projection-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th style="text-align: right;">Annual</th>
                      <th style="text-align: right;">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${projectionHtml}
                  </tbody>
                </table>
              </div>`
                : ""
            }
            
            <div class="highlight-total">
              💡 Total Additional Compensation Over 4 Years:
              <br />
              $${Number(totalAdditionalCompensation).toLocaleString()}
            </div>
            
            <p style="color: #666;">
              <strong>Pro tip:</strong> Use this data when negotiating. Show them the long-term value you bring.
            </p>
            
            <a href="https://offeradvisor.ai/dashboard" class="cta-button">
              Refine Your Counter →
            </a>
          </div>
          
          <div class="footer">
            <p style="margin: 0;">© 2025 OfferAdvisor. Negotiating your best offer.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function generateRecruiterRoleplayEmail(data, userName, userEmail) {
  const {
    scenario = "Negotiation Challenge",
    keyTakeaways = [],
    commonObjections = [],
  } = data;

  const takeawaysHtml = keyTakeaways
    .map((item) => `<li style="margin-bottom: 10px; color: #555;">${item}</li>`)
    .join("");

  const objectionsHtml = commonObjections
    .map((obj) => `<li style="margin-bottom: 10px; color: #555;">${obj}</li>`)
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f9fafb;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
          }
          .content {
            padding: 40px;
          }
          .section-title {
            font-size: 16px;
            font-weight: 700;
            color: #333;
            margin-top: 25px;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #fef3c7;
          }
          .insight-box {
            background: #fffbf0;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
          }
          .list-item {
            padding-left: 24px;
            position: relative;
            margin-bottom: 10px;
          }
          .list-item:before {
            content: "•";
            position: absolute;
            left: 5px;
            color: #f59e0b;
            font-weight: bold;
          }
          .cta-button {
            display: inline-block;
            background: #f59e0b;
            color: white;
            padding: 12px 28px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 20px;
          }
          .footer {
            background: #f9fafb;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #999;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎭 Role-Play Complete</h1>
          </div>
          
          <div class="content">
            <p>Hi ${userName ? userName.split(" ")[0] : "there"},</p>
            
            <p>You've completed the AI recruiter role-play scenario. Here's what you learned:</p>
            
            <div class="insight-box">
              <strong>Scenario:</strong> ${scenario}
            </div>
            
            ${
              takeawaysHtml
                ? `<div class="section-title">Key Takeaways</div>
                <div>
                  ${takeawaysHtml
                    .split("</li>")
                    .map((item) => (item ? `<div class="list-item">${item}</div>` : ""))
                    .join("")}
                </div>`
                : ""
            }
            
            ${
              objectionsHtml
                ? `<div class="section-title">Common Objections to Prepare For</div>
                <div>
                  ${objectionsHtml
                    .split("</li>")
                    .map((item) => (item ? `<div class="list-item">${item}</div>` : ""))
                    .join("")}
                </div>`
                : ""
            }
            
            <p style="color: #666; margin-top: 20px;">
              <strong>Next step:</strong> Practice these responses with a friend or mentor before your real conversation.
            </p>
            
            <a href="https://offeradvisor.ai/dashboard" class="cta-button">
              Try Another Scenario →
            </a>
          </div>
          
          <div class="footer">
            <p style="margin: 0;">© 2025 OfferAdvisor. Negotiating your best offer.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function generateBenchmarkEmail(data, userName, userEmail) {
  const { role = "Your Role", location = "Your Location", average = 0, p25 = 0, p75 = 0 } = data;

  const currencySymbol = data.currencySymbol || "$";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f9fafb;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
          }
          .content {
            padding: 40px;
          }
          .benchmark-box {
            background: #f0f4ff;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 15px;
          }
          .benchmark-item {
            text-align: center;
          }
          .benchmark-label {
            font-size: 11px;
            text-transform: uppercase;
            color: #1e40af;
            font-weight: 600;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
          }
          .benchmark-value {
            font-size: 20px;
            font-weight: 700;
            color: #1e40af;
          }
          .cta-button {
            display: inline-block;
            background: #3b82f6;
            color: white;
            padding: 12px 28px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 20px;
          }
          .footer {
            background: #f9fafb;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #999;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Salary Benchmark Report</h1>
          </div>
          
          <div class="content">
            <p>Hi ${userName ? userName.split(" ")[0] : "there"},</p>
            
            <p>Here's the market data for <strong>${role}</strong> in <strong>${location}</strong>:</p>
            
            <div class="benchmark-box">
              <div class="benchmark-item">
                <div class="benchmark-label">25th Percentile</div>
                <div class="benchmark-value">${currencySymbol}${Number(p25 || 0).toLocaleString()}</div>
              </div>
              <div class="benchmark-item">
                <div class="benchmark-label">Median (50th)</div>
                <div class="benchmark-value">${currencySymbol}${Number(average || 0).toLocaleString()}</div>
              </div>
              <div class="benchmark-item">
                <div class="benchmark-label">75th Percentile</div>
                <div class="benchmark-value">${currencySymbol}${Number(p75 || 0).toLocaleString()}</div>
              </div>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              <strong>💡 Tip:</strong> Use the <strong>median (50th percentile)</strong> as your initial anchor point. This is where the market values your role. If your offer is below this, you have strong negotiation leverage.
            </p>
            
            <a href="https://offeradvisor.ai/dashboard" class="cta-button">
              View Full Report & Calculator →
            </a>
          </div>
          
          <div class="footer">
            <p style="margin: 0;">© 2025 OfferAdvisor. Negotiating your best offer.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
