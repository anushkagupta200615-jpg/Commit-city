import { geminiGenerate, hasGeminiKey } from "../../../lib/gemini";

// AI Proposal Coach — outlines a proposal from a project idea, or
// reviews a draft the way an experienced org mentor would.
// Powered by Google Gemini (free tier).

export async function POST(request) {
  if (!hasGeminiKey()) {
    return Response.json({ error: "no_key" }, { status: 501 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const mode = ["ideas", "outline", "review"].includes(body.mode)
    ? body.mode
    : "outline";
  const org = String(body.org || "").slice(0, 100);
  const skills = String(body.skills || "").slice(0, 300);
  const idea = String(body.idea || "").slice(0, 6000);
  const draft = String(body.draft || "").slice(0, 12000);
  const program = ["GSoC", "LFX", "Outreachy"].includes(body.program)
    ? body.program
    : "GSoC";

  if (mode === "ideas" && !org.trim() && !skills.trim()) {
    return Response.json({ error: "missing_input" }, { status: 400 });
  }
  if (mode === "outline" && !idea.trim()) {
    return Response.json({ error: "missing_idea" }, { status: 400 });
  }
  if (mode === "review" && !draft.trim()) {
    return Response.json({ error: "missing_draft" }, { status: 400 });
  }

  const system = `You are the Proposal Coach for Commit City, helping students apply to open-source mentorship programs (GSoC, LFX Mentorship, Outreachy). You have the perspective of an experienced org mentor who has read hundreds of proposals. Be specific, practical, and encouraging but honest. Keep it under 700 words.

Format your response in simple markdown: "## " for section headings, "- " for bullets, "**bold**" for key phrases, "1. " for ordered steps. No tables, no code blocks, no links in bare parentheses.

Key things strong proposals have: a crisp synopsis; concrete, testable deliverables; a week-by-week timeline with buffer weeks; evidence of prior contact with the org (merged PRs, chat discussions); honest scoping; an "about me" tied to the project's needs. Common failure modes: vague timelines ("weeks 1-4: coding"), copy-pasted idea text, over-promising, no mention of community-bonding, ignoring the org's proposal template.`;

  const prompts = {
    ideas: `Program: ${program}\nTarget organization: ${org || "not chosen yet — pick fitting, well-known ${program} organizations and NAME them"}\nStudent's skills: ${skills || "not specified"}\n\nSuggest 4 concrete project ideas this student could realistically propose. For each idea: a "## " heading with a crisp project title${org ? "" : " and the org it belongs to"}, then bullets covering: **what you'd build** (2 sentences), **why the org wants it**, **difficulty** (beginner-friendly / intermediate / ambitious), and **your first step this week** (something concrete like an issue to read or a doc to run). End with one short paragraph on how to validate an idea with mentors BEFORE writing a full proposal.`,
    outline: `Program: ${program}\nTarget organization: ${org || "not specified"}\n\nProject idea the student wants to apply for:\n${idea}\n\nProduce a proposal OUTLINE for this student: the exact section structure they should write ("## " per section), with 2-3 bullets of guidance per section tailored to this specific idea, plus a realistic 12-week timeline skeleton they can adapt. End with the top 3 things they should do BEFORE submitting.`,
    review: `Program: ${program}\nTarget organization: ${org || "not specified"}\n\nThe student's draft proposal:\n${draft}\n\nReview this draft as an org mentor would. Give: (1) an overall impression in 2 sentences, (2) the 3-5 most important specific improvements, quoting or referencing the relevant part of the draft for each, (3) anything missing that programs expect, (4) one thing they did well. Be concrete — rewrite one weak sentence as an example.`,
  };
  const user = prompts[mode];

  try {
    const text = await geminiGenerate({ system, user, maxTokens: 2048 });
    return Response.json({ text });
  } catch (err) {
    if (err.message === "rate_limited") {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
