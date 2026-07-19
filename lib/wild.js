// "In the wild" — a user's open-source footprint OUTSIDE their own
// repos: merged/unmerged PRs, code reviews, issues filed, and the
// language DNA of the projects they actually contribute to.

const HOUR_MS = 60 * 60 * 1000;
const cache = new Map(); // username -> { at, profile }

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

async function searchCount(q) {
  const json = await ghFetch(
    `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=1`
  );
  return json.total_count ?? 0;
}

export async function buildWildProfile(username) {
  const key = username.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < HOUR_MS) return hit.profile;

  const u = username;

  // Recent merged PRs to other people's repos (items for DNA analysis).
  const mergedJson = await ghFetch(
    `https://api.github.com/search/issues?q=${encodeURIComponent(
      `is:pr is:merged author:${u} -user:${u}`
    )}&per_page=100&sort=updated&order=desc`
  );
  const merged = mergedJson.total_count ?? 0;

  const [closedUnmerged, reviewed, extIssues] = await Promise.all([
    searchCount(`is:pr is:closed is:unmerged author:${u} -user:${u}`),
    searchCount(`is:pr reviewed-by:${u} -author:${u}`),
    searchCount(`is:issue author:${u} -user:${u}`),
  ]);

  // Which external repos do their merged PRs land in?
  const repoCounts = new Map();
  for (const it of mergedJson.items || []) {
    const full = it.repository_url.replace("https://api.github.com/repos/", "");
    repoCounts.set(full, (repoCounts.get(full) || 0) + 1);
  }
  const topRepoNames = [...repoCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Fetch metadata for the top external repos (language, stars, topics).
  const topRepos = [];
  for (const [full, prs] of topRepoNames) {
    try {
      const r = await ghFetch(`https://api.github.com/repos/${full}`);
      topRepos.push({
        name: full,
        prs,
        stars: r.stargazers_count,
        language: r.language,
        topics: (r.topics || []).slice(0, 4),
        url: r.html_url,
        description: r.description,
      });
    } catch (err) {
      if (err.message === "rate_limited") throw err;
      // repo may be deleted/private now — skip it
    }
  }

  // Language DNA of external contributions, weighted by PR count.
  const langCounts = new Map();
  let langTotal = 0;
  for (const r of topRepos) {
    if (!r.language) continue;
    langCounts.set(r.language, (langCounts.get(r.language) || 0) + r.prs);
    langTotal += r.prs;
  }
  const wildLanguages = [...langCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({
      name,
      count,
      pct: langTotal > 0 ? Math.round((count / langTotal) * 100) : 0,
    }));

  const decided = merged + closedUnmerged;
  const starsReached = topRepos.reduce((s, r) => s + r.stars, 0);

  const profile = {
    merged,
    closedUnmerged,
    reviewed,
    extIssues,
    acceptancePct: decided > 0 ? Math.round((merged / decided) * 100) : null,
    externalRepoCount: repoCounts.size,
    starsReached,
    topRepos,
    wildLanguages,
    sampleNote:
      merged > 100
        ? "Language DNA is based on your 100 most recent merged PRs."
        : null,
  };

  cache.set(key, { at: Date.now(), profile });
  return profile;
}
