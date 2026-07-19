"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import CityScene from "../../../components/CityScene";

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
                      <span
                        className={`program-badge ${o.program.startsWith("GSoC") ? "gsoc" : "lfx"}`}
                      >
                        {o.program}
                      </span>
                      <strong>{o.name}</strong>
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
                        <div>
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
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mentorship-note">
                {mentorship.data.liveGsoc
                  ? "GSoC organizations from Google's live program listing · LFX picks curated."
                  : "Program list curated from recent GSoC and LFX Mentorship cohorts — check each program's site for this year's dates."}
              </p>
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
                ? "The inspector is off duty — add an ANTHROPIC_API_KEY to .env.local to hire them."
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
