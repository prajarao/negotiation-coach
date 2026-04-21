/**
 * api/send-plan-confirmation.js
 * HTTP entry for plan / welcome confirmation email (Resend).
 * Webhooks call sendPlanConfirmationEmail() directly — see _plan-confirmation-email.js.
 */

import { sendPlanConfirmationEmail } from "./_plan-confirmation-email.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body =
    typeof req.body === "object" && req.body !== null && !Buffer.isBuffer(req.body)
      ? req.body
      : {};

  const result = await sendPlanConfirmationEmail(body);
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }
  return res.status(200).json({ success: true, messageId: result.messageId });
}
