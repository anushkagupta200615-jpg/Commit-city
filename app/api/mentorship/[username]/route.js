import { fetchGitHubData } from "../../../../lib/github";
import { buildCityModel } from "../../../../lib/city";
import {
  matchPrograms,
  findStarterIssues,
  findSuggestedRepos,
} from "../../../../lib/programs";

// Mentorship matchmaking: GSoC / LFX orgs that fit the user's language
// districts, plus real good-first-issues they can try right now.

export async function GET(request, { params }) {
  const { username } = await params;

  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(username)) {
    return Response.json({ error: "invalid_username" }, { status: 400 });
  }

  try {
    const data = await fetchGitHubData(username);
    if (data.notFound) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const city = buildCityModel(data);
    const languages = city.analysis.districts.map((d) => d.name);

    const [programs, issues, suggestedRepos] = await Promise.all([
      matchPrograms(languages),
      findStarterIssues(languages),
      findSuggestedRepos(languages, city.analysis.topTopics),
    ]);

    return Response.json({
      languages,
      orgs: programs.orgs,
      liveGsoc: programs.liveGsoc,
      issues,
      suggestedRepos,
    });
  } catch (err) {
    if (err.message === "rate_limited") {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
