import { fetchGitHubData } from "../../../../lib/github";
import { buildCityModel } from "../../../../lib/city";

// Application readiness: scores the signals mentors actually look at
// when picking GSoC/LFX/Outreachy applicants, with concrete advice.

const HOUR_MS = 60 * 60 * 1000;
const prCache = new Map(); // username -> { at, merged, topOrgs }

const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "commit-city-app",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

// Merged PRs to repos the user doesn't own — the strongest signal.
async function externalMergedPRs(username) {
  const key = username.toLowerCase();
  const hit = prCache.get(key);
  if (hit && Date.now() - hit.at < HOUR_MS) return hit;

  const q = `is:pr is:merged author:${username} -user:${username}`;
  const res = await fetch(
    `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=30&sort=updated`,
    { headers: GH_HEADERS, signal: AbortSignal.timeout(8000) }
  );
  if (res.status === 403 || res.status === 429) throw new Error("rate_limited");
  if (!res.ok) throw new Error("search_failed");
  const json = await res.json();

  const orgCounts = new Map();
  for (const it of json.items || []) {
    const owner = it.repository_url
      .replace("https://api.github.com/repos/", "")
      .split("/")[0];
    orgCounts.set(owner, (orgCounts.get(owner) || 0) + 1);
  }
  const result = {
    at: Date.now(),
    merged: json.total_count ?? 0,
    topOrgs: [...orgCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([org, count]) => ({ org, count })),
  };
  prCache.set(key, result);
  return result;
}

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
    const a = city.analysis;
    const external = await externalMergedPRs(username);

    const login = data.user.login.toLowerCase();
    const ownRepos = data.repos.filter((r) => !r.fork);
    const hasProfileReadme = ownRepos.some(
      (r) => r.name.toLowerCase() === login
    );
    const describedPct =
      ownRepos.length === 0
        ? 0
        : ownRepos.filter((r) => r.description).length / ownRepos.length;

    const checks = [];
    const add = (points, earned, label, advice) => {
      checks.push({
        label,
        points,
        earned: Math.round(earned),
        state: earned >= points ? "done" : earned > 0 ? "partial" : "todo",
        advice,
      });
    };

    add(
      30,
      external.merged >= 6 ? 30 : external.merged * 5,
      `Merged PRs to other people's repos (${external.merged})`,
      "The #1 signal. Aim for 3+ merged PRs to your target org — docs and small fixes count."
    );
    add(
      20,
      Math.min(20, (city.last30 / 20) * 20),
      `Active in the last 30 days (${city.last30} contributions)`,
      "Mentors check recent activity. Small daily commits beat a burst next month."
    );
    add(
      15,
      Math.min(15, (a.activeDaysLastYear / 120) * 15),
      `Consistency this year (${a.activeDaysLastYear} active days)`,
      "A steady rhythm reads as reliability — the trait mentors select for."
    );
    add(
      10,
      hasProfileReadme ? 10 : 0,
      hasProfileReadme ? "Profile README present" : "No profile README",
      `Create a repo named "${data.user.login}/${data.user.login}" with a README introducing yourself and your interests.`
    );
    add(
      10,
      describedPct * 10,
      `Repo descriptions (${Math.round(describedPct * 100)}% of projects)`,
      "One sentence per repo helps mentors skim who you are in 30 seconds."
    );
    add(
      10,
      Math.min(10, a.activeRepos * 4),
      `Actively maintained projects (${a.activeRepos} pushed in 90 days)`,
      "A couple of living projects show you finish what you start."
    );
    add(
      5,
      data.user.bio ? 5 : 0,
      data.user.bio ? "Bio filled in" : "No bio",
      "A one-line bio with your stack and interests completes the picture."
    );

    const score = checks.reduce((s, c) => s + c.earned, 0);

    return Response.json({
      score,
      checks,
      externalMerged: external.merged,
      topOrgs: external.topOrgs,
      verdict:
        score >= 75
          ? "Application-ready — focus on your target org and proposal."
          : score >= 45
            ? "Solid foundation — a few merged external PRs would change everything."
            : "Early days — start with one good-first-issue this week.",
    });
  } catch (err) {
    if (err.message === "rate_limited") {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
