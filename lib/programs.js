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
  { name: "GNOME (Outreachy)", program: "Outreachy", tech: ["c", "rust", "javascript", "python"], description: "A founding Outreachy community — desktop apps and platform libraries.", site: "https://www.outreachy.org/apply/", repo: "https://github.com/GNOME", issues: gfi("GNOME"), competition: "medium" },
  { name: "Wikimedia (Outreachy)", program: "Outreachy", tech: ["php", "javascript", "python"], description: "Wikipedia's stack — a long-running Outreachy participant.", site: "https://www.outreachy.org/apply/", repo: "https://github.com/wikimedia", issues: gfi("wikimedia"), competition: "medium" },
  { name: "Debian (Outreachy)", program: "Outreachy", tech: ["python", "c", "shell"], description: "The universal operating system — packaging, tooling, infrastructure.", site: "https://www.outreachy.org/apply/", repo: "https://github.com/debian", issues: "https://wiki.debian.org/Outreachy", competition: "low" },
  { name: "Fedora Project (Outreachy)", program: "Outreachy", tech: ["python", "go", "shell"], description: "Red Hat's community distro — infra, websites and tooling projects.", site: "https://www.outreachy.org/apply/", repo: "https://github.com/fedora-infra", issues: gfi("fedora-infra"), competition: "low" },
  { name: "Ceph (Outreachy + GSoC)", program: "Outreachy", tech: ["c++", "python"], description: "Distributed storage at scale — regularly mentors via Outreachy and GSoC.", site: "https://www.outreachy.org/apply/", repo: "https://github.com/ceph/ceph", issues: gfi("ceph"), competition: "low" },
  { name: "Linux Kernel (Outreachy)", program: "Outreachy", tech: ["c"], description: "Kernel internships — famously rigorous, famously career-making.", site: "https://www.outreachy.org/apply/", repo: "https://github.com/torvalds/linux", issues: "https://kernelnewbies.org/FirstKernelPatch", competition: "high" },
  { name: "Kubernetes (CNCF)", program: "LFX", tech: ["go"], description: "Container orchestration — the heart of cloud native.", site: "https://mentorship.lfx.linuxfoundation.org/", repo: "https://github.com/kubernetes/kubernetes", issues: gfi("kubernetes"), competition: "high" },
  { name: "CNCF Projects", program: "LFX", tech: ["go", "rust", "c"], description: "Prometheus, Envoy, etcd and dozens more cloud-native projects.", site: "https://mentorship.lfx.linuxfoundation.org/", repo: "https://github.com/cncf", issues: gfi("cncf") },
  { name: "Hyperledger", program: "LFX", tech: ["go", "javascript", "typescript", "java"], description: "Enterprise blockchain tooling under the Linux Foundation.", site: "https://mentorship.lfx.linuxfoundation.org/", repo: "https://github.com/hyperledger", issues: gfi("hyperledger") },
  { name: "Node.js", program: "LFX", tech: ["javascript", "typescript", "c++"], description: "The JavaScript runtime itself — undici, core, tooling.", site: "https://mentorship.lfx.linuxfoundation.org/", repo: "https://github.com/nodejs/node", issues: gfi("nodejs") },
  { name: "Python Software Foundation", program: "GSoC", tech: ["python", "c"], description: "CPython and the wider Python ecosystem.", site: "https://python-gsoc.org/", repo: "https://github.com/python", issues: gfi("python") },
  { name: "Django", program: "GSoC", tech: ["python"], description: "The web framework for perfectionists with deadlines.", site: "https://www.djangoproject.com/", repo: "https://github.com/django/django", issues: gfi("django") },
  { name: "Zulip", program: "GSoC", tech: ["python", "typescript", "javascript"], description: "Open-source team chat, famously newcomer-friendly.", site: "https://zulip.org/", repo: "https://github.com/zulip/zulip", issues: gfi("zulip"), competition: "high" },
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

// ---- full directory rosters (browse page) ----
// LFX runs per-term project listings on its own site; these are its
// big recurring communities. Outreachy publishes exact project lists
// only during each cohort's contribution period; these are communities
// that participate year after year.

