"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import CityScene from "../../../components/CityScene";
import RichText from "../../../components/RichText";

const ERRORS = {
  not_found: "No city found under that GitHub username — maybe a small typo?",
  rate_limited:
    "GitHub is asking us to slow down for a bit. Please try again in a few minutes.",
  invalid_username: "That doesn't look like a valid GitHub username.",
  unexpected: "Something went sideways on our end. Please try again.",
};

export default function CityPage() {
  const { username } = useParams();
  const [state, setState] = useState({ status: "loading" });
  const [year, setYear] = useState(null); // null = present day
  const [spotlight, setSpotlight] = useState(null);
  const [copied, setCopied] = useState(false);
  const [report, setReport] = useState({ status: "idle" });
  const [mentorship, setMentorship] = useState({ status: "loading" });
  const [watchlist, setWatchlist] = useState([]);
  const [bridges, setBridges] = useState({ status: "idle", data: [] });
  const [orgInput, setOrgInput] = useState("");
  const [readiness, setReadiness] = useState({ status: "loading" });
  const [wild, setWild] = useState({ status: "idle" });
  const [host, setHost] = useState({ status: "idle" });
  const [bulletin, setBulletin] = useState(null);
  const [kick, setKick] = useState({});
  const svgRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/city/${encodeURIComponent(username)}`);
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) {
          setState({
            status: "error",
            message: ERRORS[json.error] || ERRORS.unexpected,
          });
        } else {
          setState({ status: "ready", data: json });
        }
      } catch {
        if (alive) setState({ status: "error", message: ERRORS.unexpected });
      }
    })();
    return () => {
      alive = false;
    };
  }, [username]);

  // Mentorship matchmaking loads lazily so the skyline is never blocked.
  useEffect(() => {
    if (state.status !== "ready") return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/mentorship/${encodeURIComponent(username)}`);
        const json = await res.json();
        if (!alive) return;
        setMentorship(
          res.ok ? { status: "ready", data: json } : { status: "error" }
        );
      } catch {
        if (alive) setMentorship({ status: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [state.status, username]);

  // Application readiness — loads lazily.
  useEffect(() => {
    if (state.status !== "ready") return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/readiness/${encodeURIComponent(username)}`);
        const json = await res.json();
        if (!alive) return;
        setReadiness(res.ok ? { status: "ready", data: json } : { status: "error" });
      } catch {
        if (alive) setReadiness({ status: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [state.status, username]);

  // "Since you last visited" — compare against the snapshot saved on the
  // previous visit (localStorage). Only diffs older than an hour count,
  // so refreshes don't reset the baseline.
  useEffect(() => {
    if (state.status !== "ready") return;
    const key = `cc-visit-${username.toLowerCase()}`;
    try {
      const c = state.data.city;
      const snap = {
        at: Date.now(),
        towers: c.towerCount,
        contributions: c.totalContributions,
        stars: c.analysis.totalStars,
        streak: c.currentStreak,
      };
      const prev = JSON.parse(localStorage.getItem(key) || "null");
      if (!prev) {
        localStorage.setItem(key, JSON.stringify(snap));
        return;
      }
      if (Date.now() - prev.at < 60 * 60 * 1000) return;
      const diff = {
        since: prev.at,
        towers: snap.towers - prev.towers,
        contributions: snap.contributions - prev.contributions,
        stars: snap.stars - prev.stars,
        streakFrom: prev.streak,
        streakTo: snap.streak,
      };
      if (
        diff.towers !== 0 ||
        diff.contributions !== 0 ||
        diff.stars !== 0 ||
        diff.streakFrom !== diff.streakTo
      ) {
        setBulletin(diff);
      }
      localStorage.setItem(key, JSON.stringify(snap));
    } catch {}
  }, [state.status, username, state.data]);

  // "Help me start" — per-issue beginner attack plan from Gemini.
  async function kickstart(issue) {
    setKick((k) => ({ ...k, [issue.url]: { status: "loading" } }));
    try {
      const res = await fetch("/api/kickstart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: issue.title,
          repo: issue.repo,
          language: issue.language,
          url: issue.url,
        }),
      });
      const json = await res.json();
      setKick((k) => ({
        ...k,
        [issue.url]: res.ok
          ? { status: "ready", text: json.text }
          : { status: "error", reason: json.error },
      }));
    } catch {
      setKick((k) => ({ ...k, [issue.url]: { status: "error" } }));
    }
  }

  // External footprint + maintainer health are the most API-heavy panels,
  // so they load on demand (a click) rather than on every page view.
  async function loadWild() {
    setWild({ status: "loading" });
    try {
      const res = await fetch(`/api/wild/${encodeURIComponent(username)}`);
      const json = await res.json();
      setWild(res.ok ? { status: "ready", data: json } : { status: "error", reason: json.error });
    } catch {
      setWild({ status: "error" });
    }
  }

  async function loadHost() {
    setHost({ status: "loading" });
    try {
      const res = await fetch(`/api/host/${encodeURIComponent(username)}`);
      const json = await res.json();
      setHost(res.ok ? { status: "ready", data: json } : { status: "error", reason: json.error });
    } catch {
      setHost({ status: "error" });
    }
  }

  // Target-org watchlist lives in localStorage, bridges load from it.
  useEffect(() => {
    if (state.status !== "ready") return;
    try {
      const saved = JSON.parse(
        localStorage.getItem(`cc-watch-${username.toLowerCase()}`) || "[]"
      );
      setWatchlist(saved);
      if (saved.length > 0) loadBridges(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, username]);

  async function loadBridges(orgs) {
    setBridges({ status: "loading", data: [] });
    try {
      const res = await fetch(
        `/api/bridges/${encodeURIComponent(username)}?orgs=${orgs.join(",")}`
      );
      const json = await res.json();
      setBridges(
        res.ok
          ? { status: "ready", data: json.bridges }
          : { status: "error", reason: json.error }
      );
    } catch {
      setBridges({ status: "error" });
    }
  }

  function saveWatchlist(orgs) {
    setWatchlist(orgs);
    try {
      localStorage.setItem(
        `cc-watch-${username.toLowerCase()}`,
        JSON.stringify(orgs)
      );
    } catch {}
    if (orgs.length > 0) loadBridges(orgs);
    else setBridges({ status: "idle", data: [] });
  }

  function addOrg(slug) {
    const clean = slug.trim().replace(/^@/, "").replace(/^github\.com\//, "");
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(clean)) return;
    if (watchlist.some((o) => o.toLowerCase() === clean.toLowerCase())) return;
    saveWatchlist([...watchlist, clean].slice(0, 4));
    setOrgInput("");
  }

  const city = state.data?.city;

  const firstYear = useMemo(() => {
    if (!city) return null;
    const ys = city.towers.map((t) => t.createdYear).filter(Boolean);
    return ys.length ? Math.min(...ys) : null;
  }, [city]);
  const nowYear = new Date().getFullYear();

  const visibleTowers = useMemo(() => {
    if (!city) return [];
    if (year == null) return city.towers;
    return city.towers.filter((t) => !t.createdYear || t.createdYear <= year);
  }, [city, year]);

  function downloadSnapshot() {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 2400;
      canvas.height = 1200;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 2400, 1200);
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(png);
        a.download = `${state.data.user.login}-commit-city.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
    };
    img.src = url;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  async function generateReport() {
    setReport({ status: "loading" });
    try {
      const res = await fetch(`/api/report/${encodeURIComponent(username)}`);
      const json = await res.json();
      if (!res.ok) {
        setReport({ status: "unavailable", reason: json.error });
      } else {
        setReport({ status: "ready", text: json.report });
      }
    } catch {
      setReport({ status: "unavailable", reason: "unexpected" });
    }
  }

  if (state.status === "loading") {
    return (
      <main className="build-screen">
        <div className="build-icon">🌃</div>
        <h2>Raising the skyline for {username}…</h2>
        <p>One tower per repository, switching on the lights</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="build-screen">
        <div className="build-icon">🌫️</div>
        <h2>Lights out</h2>
        <p>{state.message}</p>
        <Link href="/" className="back-pill solid">
          ← try another username
        </Link>
      </main>
    );
  }

  const { user } = state.data;
  const a = city.analysis;
  const maxYear = Math.max(1, ...a.years.map((y) => y.total));

  return (
    <main className="city-page">
      <div className="scene-hero">
        <CityScene
          seed={user.login.toLowerCase()}
          towers={visibleTowers}
          suburbs={city.suburbs}
          mood={year == null ? city.mood : "clear"}
          svgRef={svgRef}
          hero
          onSelectTower={setSpotlight}
        />

        <Link href="/" className="back-pill">
          ← new skyline
        </Link>

        <div className="pill-group">
          <button className="snapshot-pill" onClick={copyLink}>
            {copied ? "✓ copied" : "🔗 copy link"}
          </button>
          <button className="snapshot-pill" onClick={downloadSnapshot}>
            ⬇ snapshot
          </button>
          <Link className="snapshot-pill" href={`/city/${user.login}/wrapped`}>
            🎁 wrapped
          </Link>
        </div>

        <div className="hero-card">
          <img src={user.avatarUrl} alt="" />
          <div>
            <h2>{user.name || user.login}</h2>
            <span className="stage-line">
              {city.towerCount} towers · one per project
              {city.momentum.pct !== 0 && (
                <span className={city.momentum.pct > 0 ? "momentum up" : "momentum down"}>
                  {city.momentum.pct > 0 ? " ▲" : " ▼"} {Math.abs(city.momentum.pct)}%
                </span>
              )}
            </span>
            <span className="next-line">
              click a tower for its story · hover for a peek
            </span>
          </div>
        </div>

        {spotlight && (
          <div className="spotlight" onClick={(e) => e.stopPropagation()}>
            <button className="spotlight-close" onClick={() => setSpotlight(null)}>
              ✕
            </button>
            <h4>
              {spotlight.name}
              {spotlight.landmarkColor && (
                <span className="spire-dot small" style={{ background: spotlight.landmarkColor, color: spotlight.landmarkColor }} />
              )}
            </h4>
            <p className="spotlight-meta">
              ★ {spotlight.stars.toLocaleString()} · ⑂ {spotlight.forks.toLocaleString()}
              {spotlight.language ? ` · ${spotlight.language}` : ""}
              {spotlight.createdYear ? ` · est. ${spotlight.createdYear}` : ""}
            </p>
            {spotlight.description && <p className="spotlight-desc">{spotlight.description}</p>}
            <p className="spotlight-meta">
              last construction: {relativeTime(spotlight.pushedAt)}
            </p>
            <a href={spotlight.url} target="_blank" rel="noreferrer" className="spotlight-link">
              open on GitHub →
            </a>
          </div>
        )}
      </div>

      {firstYear && firstYear < nowYear && (
        <div className="time-machine">
          <span className="tm-label">⏳ time machine</span>
          <input
            type="range"
            min={firstYear}
            max={nowYear}
            value={year ?? nowYear}
            onChange={(e) => {
              const v = Number(e.target.value);
              setYear(v === nowYear ? null : v);
            }}
          />
          <span className="tm-year">
            {year == null ? "today" : `${year} · ${visibleTowers.length} towers`}
          </span>
        </div>
      )}

      <div className="city-content">
        {bulletin && (
          <div className="panel bulletin-panel">
            <h3>🗞️ While you were away</h3>
            <p className="sub">
              The city kept building since{" "}
              {new Date(bulletin.since).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              .
            </p>
            <div className="bulletin-row">
              {bulletin.towers > 0 && (
                <span className="bulletin-chip">
                  🏗️ +{bulletin.towers} tower{bulletin.towers === 1 ? "" : "s"}
                </span>
              )}
              {bulletin.contributions > 0 && (
                <span className="bulletin-chip">
                  🧱 +{bulletin.contributions.toLocaleString()} contributions
                </span>
              )}
              {bulletin.stars > 0 && (
                <span className="bulletin-chip">
                  ⭐ +{bulletin.stars.toLocaleString()} stars
                </span>
              )}
              {bulletin.streakTo > bulletin.streakFrom && (
                <span className="bulletin-chip">
                  🔥 streak {bulletin.streakFrom} → {bulletin.streakTo}
                </span>
              )}
              {bulletin.streakTo < bulletin.streakFrom && (
                <span className="bulletin-chip quiet">
                  🌙 the streak rested — fresh start tonight
                </span>
              )}
              {bulletin.towers === 0 &&
                bulletin.contributions === 0 &&
                bulletin.stars === 0 &&
                bulletin.streakTo === bulletin.streakFrom && (
                  <span className="bulletin-chip quiet">
                    a quiet stretch — the city is exactly as you left it
                  </span>
                )}
            </div>
          </div>
        )}

        {city.towerCount === 0 && (
          <div className="panel">
            <h3>An empty lot, full of promise</h3>
            <p className="sub">
              No public repositories yet — push the first one and the city
              breaks ground.
            </p>
          </div>
        )}

        <div className="stats-row">
          <div className="stat">
            <div className="num">{city.towerCount}</div>
            <div className="label">towers · public projects</div>
          </div>
          <div className="stat">
            <div className="num">{city.totalContributions.toLocaleString()}</div>
            <div className="label">total contributions</div>
          </div>
          <div className="stat">
            <div className="num">{a.totalStars.toLocaleString()}</div>
            <div className="label">stars across the city</div>
          </div>
          <div className="stat">
            <div className="num">{city.currentStreak}</div>
            <div className="label">night streak right now</div>
          </div>
        </div>

        <div className="panel">
          <h3>City rhythm</h3>
          <p className="sub">How this city likes to build.</p>
          <ul className="rhythm-list">
            {a.rhythm.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <h3>Night grid</h3>
          <p className="sub">
            The last 52 weeks, block by block — brighter blocks were busier nights.
          </p>
          <div className="heatmap">
            {city.heatmap.map((d) => (
              <div
                key={d.date}
                className="heat-cell"
                data-level={d.level}
                title={`${d.date} · ${d.count} contribution${d.count === 1 ? "" : "s"}`}
              />
            ))}
          </div>
        </div>

        <div className="panel">
          <h3>City records</h3>
          <p className="sub">The numbers behind the skyline.</p>
          <div className="records-grid">
            <Record
              label="Busiest day ever"
              value={a.bestDay.count.toLocaleString()}
              detail={a.bestDay.date ? `contributions on ${formatDate(a.bestDay.date)}` : "—"}
            />
            <Record label="Longest streak" value={a.longestStreak} detail="consecutive active days" />
            <Record
              label="Busiest weekday"
              value={a.busiestWeekday}
              detail={`${a.weekendPct}% of work happens on weekends`}
            />
            <Record label="Busiest month" value={a.busiestMonth} detail="across all recorded years" />
            <Record
              label="Momentum"
              value={`${city.momentum.pct > 0 ? "+" : ""}${city.momentum.pct}%`}
              detail={`${city.momentum.last90.toLocaleString()} last 90 days vs ${city.momentum.prev90.toLocaleString()} before`}
            />
            <Record label="Average intensity" value={a.avgPerActiveDay} detail="contributions per active day" />
            <Record label="Active construction" value={a.activeRepos} detail="repos pushed in the last 90 days" />
            <Record
              label="City age"
              value={`${a.accountAgeYears}y`}
              detail={`on GitHub · ${a.followers.toLocaleString()} followers`}
            />
          </div>
        </div>

        {a.districts.length > 0 && (
          <div className="panel">
            <h3>Districts</h3>
            <p className="sub">
              Language neighborhoods — each district tints its towers&apos; windows on
              the skyline.
            </p>
            <div className="district-list">
              {a.districts.map((d) => (
                <div className="district" key={d.name}>
                  <div className="district-head">
                    <span>
                      <span className="spire-dot small inline" style={{ background: d.color, color: d.color }} />
                      {d.name}
                    </span>
                    <span>
                      {d.count} {d.count === 1 ? "tower" : "towers"} · {d.pct}%
                    </span>
                  </div>
                  <div className="bar">
                    <div style={{ width: `${d.pct}%`, background: d.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {city.towerCount > 0 && (
          <div className="panel">
            <h3>📜 City permits</h3>
            <p className="sub">
              Licenses across your towers — a repo without a license is legally
              &quot;all rights reserved,&quot; which means it is <em>not</em>{" "}
              open source and nobody can safely reuse it.
            </p>
            {a.licenses.breakdown.length > 0 && (
              <div className="district-list">
                {a.licenses.breakdown.map((l) => (
                  <div className="district" key={l.name}>
                    <div className="district-head">
                      <span>{l.name}</span>
                      <span>
                        {l.count} {l.count === 1 ? "tower" : "towers"}
                      </span>
                    </div>
                    <div className="bar">
                      <div
                        style={{
                          width: `${Math.round((l.count / city.towerCount) * 100)}%`,
                          background: "#7ee0a3",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {a.licenses.unlicensed > 0 ? (
              <div className="license-warning">
                ⚠️ <strong>{a.licenses.unlicensed}</strong> tower
                {a.licenses.unlicensed === 1 ? " has" : "s have"} no permit —{" "}
                {a.licenses.unlicensedSample.join(", ")}
                {a.licenses.unlicensed > a.licenses.unlicensedSample.length
                  ? "…"
                  : ""}
                . Fix it in 30 seconds: on GitHub, <em>Add file → Create new
                file → type &quot;LICENSE&quot;</em> and pick a template (MIT is
                the friendly default).
              </div>
            ) : (
              a.licenses.breakdown.length > 0 && (
                <p className="mentorship-note">
                  ✅ Every tower has a permit — all your public projects are
                  properly licensed.
                </p>
              )
            )}
          </div>
        )}

        <div className="panel">
          <h3>🌍 In the wild</h3>
          <p className="sub">
            Your open-source footprint <em>outside</em> your own city — the part
            mentors and employers weigh most.
          </p>
          {wild.status === "idle" && (
            <button className="report-btn" onClick={loadWild}>
              🌍 map my footprint
            </button>
          )}
          {wild.status === "loading" && (
            <p className="report-loading">Tracking your footprints across the river…</p>
          )}
          {wild.status === "error" && (
            <p className="report-loading">
              {wild.reason === "rate_limited"
                ? "GitHub is rate-limiting the survey — try again in a minute."
                : "Couldn't map your external contributions just now."}
            </p>
          )}
          {wild.status === "ready" && (
            <>
              <div className="stats-row wild-stats">
                <div className="stat">
                  <div className="num">{wild.data.merged.toLocaleString()}</div>
                  <div className="label">PRs merged elsewhere</div>
                </div>
                <div className="stat">
                  <div className="num">
                    {wild.data.acceptancePct == null ? "—" : `${wild.data.acceptancePct}%`}
                  </div>
                  <div className="label">PR acceptance rate</div>
                </div>
                <div className="stat">
                  <div className="num">{wild.data.reviewed.toLocaleString()}</div>
                  <div className="label">PRs you reviewed</div>
                </div>
                <div className="stat">
                  <div className="num">{wild.data.starsReached.toLocaleString()}</div>
                  <div className="label">stars on repos you improved</div>
                </div>
              </div>

              {wild.data.wildLanguages.length > 0 && (
                <>
                  <h4 className="issues-title">Contribution DNA</h4>
                  <p className="sub">
                    What you build at home vs where your merged PRs actually land.
                  </p>
                  <div className="dna-compare">
                    <div>
                      <span className="dna-label">🏠 your city</span>
                      {a.districts.slice(0, 4).map((d) => (
                        <DnaBar key={d.name} name={d.name} pct={d.pct} color={d.color} />
                      ))}
                    </div>
                    <div>
                      <span className="dna-label">🌍 in the wild</span>
                      {wild.data.wildLanguages.slice(0, 4).map((l, i) => (
                        <DnaBar
                          key={l.name}
                          name={l.name}
                          pct={l.pct}
                          color={["#4da3ff", "#ff7ad9", "#7ee0a3", "#b17aff"][i % 4]}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {wild.data.topRepos.length > 0 && (
                <>
                  <h4 className="issues-title">Where your girders landed</h4>
                  <div className="wild-repos">
                    {wild.data.topRepos.slice(0, 6).map((r) => (
                      <a
                        key={r.name}
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="wild-repo-chip"
                      >
                        <strong>{r.name}</strong>
                        <span>
                          {r.prs} PR{r.prs === 1 ? "" : "s"} · ★{" "}
                          {r.stars.toLocaleString()}
                        </span>
                      </a>
                    ))}
                  </div>
                </>
              )}
              {wild.data.sampleNote && (
                <p className="mentorship-note">{wild.data.sampleNote}</p>
              )}
            </>
          )}
        </div>

        {city.towerCount > 0 && (
          <div className="panel">
            <h3>🏘️ Are you a good host?</h3>
            <p className="sub">
              Newcomer-friendliness of your top towers — the files that tell a
              first-time contributor they&apos;re welcome.
            </p>
            {host.status === "idle" && (
              <button className="report-btn" onClick={loadHost}>
                🏘️ inspect my towers
              </button>
            )}
            {host.status === "loading" && (
              <p className="report-loading">Knocking on doors…</p>
            )}
            {host.status === "error" && (
              <p className="report-loading">
                {host.reason === "rate_limited"
                  ? "GitHub is rate-limiting the inspection — try again in a minute."
                  : "Couldn't inspect the towers just now."}
              </p>
            )}
            {host.status === "ready" && host.data.repos.length === 0 && (
              <p className="report-loading">
                No standalone project towers to inspect yet.
              </p>
            )}
            {host.status === "ready" && host.data.repos.length > 0 && (
              <>
            <div className="host-grid">
              {host.data.repos.map((r) => (
                <div className="host-card" key={r.name}>
                  <div className="host-head">
                    <a href={r.url} target="_blank" rel="noreferrer">
                      <strong>{r.name}</strong>
                    </a>
                    <span className="host-health">{r.health}%</span>
                  </div>
                  <ul className="host-checks">
                    <HostCheck ok={r.files.readme} label="README" />
                    <HostCheck ok={r.files.license} label="LICENSE" />
                    <HostCheck ok={r.files.contributing} label="CONTRIBUTING.md" />
                    <HostCheck ok={r.files.codeOfConduct} label="Code of Conduct" />
                    <HostCheck ok={r.files.issueTemplate} label="Issue template" />
                    <HostCheck
                      ok={r.goodFirstIssues > 0}
                      label={
                        r.goodFirstIssues > 0
                          ? `${r.goodFirstIssues} good-first-issue${r.goodFirstIssues === 1 ? "" : "s"} open`
                          : "No good-first-issues labeled"
                      }
                    />
                  </ul>
                </div>
              ))}
            </div>
            <p className="mentorship-note">
              Missing files are one-click adds on GitHub (Insights → Community
              Standards). Labeling a few easy issues &quot;good first issue&quot;
              is how your city welcomes its own newcomers.
            </p>
              </>
            )}
          </div>
        )}

        {a.years.length > 1 && (
          <div className="panel">
            <h3>City growth</h3>
            <p className="sub">Contributions per year — how the city was built.</p>
            <div className="growth-chart">
              {a.years.map((y) => (
                <div className="growth-col" key={y.year} title={`${y.year}: ${y.total.toLocaleString()}`}>
                  <span className="growth-val">{compact(y.total)}</span>
                  <div
                    className="growth-bar"
                    style={{ height: `${Math.max(4, (y.total / maxYear) * 120)}px` }}
                  />
                  <span className="growth-year">{y.year.slice(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {city.landmarks.length > 0 && (
          <div className="panel">
            <h3>Landmarks</h3>
            <p className="sub">
              The tallest towers downtown — your most-starred projects, each with
              its own spire light.
            </p>
            <ul className="landmark-list">
              {city.landmarks.map((l) => (
                <li key={l.name}>
                  <span className="spire-dot" style={{ background: l.color, color: l.color }} />
                  <div>
                    <a href={l.url} target="_blank" rel="noreferrer" className="landmark-link">
                      <strong>{l.name}</strong>
                    </a>
                    <span className="landmark-meta">
                      ★ {l.stars.toLocaleString()}
                      {l.language ? ` · ${l.language}` : ""}
                    </span>
                    {l.description && <p>{l.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="panel">
          <h3>Break into open source</h3>
          <p className="sub">
            Mentorship programs and starter issues matched to this city&apos;s
            districts{mentorship.status === "ready" && mentorship.data.languages.length > 0
              ? ` — ${mentorship.data.languages.slice(0, 3).join(", ")}`
              : ""}.
          </p>

          {mentorship.status === "loading" && (
            <p className="report-loading">Scouting programs across the river…</p>
          )}
          {mentorship.status === "error" && (
            <p className="report-loading">
              Couldn&apos;t reach the program listings just now — try a refresh in a minute.
            </p>
          )}
          {mentorship.status === "ready" && (
            <>
              <div className="org-grid">
                {mentorship.data.orgs.map((o) => (
                  <div className="org-card" key={o.name}>
                    <div className="org-head">
                      <span className={`program-badge ${badgeClass(o.program)}`}>
                        {o.program}
                      </span>
                      <strong>{o.name}</strong>
                      {o.level && (
                        <span className={`level-chip small lvl-${o.level}`}>
                          {o.level === "beginner"
                            ? "🌱 beginner-friendly"
                            : o.level === "tough"
                              ? "🧗 tough"
                              : "⚒️ intermediate"}
                        </span>
                      )}
                      {o.competition && (
                        <span className={`competition-chip ${o.competition}`}>
                          {o.competition === "high"
                            ? "🔥 competitive"
                            : o.competition === "medium"
                              ? "⚖️ moderate"
                              : "🌱 friendlier odds"}
                        </span>
                      )}
                    </div>
                    {o.matched.length > 0 && (
                      <div className="org-tech">
                        {o.matched.map((t) => (
                          <span key={t} className="tech-chip">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {o.description && <p>{o.description}</p>}
                    <div className="org-links">
                      {o.site && (
                        <a href={o.site} target="_blank" rel="noreferrer">
                          program ↗
                        </a>
                      )}
                      {o.repo && (
                        <a href={o.repo} target="_blank" rel="noreferrer">
                          repo ↗
                        </a>
                      )}
                      {o.issues && (
                        <a href={o.issues} target="_blank" rel="noreferrer">
                          {o.program.startsWith("GSoC") && o.issues.includes("ideas")
                            ? "project ideas ↗"
                            : "starter issues ↗"}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {mentorship.data.issues.length > 0 && (
                <>
                  <h4 className="issues-title">Issues you could try tonight</h4>
                  <ul className="issue-list">
                    {mentorship.data.issues.map((it) => (
                      <li key={it.url}>
                        <span className="tech-chip">{it.language}</span>
                        <div className="issue-body">
                          <a href={it.url} target="_blank" rel="noreferrer">
                            {it.title}
                          </a>
                          <span className="issue-repo">
                            {" "}
                            in{" "}
                            <a href={it.repoUrl} target="_blank" rel="noreferrer">
                              {it.repo}
                            </a>{" "}
                            · {it.comments} comments
                          </span>
                          <div className="kickstart-row">
                            {!kick[it.url] && (
                              <button
                                className="kickstart-btn"
                                onClick={() => kickstart(it)}
                              >
                                🚀 help me start
                              </button>
                            )}
                            {kick[it.url]?.status === "loading" && (
                              <span className="report-loading">
                                drawing up your plan of attack…
                              </span>
                            )}
                            {kick[it.url]?.status === "error" && (
                              <span className="report-loading">
                                {kick[it.url].reason === "no_key"
                                  ? "needs a free GEMINI_API_KEY to work"
                                  : kick[it.url].reason === "rate_limited"
                                    ? "the guide needs a breather — try again in a minute"
                                    : "couldn't draw the plan — try again"}
                              </span>
                            )}
                          </div>
                          {kick[it.url]?.status === "ready" && (
                            <div className="coach-result kickstart-result">
                              <RichText text={kick[it.url].text} />
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {mentorship.data.suggestedRepos?.length > 0 && (
                <>
                  <h4 className="issues-title">
                    Neighborhoods hiring first-timers
                  </h4>
                  <p className="sub">
                    Actively maintained repos in your languages and topics with
                    open good-first-issues.
                  </p>
                  <div className="org-grid">
                    {mentorship.data.suggestedRepos.map((r) => (
                      <div className="org-card" key={r.name}>
                        <div className="org-head">
                          <strong>{r.name}</strong>
                          <span className="landmark-meta">
                            ★ {r.stars.toLocaleString()}
                            {r.language ? ` · ${r.language}` : ""}
                          </span>
                        </div>
                        {r.topics.length > 0 && (
                          <div className="org-tech">
                            {r.topics.map((t) => (
                              <span key={t} className="tech-chip">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {r.description && <p>{r.description}</p>}
                        <div className="org-links">
                          <a href={r.url} target="_blank" rel="noreferrer">
                            repo ↗
                          </a>
                          <a href={r.gfiUrl} target="_blank" rel="noreferrer">
                            starter issues ↗
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <p className="mentorship-note">
                {mentorship.data.liveGsoc
                  ? "GSoC organizations from Google's live program listing · LFX and Outreachy picks curated."
                  : "Program list curated from recent GSoC, LFX and Outreachy cohorts — check each program's site for this year's dates."}
              </p>
            </>
          )}
          <div className="hq-link-row">
            <Link href="/prepare" className="hq-link">
              🧭 Mentorship HQ — deadlines, quiz & proposal coach →
            </Link>
            <Link href="/programs" className="hq-link">
              📚 full program directory →
            </Link>
          </div>
        </div>

        <div className="panel">
          <h3>🌉 Bridges to your target orgs</h3>
          <p className="sub">
            Pick the orgs you&apos;re aiming for — every merged PR adds a girder
            to your bridge. Mentors pick applicants who contributed early.
          </p>

          <div className="watch-controls">
            <form
              className="watch-form"
              onSubmit={(e) => {
                e.preventDefault();
                addOrg(orgInput);
              }}
            >
              <input
                value={orgInput}
                onChange={(e) => setOrgInput(e.target.value)}
                placeholder="github org (e.g. zulip)"
                spellCheck={false}
              />
              <button type="submit">+ watch</button>
            </form>
            {mentorship.status === "ready" && watchlist.length < 4 && (
              <div className="quick-add">
                {quickAddSlugs(mentorship.data.orgs, watchlist).map((slug) => (
                  <button key={slug} className="tech-chip clickable" onClick={() => addOrg(slug)}>
                    + {slug}
                  </button>
                ))}
              </div>
            )}
          </div>

          {watchlist.length === 0 && (
            <p className="report-loading">
              No target orgs yet — add one above, or tap a suggestion from your
              matched programs.
            </p>
          )}

          {bridges.status === "loading" && (
            <p className="report-loading">Surveying the river…</p>
          )}
          {bridges.status === "error" && (
            <p className="report-loading">
              {bridges.reason === "rate_limited"
                ? "GitHub is rate-limiting the survey crew — try again in a minute."
                : "Couldn't survey the bridges just now."}
            </p>
          )}
          {bridges.status === "ready" && (
            <div className="bridge-list">
              {bridges.data.map((b) => (
                <div className="bridge-card" key={b.org}>
                  <div className="bridge-head">
                    <a href={b.orgUrl} target="_blank" rel="noreferrer">
                      <strong>{user.login}</strong> → <strong>{b.org}</strong>
                    </a>
                    <button
                      className="bridge-remove"
                      onClick={() =>
                        saveWatchlist(watchlist.filter((o) => o !== b.org))
                      }
                    >
                      ✕
                    </button>
                  </div>
                  <BridgeGraphic merged={b.merged} open={b.open} />
                  <div className="bridge-stats">
                    <span>
                      <strong>{b.merged}</strong> merged girder{b.merged === 1 ? "" : "s"}
                    </span>
                    <span>
                      <strong>{b.open}</strong> in review
                    </span>
                    <a href={b.issuesUrl} target="_blank" rel="noreferrer">
                      find an issue →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h3>🎯 Application readiness</h3>
          <p className="sub">
            The signals GSoC / LFX / Outreachy mentors actually look at.
          </p>
          {readiness.status === "loading" && (
            <p className="report-loading">Scoring the application…</p>
          )}
          {readiness.status === "error" && (
            <p className="report-loading">
              Couldn&apos;t compute the score just now — likely a GitHub rate
              limit. Try again shortly.
            </p>
          )}
          {readiness.status === "ready" && (
            <>
              <div className="readiness-head">
                <div className="readiness-score">
                  <span>{readiness.data.score}</span>/100
                </div>
                <p className="readiness-verdict">{readiness.data.verdict}</p>
              </div>
              <div className="bar readiness-bar">
                <div style={{ width: `${readiness.data.score}%` }} />
              </div>
              <ul className="readiness-list">
                {readiness.data.checks.map((c) => (
                  <li key={c.label} className={c.state}>
                    <span className="readiness-icon">
                      {c.state === "done" ? "✅" : c.state === "partial" ? "◐" : "◻"}
                    </span>
                    <div>
                      <strong>
                        {c.label} · {c.earned}/{c.points}
                      </strong>
                      {c.state !== "done" && <p>{c.advice}</p>}
                    </div>
                  </li>
                ))}
              </ul>
              {readiness.data.topOrgs.length > 0 && (
                <p className="mentorship-note">
                  Bridges already standing:{" "}
                  {readiness.data.topOrgs
                    .map((o) => `${o.org} (${o.count})`)
                    .join(" · ")}
                </p>
              )}
            </>
          )}
        </div>

        <div className="panel">
          <h3>City inspector&apos;s report</h3>
          <p className="sub">
            An AI walking tour of this skyline — written fresh for this profile.
          </p>
          {report.status === "idle" && (
            <button className="report-btn" onClick={generateReport}>
              🕵️ commission the report
            </button>
          )}
          {report.status === "loading" && (
            <p className="report-loading">The inspector is walking the streets…</p>
          )}
          {report.status === "ready" && (
            <div className="report-text">
              {report.text.split("\n").filter(Boolean).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
          {report.status === "unavailable" && (
            <p className="report-loading">
              {report.reason === "no_key"
                ? "The inspector is off duty — add a free GEMINI_API_KEY to .env.local to hire them."
                : "The inspector couldn't finish the rounds. Try again in a moment."}
            </p>
          )}
        </div>

        <div className="panel versus-cta">
          <div>
            <h3>Two cities, one river</h3>
            <p className="sub" style={{ margin: 0 }}>
              Compare this skyline with a friend&apos;s.
            </p>
          </div>
          <VersusForm me={user.login} />
        </div>

        <div className="panel embed-panel">
          <h3>Take your skyline anywhere</h3>
          <p className="sub">
            Paste this into your GitHub profile README — it stays live as your city grows.
          </p>
          <EmbedSnippet login={user.login} />
        </div>

        <p className="footer-note">
          Commit City · every public project raises a tower · stars raise it higher
        </p>
      </div>
    </main>
  );
}

function VersusForm({ me }) {
  const [rival, setRival] = useState("");
  return (
    <form
      className="versus-form"
      onSubmit={(e) => {
        e.preventDefault();
        const r = rival.trim().replace(/^@/, "");
        if (r) window.location.href = `/versus/${encodeURIComponent(me)}/${encodeURIComponent(r)}`;
      }}
    >
      <input
        value={rival}
        onChange={(e) => setRival(e.target.value)}
        placeholder="their username"
        spellCheck={false}
      />
      <button type="submit">compare →</button>
    </form>
  );
}

function EmbedSnippet({ login }) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const code = `![${login}'s Commit City](${origin}/api/skyline/${login})`;
  return (
    <div className="embed-row">
      <code>{code}</code>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {}
        }}
      >
        {copied ? "✓" : "copy"}
      </button>
    </div>
  );
}

function badgeClass(program) {
  if (program.includes("Outreachy")) return "outreachy";
  if (program.startsWith("GSoC")) return "gsoc";
  return "lfx";
}

// Suggest github org slugs from matched program orgs' repo URLs.
function quickAddSlugs(orgs, watchlist) {
  const watched = new Set(watchlist.map((w) => w.toLowerCase()));
  const slugs = [];
  for (const o of orgs) {
    const m = /github\.com\/([a-zA-Z0-9-]+)/.exec(o.repo || "");
    if (!m) continue;
    const slug = m[1];
    if (watched.has(slug.toLowerCase())) continue;
    if (slugs.some((s) => s.toLowerCase() === slug.toLowerCase())) continue;
    slugs.push(slug);
    if (slugs.length >= 4) break;
  }
  return slugs;
}

// A little suspension bridge: merged PRs are solid gold girders,
// PRs in review are dashed, the rest of the deck is unbuilt.
function BridgeGraphic({ merged, open }) {
  const SEGMENTS = 8;
  const solid = Math.min(SEGMENTS, merged);
  const dashed = Math.min(SEGMENTS - solid, open);
  const segW = 300 / SEGMENTS;
  return (
    <svg viewBox="0 0 340 80" className="bridge-svg" aria-hidden="true">
      {/* pylons */}
      <rect x="14" y="10" width="6" height="58" rx="2" fill="#3a4a7a" />
      <rect x="320" y="10" width="6" height="58" rx="2" fill="#3a4a7a" />
      {/* suspension cables */}
      <path d="M 17 14 Q 170 66 323 14" fill="none" stroke="#3a4a7a" strokeWidth="2" />
      {/* deck */}
      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const x = 20 + i * segW;
        const kind = i < solid ? "solid" : i < solid + dashed ? "dashed" : "none";
        return (
          <line
            key={i}
            x1={x + 2}
            y1="56"
            x2={x + segW - 2}
            y2="56"
            stroke={kind === "solid" ? "#f6c453" : kind === "dashed" ? "#4da3ff" : "#1d2a52"}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={kind === "dashed" ? "6 5" : undefined}
            opacity={kind === "none" ? 0.5 : 1}
          />
        );
      })}
      {merged > SEGMENTS && (
        <text x="330" y="60" textAnchor="end" fontSize="11" fill="#9aa7c7" fontFamily="inherit">
          +{merged - SEGMENTS}
        </text>
      )}
    </svg>
  );
}

function DnaBar({ name, pct, color }) {
  return (
    <div className="district dna-row">
      <div className="district-head">
        <span>{name}</span>
        <span>{pct}%</span>
      </div>
      <div className="bar">
        <div style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function HostCheck({ ok, label }) {
  return (
    <li className={ok ? "ok" : "missing"}>
      {ok ? "✅" : "◻"} {label}
    </li>
  );
}

function Record({ label, value, detail }) {
  return (
    <div className="record">
      <div className="record-value">{value}</div>
      <div className="record-label">{label}</div>
      <div className="record-detail">{detail}</div>
    </div>
  );
}

function formatDate(iso) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function relativeTime(iso) {
  if (!iso) return "unknown";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function compact(n) {
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(n);
}
