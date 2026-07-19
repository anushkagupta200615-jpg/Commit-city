// Mentorship program matching: GSoC (live API with fallback), LFX and
// evergreen orgs (curated), plus real "good first issue" search on GitHub —
// all matched against the user's language districts.

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const gsocCache = { at: 0, orgs: null };
const issueCache = new Map(); // language -> {at, issues}

const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "commit-city-app",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

// Curated, well-known mentorship orgs. `issues` links go to each org's
// live good-first-issue board on GitHub.
const CURATED_ORGS = [
  { name: "Kubernetes (CNCF)", program: "LFX", tech: ["go"], description: "Container orchestration — the heart of cloud native.", site: "https://mentorship.lfx.linuxfoundation.org/", repo: "https://github.com/kubernetes/kubernetes", issues: gfi("kubernetes") },
  { name: "CNCF Projects", program: "LFX", tech: ["go", "rust", "c"], description: "Prometheus, Envoy, etcd and dozens more cloud-native projects.", site: "https://mentorship.lfx.linuxfoundation.org/", repo: "https://github.com/cncf", issues: gfi("cncf") },
  { name: "Hyperledger", program: "LFX", tech: ["go", "javascript", "typescript", "java"], description: "Enterprise blockchain tooling under the Linux Foundation.", site: "https://mentorship.lfx.linuxfoundation.org/", repo: "https://github.com/hyperledger", issues: gfi("hyperledger") },
  { name: "Node.js", program: "LFX", tech: ["javascript", "typescript", "c++"], description: "The JavaScript runtime itself — undici, core, tooling.", site: "https://mentorship.lfx.linuxfoundation.org/", repo: "https://github.com/nodejs/node", issues: gfi("nodejs") },
  { name: "Python Software Foundation", program: "GSoC", tech: ["python", "c"], description: "CPython and the wider Python ecosystem.", site: "https://python-gsoc.org/", repo: "https://github.com/python", issues: gfi("python") },
  { name: "Django", program: "GSoC", tech: ["python"], description: "The web framework for perfectionists with deadlines.", site: "https://www.djangoproject.com/", repo: "https://github.com/django/django", issues: gfi("django") },
  { name: "Zulip", program: "GSoC", tech: ["python", "typescript", "javascript"], description: "Open-source team chat, famously newcomer-friendly.", site: "https://zulip.org/", repo: "https://github.com/zulip/zulip", issues: gfi("zulip") },
  { name: "GNOME", program: "GSoC", tech: ["c", "rust", "javascript"], description: "The Linux desktop environment.", site: "https://gsoc.gnome.org/", repo: "https://github.com/GNOME", issues: gfi("GNOME") },
  { name: "KDE", program: "GSoC", tech: ["c++", "qml"], description: "Plasma desktop, Krita, and hundreds of Qt apps.", site: "https://community.kde.org/GSoC", repo: "https://github.com/KDE", issues: gfi("KDE") },
  { name: "VideoLAN (VLC)", program: "GSoC", tech: ["c", "c++"], description: "The media player that plays everything.", site: "https://www.videolan.org/", repo: "https://github.com/videolan/vlc", issues: gfi("videolan") },
  { name: "LLVM", program: "GSoC", tech: ["c++"], description: "The compiler infrastructure behind Clang, Rust and Swift.", site: "https://llvm.org/OpenProjects.html", repo: "https://github.com/llvm/llvm-project", issues: gfi("llvm") },
  { name: "PostgreSQL", program: "GSoC", tech: ["c"], description: "The world's most advanced open-source database.", site: "https://wiki.postgresql.org/wiki/GSoC", repo: "https://github.com/postgres/postgres", issues: "https://wiki.postgresql.org/wiki/Todo" },
  { name: "Git", program: "GSoC", tech: ["c", "shell"], description: "The version control system itself.", site: "https://git.github.io/SoC/", repo: "https://github.com/git/git", issues: gfi("git") },
  { name: "Apache Software Foundation", program: "GSoC", tech: ["java", "python", "c++"], description: "Kafka, Airflow, Spark and 300+ projects.", site: "https://community.apache.org/gsoc/", repo: "https://github.com/apache", issues: gfi("apache") },
  { name: "Jenkins", program: "GSoC", tech: ["java", "typescript"], description: "The leading open-source automation server.", site: "https://www.jenkins.io/projects/gsoc/", repo: "https://github.com/jenkinsci/jenkins", issues: gfi("jenkinsci") },
  { name: "OpenCV", program: "GSoC", tech: ["c++", "python"], description: "The computer-vision library used everywhere.", site: "https://opencv.org/", repo: "https://github.com/opencv/opencv", issues: gfi("opencv") },
  { name: "Godot Engine", program: "GSoC", tech: ["c++", "gdscript"], description: "The free, community-driven game engine.", site: "https://godotengine.org/", repo: "https://github.com/godotengine/godot", issues: gfi("godotengine") },
  { name: "Blender", program: "GSoC", tech: ["c", "c++", "python"], description: "3D creation for everyone.", site: "https://wiki.blender.org/wiki/GSoC", repo: "https://github.com/blender/blender", issues: "https://projects.blender.org/blender/blender/issues?labels=302" },
  { name: "Wikimedia Foundation", program: "GSoC", tech: ["php", "javascript", "python"], description: "The software behind Wikipedia.", site: "https://www.mediawiki.org/wiki/Google_Summer_of_Code", repo: "https://github.com/wikimedia", issues: gfi("wikimedia") },
  { name: "Rust Foundation projects", program: "GSoC", tech: ["rust"], description: "The Rust compiler, cargo and ecosystem tools.", site: "https://summerofcode.withgoogle.com/", repo: "https://github.com/rust-lang/rust", issues: "https://github.com/rust-lang/rust/issues?q=is%3Aissue+is%3Aopen+label%3AE-easy" },
  { name: "Swift.org", program: "GSoC", tech: ["swift", "c++"], description: "The Swift language and its libraries.", site: "https://www.swift.org/gsoc/", repo: "https://github.com/swiftlang/swift", issues: gfi("swiftlang") },
  { name: "Kotlin Foundation", program: "GSoC", tech: ["kotlin", "java"], description: "The Kotlin compiler and ecosystem.", site: "https://kotlinfoundation.org/", repo: "https://github.com/JetBrains/kotlin", issues: gfi("JetBrains") },
  { name: "Ruby / Rails community", program: "GSoC", tech: ["ruby"], description: "Ruby tooling and the Rails ecosystem.", site: "https://summerofcode.withgoogle.com/", repo: "https://github.com/rails/rails", issues: gfi("rails") },
  { name: "Julia Language", program: "GSoC", tech: ["julia", "c"], description: "High-performance scientific computing.", site: "https://julialang.org/jsoc/", repo: "https://github.com/JuliaLang/julia", issues: gfi("JuliaLang") },
];