const LFX_DIRECTORY = [
  { name: "Kubernetes", tech: ["go"], description: "Container orchestration — dozens of SIGs mentor every term.", repo: "https://github.com/kubernetes", issues: gfi("kubernetes") },
  { name: "CNCF (umbrella)", tech: ["go", "rust", "c"], description: "Prometheus, Envoy, etcd, Falco and many more cloud-native projects.", repo: "https://github.com/cncf", issues: gfi("cncf") },
  { name: "Hyperledger", tech: ["go", "javascript", "typescript", "java"], description: "Enterprise blockchain: Fabric, Besu, Indy, Aries.", repo: "https://github.com/hyperledger", issues: gfi("hyperledger") },
  { name: "Node.js", tech: ["javascript", "typescript", "c++"], description: "The JavaScript runtime — core, undici, tooling.", repo: "https://github.com/nodejs", issues: gfi("nodejs") },
  { name: "OpenSearch", tech: ["java", "typescript"], description: "Search and analytics suite forked from Elasticsearch.", repo: "https://github.com/opensearch-project", issues: gfi("opensearch-project") },
  { name: "The Linux Kernel (LF)", tech: ["c"], description: "Kernel mentorship series — bug fixing and subsystems.", repo: "https://github.com/torvalds/linux", issues: "https://kernelnewbies.org/FirstKernelPatch" },
  { name: "ONAP", tech: ["java", "python"], description: "Open network automation platform for telecoms.", repo: "https://github.com/onap", issues: gfi("onap") },
  { name: "Zephyr RTOS", tech: ["c"], description: "Real-time OS for embedded and IoT devices.", repo: "https://github.com/zephyrproject-rtos", issues: gfi("zephyrproject-rtos") },
  { name: "RISC-V International", tech: ["c", "c++", "assembly"], description: "Open instruction-set architecture tooling and ports.", repo: "https://github.com/riscv", issues: gfi("riscv") },
  { name: "Open Mainframe Project", tech: ["cobol", "java", "javascript"], description: "Zowe, COBOL programming, mainframe open source.", repo: "https://github.com/openmainframeproject", issues: gfi("openmainframeproject") },
  { name: "LF Energy", tech: ["python", "java"], description: "Open source for the energy transition (OpenSTEF, SOGNO).", repo: "https://github.com/lf-energy", issues: gfi("lf-energy") },
  { name: "OpenTelemetry", tech: ["go", "java", "python", "javascript"], description: "Observability APIs, SDKs and collectors.", repo: "https://github.com/open-telemetry", issues: gfi("open-telemetry") },
  { name: "Jenkins (via LFX terms)", tech: ["java", "typescript"], description: "CI/CD automation server and its plugin ecosystem.", repo: "https://github.com/jenkinsci", issues: gfi("jenkinsci") },
  { name: "Cloud Foundry", tech: ["go", "ruby"], description: "Application platform-as-a-service tooling.", repo: "https://github.com/cloudfoundry", issues: gfi("cloudfoundry") },
].map((o) => ({
  ...o,
  program: "LFX",
  site: "https://mentorship.lfx.linuxfoundation.org/",
}));

