// Minimal Google Gemini client via REST — powers the Proposal Coach
// and the City Inspector report. Uses Google AI Studio's free tier.
// Get a free key at https://aistudio.google.com/apikey
//
// Default model is gemini-2.5-flash — the current free-tier model.
// Override with GEMINI_MODEL if desired.

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function geminiGenerate({ system, user, maxTokens = 2048 }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no_key");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.85,
          // 2.5 models think by default; that spends the output budget
          // invisibly, so turn it off for these plain-text generations.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );

  if (res.status === 429) throw new Error("rate_limited");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`gemini_${res.status}: ${body.slice(0, 180)}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!text) throw new Error("empty_response");
  return text;
}