function gfi(org) {
  return `https://github.com/search?q=org%3A${org}+label%3A%22good+first+issue%22+state%3Aopen&type=issues`;
}

// Try Google's public GSoC API for the freshest org list; fall back silently.
async function fetchGsocOrgs() {
  if (gsocCache.orgs && Date.now() - gsocCache.at < DAY_MS) return gsocCache.orgs;

  const year = new Date().getFullYear();
  for (const y of [year, year - 1]) {
    try {
      const res = await fetch(
        `https://summerofcode.withgoogle.com/api/program/${y}/organizations/`,
        { headers: { "User-Agent": "commit-city-app" }, signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) continue;
      const json = await res.json();
      const list = Array.isArray(json) ? json : json.results;
      if (!Array.isArray(list) || list.length === 0) continue;
      const orgs = list.map((o) => ({
        name: o.name,
        program: `GSoC ${y}`,
        tech: (o.tech_tags || o.technologies || []).map((t) => String(t).toLowerCase()),
        description: (o.tagline || o.description || "").slice(0, 140),
        site: o.website_url || o.contact_links?.[0]?.value || "",
        repo: o.source_code || o.website_url || "",
        issues: o.ideas_link || o.ideas_list || "",
      }));
      gsocCache.at = Date.now();
      gsocCache.orgs = orgs;
      return orgs;
    } catch {}
  }
  gsocCache.at = Date.now();
  gsocCache.orgs = null;
  return null;
}

function normalizeLang(l) {
  const s = l.toLowerCase();
  if (s === "c++" || s === "cpp") return "c++";
  return s;
}

function techMatches(tech, lang) {
  // handle tags like "c/c++", "javascript/typescript", "python 3"
  return tech.some((t) => {
    const parts = String(t).toLowerCase().split(/[\/,\s]+/);
    return parts.includes(lang) || String(t).toLowerCase() === lang;
  });
}

export async function matchPrograms(languages) {
  const langs = languages.map(normalizeLang);
  const live = await fetchGsocOrgs();
  const pool = [
    ...(live || []),
    ...CURATED_ORGS.filter(
      (c) => !live || !live.some((o) => o.name.toLowerCase() === c.name.toLowerCase())
    ),
  ];

  const scored = pool
    .map((org) => {
      const matched = langs.filter((l) =>
        techMatches(org.tech.map(String), l)
      );
      return { ...org, matched, score: matched.length };
    })
    .filter((o) => o.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // current-year (live) GSoC orgs outrank curated evergreens
      const liveA = /\d{4}/.test(a.program) ? 1 : 0;
      const liveB = /\d{4}/.test(b.program) ? 1 : 0;
      return liveB - liveA;
    });

  // If nothing matched (rare stacks), fall back to broadly popular orgs.
  const picks = scored.length > 0 ? scored : CURATED_ORGS.map((o) => ({ ...o, matched: [] }));
  return { orgs: picks.slice(0, 8), liveGsoc: Boolean(live) };
}

// Real, open, unassigned good-first-issues in a language — cached 1h.
export async function findStarterIssues(languages) {
  const langs = languages.slice(0, 2);
  const results = [];
  for (const lang of langs) {
    const key = lang.toLowerCase();
    const hit = issueCache.get(key);
    if (hit && Date.now() - hit.at < HOUR_MS) {
      results.push(...hit.issues);
      continue;
    }
    try {
      const q = encodeURIComponent(
        `label:"good first issue" language:"${lang}" state:open no:assignee is:issue`
      );
      const res = await fetch(
        `https://api.github.com/search/issues?q=${q}&sort=updated&order=desc&per_page=6`,
        { headers: GH_HEADERS, signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;
      const json = await res.json();
      const issues = (json.items || []).map((it) => {
        const repoPath = it.repository_url.replace(
          "https://api.github.com/repos/",
          ""
        );
        return {
          title: it.title,
          url: it.html_url,
          repo: repoPath,
          repoUrl: `https://github.com/${repoPath}`,
          language: lang,
          comments: it.comments,
        };
      });
      issueCache.set(key, { at: Date.now(), issues });
      results.push(...issues);
    } catch {}
  }
  // interleave languages, cap at 8
  return results.slice(0, 8);
}