const OUTREACHY_DIRECTORY = [
  { name: "GNOME", tech: ["c", "rust", "javascript", "python"], description: "A founding Outreachy community — desktop apps and platform libraries.", repo: "https://github.com/GNOME", issues: gfi("GNOME") },
  { name: "Wikimedia", tech: ["php", "javascript", "python"], description: "Wikipedia's stack — MediaWiki, bots, data tooling.", repo: "https://github.com/wikimedia", issues: gfi("wikimedia") },
  { name: "Debian", tech: ["python", "c", "shell"], description: "The universal operating system — packaging and infra.", repo: "https://github.com/debian", issues: "https://wiki.debian.org/Outreachy" },
  { name: "Fedora Project", tech: ["python", "go", "shell"], description: "Red Hat's community distro — websites, infra, tooling.", repo: "https://github.com/fedora-infra", issues: gfi("fedora-infra") },
  { name: "Ceph", tech: ["c++", "python"], description: "Distributed storage at scale.", repo: "https://github.com/ceph", issues: gfi("ceph") },
  { name: "Linux Kernel", tech: ["c"], description: "Kernel internships — rigorous and career-making.", repo: "https://github.com/torvalds/linux", issues: "https://kernelnewbies.org/FirstKernelPatch" },
  { name: "Mozilla", tech: ["rust", "javascript", "c++"], description: "Firefox and the open web platform.", repo: "https://github.com/mozilla", issues: gfi("mozilla") },
  { name: "OpenStack", tech: ["python"], description: "Open cloud infrastructure — a long-running Outreachy host.", repo: "https://github.com/openstack", issues: gfi("openstack") },
  { name: "Apache Software Foundation", tech: ["java", "python"], description: "Selected ASF projects mentor via Outreachy cohorts.", repo: "https://github.com/apache", issues: gfi("apache") },
  { name: "Mifos Initiative", tech: ["java", "kotlin", "typescript"], description: "Open banking for financial inclusion.", repo: "https://github.com/openMF", issues: gfi("openMF") },
  { name: "Public Lab", tech: ["ruby", "javascript"], description: "Community science tools — famously newcomer-friendly.", repo: "https://github.com/publiclab", issues: gfi("publiclab") },
  { name: "Ushahidi", tech: ["php", "javascript"], description: "Crisis-mapping and civic tech platform.", repo: "https://github.com/ushahidi", issues: gfi("ushahidi") },
].map((o) => ({
  ...o,
  program: "Outreachy",
  site: "https://www.outreachy.org/apply/",
}));

// ---- entry-difficulty estimate ----
// No program publishes an official difficulty, so this is an honest
// heuristic: systems-level stacks and domains raise the bar, scripting/
// web stacks and education-focused orgs lower it, with hand-tuned
// overrides for well-known communities. Surfaced in the UI as an
// estimate, not a fact.

const LEVEL_OVERRIDES = [
  ["linux kernel", "tough"],
  ["llvm", "tough"],
  ["qemu", "tough"],
  ["gcc", "tough"],
  ["postgresql", "tough"],
  ["videolan", "tough"],
  ["blender", "tough"],
  ["ceph", "tough"],
  ["cern", "tough"],
  ["zephyr", "tough"],
  ["risc-v", "tough"],
  ["ffmpeg", "tough"],
  ["git", "tough"],
  ["swift.org", "tough"],
  ["kotlin foundation", "tough"],
  ["rust foundation", "tough"],
  ["zulip", "beginner"],
  ["public lab", "beginner"],
  ["fossasia", "beginner"],
  ["mifos", "beginner"],
  ["ushahidi", "beginner"],
  ["sugar labs", "beginner"],
  ["oppia", "beginner"],
  ["processing foundation", "beginner"],
  ["palisadoes", "beginner"],
  ["score lab", "beginner"],
];

const HARD_TECH = new Set([
  "c", "c++", "cpp", "rust", "assembly", "fortran", "cuda", "haskell",
  "ocaml", "verilog", "vhdl", "zig", "erlang",
]);
const EASY_TECH = new Set([
  "python", "javascript", "typescript", "html", "css", "ruby", "php",
  "dart", "flutter", "markdown",
]);
const HARD_WORDS = [
  "kernel", "compiler", "operating system", "virtualization", "emulat",
  "firmware", "embedded", "rtos", "cryptograph", "hpc", "gpu", "driver",
  "low-level", "formal", "theorem", "physics", "genomic", "bioinformatic",
  "distributed systems", "database engine", "hypervisor",
];
const EASY_WORDS = [
  "documentation", "education", "beginner", "newcomer", "web app",
  "website", "community", "non-profit", "nonprofit", "charity",
  "humanitarian", "civic", "accessibility", "learning",
];

