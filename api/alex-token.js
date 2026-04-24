import { requirePlan } from "./_plan-gate.js";

/**
 * Returns a short-lived WebRTC conversation token for the ElevenLabs ConvAI agent.
 * PRO only — @see _plan-gate "alex" feature.
 */
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const gate = await requirePlan(req, res, "alex");
  if (!gate.ok) return;

  const agentId = process.env.ELEVENLABS_AGENT_ID || "agent_2301kpy9qz46esfvk43vjftcmbfr";
  if (!process.env.ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: "ElevenLabs is not configured" });
  }

  const apiBase = (process.env.ELEVENLABS_API_BASE || "https://api.elevenlabs.io").replace(/\/$/, "");
  const url = new URL(`${apiBase}/v1/convai/conversation/token`);
  url.searchParams.set("agent_id", agentId);

  const r = await fetch(url.toString(), {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
  });

  if (!r.ok) {
    const t = await r.text();
    console.error("ElevenLabs token error:", r.status, t);
    let detail = t;
    try {
      const j = JSON.parse(t);
      const d = j.detail;
      if (typeof d === "object" && d !== null && !Array.isArray(d)) {
        detail = d.message || d.status || JSON.stringify(d);
      } else {
        detail =
          (typeof d === "string" ? d : null) ||
          j.detail?.message ||
          (Array.isArray(j.detail) ? j.detail.map((x) => x.msg || x).join(" ") : null) ||
          j.message ||
          t;
      }
    } catch {
      /* use raw t */
    }
    const hint =
      r.status === 401 || r.status === 403
        ? "Use an API key with Conversational AI access: in ElevenLabs → API keys, enable convai_read (or all permissions). Re-add ELEVENLABS_API_KEY in Vercel (Production) and redeploy."
        : r.status === 404
          ? "Check ELEVENLABS_AGENT_ID matches your agent in ElevenLabs → Agents."
          : null;
    return res.status(502).json({
      error: "Could not get conversation token",
      elevenStatus: r.status,
      /** Safe to show in UI — no secrets */
      detail: typeof detail === "string" ? detail.slice(0, 400) : String(detail).slice(0, 400),
      ...(hint && { hint }),
    });
  }

  const data = await r.json();
  const token = data?.token || data?.conversation_token;
  if (!token) {
    return res.status(502).json({ error: "Invalid token response from ElevenLabs" });
  }

  return res.status(200).json({ token, agentId });
}
