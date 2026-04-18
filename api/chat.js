import { requirePlan } from "./_plan-gate.js";
import { supabase } from "./_supabase.js";
import { NEGOTIATION_BOOK_REFERENCE } from "./_negotiation-book-knowledge.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Plan gate — coach is open to guests but usage-limited for free users
  const gate = await requirePlan(req, res, "coach", { allowGuest: true });
  if (!gate.ok) return;

  try {
    const { messages, system } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages must be an array" });
    }

    const userSystem = typeof system === "string" ? system : "";
    const book =
      typeof NEGOTIATION_BOOK_REFERENCE === "string" && NEGOTIATION_BOOK_REFERENCE.trim().length > 0
        ? `\n\n--- Reference: Negotiation Made Simple (John Lowry) ---\nUse these ideas, stories, and frameworks when they genuinely help the user. Synthesize in your own words; do not paste long verbatim passages unless they ask for exact wording.\n\n${NEGOTIATION_BOOK_REFERENCE.trim()}`
        : "";
    const mergedSystem = userSystem + book;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 1000,
          temperature: 0.7,
          messages: [
            { role: "system", content: mergedSystem },
            ...messages,
          ],
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    const replyText =
      data.choices?.[0]?.message?.content ||
      "Could not generate a response. Please try again.";

    // Increment usage for signed-in users
    if (gate.user?.clerk_id) {
      await supabase
        .from("users")
        .update({ usage_count: (gate.user.usage_count || 0) + 1 })
        .eq("clerk_id", gate.user.clerk_id);
    }

    return res.status(200).json({ content: [{ text: replyText }] });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
