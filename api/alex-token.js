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

  const url = new URL("https://api.elevenlabs.io/v1/convai/conversation/token");
  url.searchParams.set("agent_id", agentId);

  const r = await fetch(url.toString(), {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
  });

  if (!r.ok) {
    const t = await r.text();
    console.error("ElevenLabs token error:", r.status, t);
    return res.status(502).json({ error: "Could not get conversation token" });
  }

  const data = await r.json();
  if (!data?.token) {
    return res.status(502).json({ error: "Invalid token response" });
  }

  return res.status(200).json({ token: data.token, agentId });
}
