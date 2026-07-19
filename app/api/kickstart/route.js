import { geminiGenerate, hasGeminiKey } from "../../../lib/gemini";

// "Help me start" — a beginner's attack plan for a specific
// good-first-issue: what it's asking, setup, steps, and a polite
// ready-to-post comment to claim it. Powered by Gemini (free tier).

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

  const title = String(body.title || "").slice(0, 300);
  const repo = String(body.repo || "").slice(0, 140);
  const language = String(body.language || "").slice(0, 40);
  const url = String(body.url || "").slice(0, 300);

  if (!title.trim() || !repo.trim()) {
    return Response.json({ error: "missing_input" }, { status: 400 });
  }

  const system = `You are the First-Contribution Guide for Commit City, helping a beginner make their very first contribution to an open-source repository. Be practical, concrete and encouraging — assume they have git and an editor but have never contributed to this project. Keep it under 450 words.

Format in simple markdown: "## " for section headings, "- " for bullets, "**bold**" for key phrases, "1. " for ordered steps. No tables, no code blocks.`;

  const user = `Issue title: "${title}"
Repository: ${repo}${language ? ` (primary language: ${language})` : ""}
Issue link: ${url}

The student wants to make this their first contribution to this repository. Produce:

## What this issue is really asking
2-3 sentences inferring the actual work from the title and what you know of this repository.

## Getting set up
Concrete steps: fork and clone ${repo}, where to look for CONTRIBUTING.md / dev setup docs in this specific project, and how to verify the setup works before touching anything.

## Plan of attack
3-5 ordered steps from "find the relevant code" to "open the PR".

## Claiming it politely
Include a short ready-to-post comment (in quotation marks) that asks to work on the issue and asks ONE smart clarifying question about it.

## Etiquette
2-3 bullets on first-contribution etiquette in this kind of project.`;

  try {
    const text = await geminiGenerate({ system, user, maxTokens: 1200 });
    return Response.json({ text });
  } catch (err) {
    if (err.message === "rate_limited") {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
