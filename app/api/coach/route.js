// AI Proposal Coach — outlines a proposal from a project idea, or
// reviews a draft the way an experienced org mentor would.

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "no_key" }, { status: 501 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const mode = body.mode === "review" ? "review" : "outline";
  const org = String(body.org || "").slice(0, 100);
  const idea = String(body.idea || "").slice(0, 6000);
  const draft = String(body.draft || "").slice(0, 12000);
  const program = ["GSoC", "LFX", "Outreachy"].includes(body.program)
    ? body.program
    : "GSoC";

  if (mode === "outline" && !idea.trim()) {
    return Response.json({ error: "missing_idea" }, { status: 400 });
  }
  if (mode === "review" && !draft.trim()) {
    return Response.json({ error: "missing_draft" }, { status: 400 });
  }

  const system = `You are the Proposal Coach for Commit City, helping students apply to open-source mentorship programs (GSoC, LFX Mentorship, Outreachy). You have the perspective of an experienced org mentor who has read hundreds of proposals. Be specific, practical, and encouraging but honest. Plain text only — short section headings on their own lines are fine, no markdown symbols. Keep it under 600 words.

Key things strong proposals have: a crisp synopsis; concrete, testable deliverables; a week-by-week timeline with buffer weeks; evidence of prior contact with the org (merged PRs, chat discussions); honest scoping; an "about me" tied to the project's needs. Common failure modes: vague timelines ("weeks 1-4: coding"), copy-pasted idea text, over-promising, no mention of community-bonding, ignoring the org's proposal template.`;

  const userContent =
    mode === "outline"
      ? `Program: ${program}\nTarget organization: ${org || "not specified"}\n\nProject idea the student wants to apply for:\n${idea}\n\nProduce a proposal OUTLINE for this student: the exact section structure they should write, with 2-3 bullet-style guidance sentences per section tailored to this specific idea, plus a realistic 12-week timeline skeleton they can adapt. End with the top 3 things they should do BEFORE submitting.`
      : `Program: ${program}\nTarget organization: ${org || "not specified"}\n\nThe student's draft proposal:\n${draft}\n\nReview this draft as an org mentor would. Give: (1) an overall impression in 2 sentences, (2) the 3-5 most important specific improvements, quoting or referencing the relevant part of the draft for each, (3) anything missing that programs expect, (4) one thing they did well. Be concrete — rewrite one weak sentence as an example.`;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return Response.json({ error: "unexpected" }, { status: 500 });
    return Response.json({ text });
  } catch {
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
