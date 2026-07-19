import { fetchGitHubData } from "../../../../lib/github";

// "Are you a good host?" — newcomer-friendliness of the user's top
// repos, via GitHub's community profile endpoint: README, LICENSE,
// CONTRIBUTING, code of conduct, templates, and good-first-issues.

const HOUR_MS = 60 * 60 * 1000;
const cache = new Map(); // username -> { at, data }

const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "commit-city-app",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

async function ghFetch(url) {
  const res = await fetch(url, {
    headers: GH_HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 403 || res.status === 429) throw new Error("rate_limited");
  if (!res.ok) throw new Error(`github_${res.status}`);
  return res.json();
}

export async function GET(request, { params }) {
  const { username } = await params;

  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(username)) {
    return Response.json({ error: "invalid_username" }, { status: 400 });
  }

  const key = username.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < HOUR_MS) return Response.json(hit.data);

  try {
    const data = await fetchGitHubData(username);
    if (data.notFound) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    // Audit the top 3 own repos by stars (skip the profile-README repo).
    const targets = data.repos
      .filter((r) => !r.fork && r.name.toLowerCase() !== username.toLowerCase())
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 3);

    const repos = [];
    for (const repo of targets) {
      try {
        const [profile, gfiJson] = await Promise.all([
          ghFetch(
            `https://api.github.com/repos/${data.user.login}/${repo.name}/community/profile`
          ),
          ghFetch(
            `https://api.github.com/search/issues?q=${encodeURIComponent(
              `repo:${data.user.login}/${repo.name} label:"good first issue" is:issue is:open`
            )}&per_page=1`
          ),
        ]);
        const f = profile.files || {};
        repos.push({
          name: repo.name,
          url: repo.url,
          stars: repo.stars,
          health: profile.health_percentage ?? 0,
          files: {
            readme: Boolean(f.readme),
            license: Boolean(f.license),
            contributing: Boolean(f.contributing),
            codeOfConduct: Boolean(f.code_of_conduct || f.code_of_conduct_file),
            issueTemplate: Boolean(f.issue_template),
            prTemplate: Boolean(f.pull_request_template),
          },
          description: Boolean(repo.description),
          goodFirstIssues: gfiJson.total_count ?? 0,
        });
      } catch (err) {
        if (err.message === "rate_limited") throw err;
      }
    }

    const result = { repos };
    cache.set(key, { at: Date.now(), data: result });
    return Response.json(result);
  } catch (err) {
    if (err.message === "rate_limited") {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
