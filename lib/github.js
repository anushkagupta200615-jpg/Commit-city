// GitHub data fetching with a simple in-memory TTL cache.
// No auth token required; unauthenticated GitHub API allows 60 req/hr,
// so responses are cached for an hour per username.

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map();

function getCached(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  return null;
}

function setCached(key, value) {
  cache.set(key, { at: Date.now(), value });
}

const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "commit-city-app",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

async function ghJson(url) {
  const res = await fetch(url, { headers: GH_HEADERS });
  if (res.status === 404) return { notFound: true };
  if (res.status === 403 || res.status === 429) {
    throw new Error("rate_limited");
  }
  if (!res.ok) throw new Error(`github_error_${res.status}`);
  return res.json();
}

export async function fetchGitHubData(username) {
  const key = username.toLowerCase();
  const cached = getCached(key);
  if (cached) return cached;

  const [user, repos, contributions] = await Promise.all([
    ghJson(`https://api.github.com/users/${encodeURIComponent(username)}`),
    ghJson(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=pushed`
    ),
    fetchContributions(username),
  ]);

  if (user.notFound) return { notFound: true };

  const data = {
    user: {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      blog: user.blog,
      followers: user.followers,
      publicRepos: user.public_repos,
      createdAt: user.created_at,
    },
    repos: Array.isArray(repos)
      ? repos.map((r) => ({
          name: r.name,
          description: r.description,
          fork: r.fork,
          stars: r.stargazers_count,
          forks: r.forks_count,
          language: r.language,
          pushedAt: r.pushed_at,
          createdAt: r.created_at,
          url: r.html_url,
        }))
      : [],
    contributions,
  };

  setCached(key, data);
  return data;
}

// The public github-contributions API mirrors the contribution graph
// without needing a GitHub token. Returns the all-time total, a
// per-year breakdown, and a per-day list for streak/records analysis.
async function fetchContributions(username) {
  const res = await fetch(
    `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}`,
    { headers: { "User-Agent": "commit-city-app" } }
  );
  if (!res.ok) return { total: 0, years: {}, days: [] };
  const json = await res.json();
  const years = json.total || {};
  const total = Object.values(years).reduce((a, b) => a + b, 0);
  return { total, years, days: json.contributions || [] };
}