export function classifyLevel(org) {
  const name = (org.name || "").toLowerCase();
  for (const [key, lvl] of LEVEL_OVERRIDES) {
    if (name.includes(key)) return lvl;
  }
  const tech = (org.tech || []).map((t) => String(t).toLowerCase());
  const text = [name, org.description || "", ...(org.topics || [])]
    .join(" ")
    .toLowerCase();

  let hard = 0;
  let easy = 0;
  for (const t of tech) {
    if (HARD_TECH.has(t)) hard += 2;
    if (EASY_TECH.has(t)) easy += 2;
  }
  for (const w of HARD_WORDS) if (text.includes(w)) hard += 2;
  for (const w of EASY_WORDS) if (text.includes(w)) easy += 2;

  const diff = hard - easy;
  if (diff >= 3) return "tough";
  if (diff <= -2) return "beginner";
  return "intermediate";
}

function withLevel(list) {
  return list.map((o) => ({ ...o, level: classifyLevel(o) }));
}

// Full browsable directory: live GSoC list + curated LFX/Outreachy.
export async function getDirectory() {
  const live = await fetchGsocOrgs();
  const gsoc =
    live && live.length > 0
      ? live
      : CURATED_ORGS.filter((o) => o.program === "GSoC");
  return {
    gsoc: withLevel(gsoc),
    lfx: withLevel(LFX_DIRECTORY),
    outreachy: withLevel(OUTREACHY_DIRECTORY),
    liveGsoc: Boolean(live && live.length > 0),
  };
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
        topics: (o.topic_tags || []).map((t) => String(t).toLowerCase()),
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
      return { ...org, matched, score: matched.length, level: classifyLevel(org) };
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
// Prefers low-competition issues (few comments, recently filed); falls
// back to a broader query when the strict one comes up dry.
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
      const since = new Date(Date.now() - 120 * 86400000)
        .toISOString()
        .slice(0, 10);
      const strict = `label:"good first issue" language:"${lang}" state:open no:assignee is:issue comments:<4 created:>=${since}`;
      const broad = `label:"good first issue" language:"${lang}" state:open no:assignee is:issue`;

      let issues = await searchIssues(strict, lang);
      if (issues.length < 3) issues = await searchIssues(broad, lang);

      issueCache.set(key, { at: Date.now(), issues });
      results.push(...issues);
    } catch {}
  }
  return results.slice(0, 8);
}

async function searchIssues(q, lang) {
  const res = await fetch(
    `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=6`,
    { headers: GH_HEADERS, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json.items || []).map((it) => {
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
}

// Actively-maintained repos in the user's languages/topics that are
// explicitly recruiting first-timers (good-first-issues:>N). Cached 1h.
const repoSuggestCache = new Map();

export async function findSuggestedRepos(languages, topics = []) {
  const queries = [];
  for (const lang of languages.slice(0, 2)) {
    queries.push({
      key: `lang:${lang.toLowerCase()}`,
      q: `language:"${lang}" good-first-issues:>2 stars:>100 pushed:>${recentDate(90)} archived:false`,
    });
  }
  if (topics[0]) {
    queries.push({
      key: `topic:${topics[0].toLowerCase()}`,
      q: `topic:${topics[0]} good-first-issues:>1 stars:>30 pushed:>${recentDate(90)} archived:false`,
    });
  }

  const seen = new Set();
  const results = [];
  for (const { key, q } of queries) {
    const hit = repoSuggestCache.get(key);
    let repos = hit && Date.now() - hit.at < HOUR_MS ? hit.repos : null;
    if (!repos) {
      try {
        const res = await fetch(
          `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=4`,
          { headers: GH_HEADERS, signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) continue;
        const json = await res.json();
        repos = (json.items || []).map((r) => ({
          name: r.full_name,
          url: r.html_url,
          stars: r.stargazers_count,
          language: r.language,
          topics: (r.topics || []).slice(0, 3),
          description: r.description ? r.description.slice(0, 110) : null,
          gfiUrl: `${r.html_url}/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22`,
        }));
        repoSuggestCache.set(key, { at: Date.now(), repos });
      } catch {
        continue;
      }
    }
    for (const r of repos) {
      if (seen.has(r.name)) continue;
      seen.add(r.name);
      results.push(r);
    }
  }
  return results.slice(0, 6);
}

function recentDate(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}
