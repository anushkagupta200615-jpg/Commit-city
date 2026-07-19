// Bridge building: how many PRs has this user opened/merged into each
// of their target orgs? Every merged PR is a girder on the bridge.

const HOUR_MS = 60 * 60 * 1000;
const cache = new Map(); // `${user}:${org}` -> { at, data }

const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "commit-city-app",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

async function searchCount(q) {
  const res = await fetch(
    `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=1`,
    { headers: GH_HEADERS, signal: AbortSignal.timeout(8000) }
  );
  if (res.status === 403 || res.status === 429) throw new Error("rate_limited");
  if (!res.ok) throw new Error("search_failed");
  const json = await res.json();
  return json.total_count ?? 0;
}

async function bridgeFor(username, org) {
  const key = `${username.toLowerCase()}:${org.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < HOUR_MS / 2) return hit.data;

  const [merged, open] = await Promise.all([
    searchCount(`is:pr is:merged author:${username} org:${org}`),
    searchCount(`is:pr is:open author:${username} org:${org}`),
  ]);

  const data = {
    org,
    merged,
    open,
    orgUrl: `https://github.com/${org}`,
    issuesUrl: `https://github.com/search?q=org%3A${org}+label%3A%22good+first+issue%22+state%3Aopen&type=issues`,
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}

export async function GET(request, { params }) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const orgs = (searchParams.get("orgs") || "")
    .split(",")
    .map((o) => o.trim())
    .filter((o) => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(o))
    .slice(0, 4);

  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(username) || orgs.length === 0) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const bridges = [];
    for (const org of orgs) {
      bridges.push(await bridgeFor(username, org));
    }
    return Response.json({ bridges });
  } catch (err) {
    if (err.message === "rate_limited") {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
