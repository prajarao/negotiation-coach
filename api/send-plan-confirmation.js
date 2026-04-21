/**
 * api/send-plan-confirmation.js
 * Sends email confirmation after successful Stripe checkout
 * Triggered by clerk-webhook.js when new user is created with active plan
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const planDetails = {
  free: {
    name: "Free Plan",
    features: ["Coach Tab Only", "1 Coaching Session"],
    price: "Free",
  },
  sprint: {
    name: "Offer Sprint",
    features: [
      "Coach, Benchmark, Counter-offer calculator (incl. 4-year totals), Recruiter role-play, Log win",
      "30 days of full access from purchase (unlimited use during that window)",
      "Multi-currency salary benchmark (US, UK, India+)",
      "LinkedIn job search shortcut from coach",
      "Email recaps when you use benchmark, calculator, or role-play",
    ],
    price: "$29",
  },
  pro: {
    name: "Offer in Hand",
    features: [
      "Everything in Offer Sprint, with no expiration",
      "Pro-only tabs: Templates, Playbook & History",
      "Same calculator & 4-year comparison — available as long as your account stays Pro",
      "Priority support",
      "New Pro-tier features as we release them",
    ],
    price: "$49",
  },
};

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("send-plan-confirmation: RESEND_API_KEY is not set");
    return res.status(500).json({ error: "Email provider not configured" });
  }

  const { userEmail, userName, plan, checkoutSessionId } = req.body;

  // Validate required fields
  if (!userEmail || !plan) {
    return res.status(400).json({ error: "Missing email or plan" });
  }

  const planInfo = planDetails[plan] || planDetails.free;

  try {
    const featureList = planInfo.features
      .map((f) => `<li style="margin-bottom: 8px; color: #333;">${f}</li>`)
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
              font-size: 28px;
              font-weight: 700;
            }
            .content {
              padding: 40px;
            }
            .greeting {
              font-size: 16px;
              margin-bottom: 20px;
              color: #555;
            }
            .plan-box {
              background: #f0f4ff;
              border-left: 4px solid #667eea;
              padding: 20px;
              border-radius: 6px;
              margin: 30px 0;
            }
            .plan-name {
              font-size: 20px;
              font-weight: 700;
              color: #667eea;
              margin-bottom: 10px;
            }
            .plan-price {
              font-size: 24px;
              font-weight: 700;
              color: #333;
              margin-bottom: 15px;
            }
            .features-list {
              list-style: none;
              padding: 0;
              margin: 0;
            }
            .features-list li {
              padding-left: 24px;
              position: relative;
            }
            .features-list li:before {
              content: "✓";
              position: absolute;
              left: 0;
              color: #667eea;
              font-weight: bold;
            }
            .cta-button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 14px 32px;
              border-radius: 6px;
              text-decoration: none;
              font-weight: 600;
              margin-top: 20px;
              transition: background 0.3s;
            }
            .cta-button:hover {
              background: #5568d3;
            }
            .divider {
              border-top: 1px solid #e5e7eb;
              margin: 30px 0;
            }
            .footer {
              background: #f9fafb;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #999;
              border-top: 1px solid #e5e7eb;
            }
            .receipt-ref {
              font-family: monospace;
              font-size: 12px;
              color: #999;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to OfferAdvisor</h1>
            </div>
            
            <div class="content">
              <div class="greeting">
                Hi ${userName ? userName.split(" ")[0] : "there"},
              </div>
              
              <p>Thanks for upgrading! Your payment was successful and your plan is now active.</p>
              
              <div class="plan-box">
                <div class="plan-name">${planInfo.name}</div>
                <div class="plan-price">${planInfo.price}</div>
                <ul class="features-list">
                  ${featureList}
                </ul>
              </div>
              
              <p style="color: #666;">
                You're all set to start negotiating with confidence. Use the AI coach to practice, calculate counter-offers, and track your outcomes.
              </p>
              
              <a href="https://offeradvisor.ai/dashboard" class="cta-button">
                Start Your First Session →
              </a>
              
              <div class="divider"></div>
              
              <h3 style="margin-top: 30px; margin-bottom: 15px;">Next Steps:</h3>
              <ol style="color: #666; padding-left: 20px;">
                <li style="margin-bottom: 10px;"><strong>Open the app</strong> and explore the Coach tab to practice your negotiation pitch</li>
                <li style="margin-bottom: 10px;"><strong>Check salary benchmarks</strong> for your role & location</li>
                <li style="margin-bottom: 10px;"><strong>Calculate your counter-offer</strong> with the 4-year projection tool</li>
                <li><strong>Track outcomes</strong> to measure your success</li>
              </ol>
              
              <p style="color: #999; font-size: 14px; margin-top: 20px;">
                Questions? Email us at support@offeradvisor.ai
              </p>
            </div>
            
            <div class="footer">
              <p style="margin: 0 0 10px 0;">© 2025 OfferAdvisor. All rights reserved.</p>
              <div class="receipt-ref">
                Order ID: ${checkoutSessionId ? checkoutSessionId.substring(0, 12) : "N/A"}
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = await resend.emails.send({
      from: "OfferAdvisor <noreply@offeradvisor.ai>",
      to: userEmail,
      subject: `Welcome to ${planInfo.name}! 🎉`,
      html,
      replyTo: "support@offeradvisor.ai",
    });

    console.log(`✓ Plan confirmation email sent to ${userEmail}`, result);
    res.status(200).json({ success: true, messageId: result.id });
  } catch (error) {
    console.error("Email send error:", error);
    res.status(500).json({ error: error.message });
  }
}
