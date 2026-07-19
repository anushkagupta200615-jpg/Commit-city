"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// 📚 Program directory — every live GSoC organization for the current
// year, plus curated LFX and Outreachy community rosters, searchable
// and filterable by language/tech.

const TABS = [
  { id: "all", label: "All" },
  { id: "gsoc", label: "GSoC" },
  { id: "lfx", label: "LFX" },
  { id: "outreachy", label: "Outreachy" },
];

const INITIAL_SHOWN = 48;

export default function ProgramsPage() {
  const [state, setState] = useState({ status: "loading" });
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [tech, setTech] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/programs");
        const json = await res.json();
        if (alive)
          setState(res.ok ? { status: "ready", data: json } : { status: "error" });
      } catch {
        if (alive) setState({ status: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const orgs = useMemo(() => {
    if (state.status !== "ready") return [];
    const { gsoc, lfx, outreachy } = state.data;
    if (tab === "gsoc") return gsoc;
    if (tab === "lfx") return lfx;
    if (tab === "outreachy") return outreachy;
    return [...gsoc, ...lfx, ...outreachy];
  }, [state, tab]);

  // Top tech tags across the current tab's orgs.
  const techChips = useMemo(() => {
    const counts = new Map();
    for (const o of orgs) {
      for (const t of o.tech || []) {
        const key = String(t).toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
      .map(([name, count]) => ({ name, count }));
  }, [orgs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orgs.filter((o) => {
      if (tech && !(o.tech || []).some((t) => String(t).toLowerCase() === tech))
        return false;
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        (o.description || "").toLowerCase().includes(q) ||
        (o.tech || []).some((t) => String(t).toLowerCase().includes(q))
      );
    });
  }, [orgs, query, tech]);

  const shown = showAll ? filtered : filtered.slice(0, INITIAL_SHOWN);

  return (
    <main className="hq-page">
      <div className="hq-head">
        <Link href="/" className="back-pill">
          ← commit city
        </Link>
        <h1>
          📚 Program <span>directory</span>
        </h1>
        <p>
          Every organization you could apply to — the live GSoC list for this
          year, plus the recurring LFX and Outreachy communities.
        </p>
      </div>

      <div className="city-content">
        {state.status === "loading" && (
          <div className="panel">
            <p className="report-loading">Unrolling the map of every org…</p>
          </div>
        )}
        {state.status === "error" && (
          <div className="panel">
            <p className="report-loading">
              Couldn&apos;t load the directory just now — try a refresh.
            </p>
          </div>
        )}

        {state.status === "ready" && (
          <>
            <div className="panel">
              <div className="dir-controls">
                <div className="coach-tabs dir-tabs">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      className={tab === t.id ? "active" : ""}
                      onClick={() => {
                        setTab(t.id);
                        setTech(null);
                        setShowAll(false);
                      }}
                    >
                      {t.label}{" "}
                      <span className="dir-count">
                        {t.id === "all"
                          ? state.data.gsoc.length +
                            state.data.lfx.length +
                            state.data.outreachy.length
                          : state.data[t.id].length}
                      </span>
                    </button>
                  ))}
                </div>
                <input
                  className="coach-wide-input dir-search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowAll(false);
                  }}
                  placeholder="search orgs, tech, keywords…"
                  spellCheck={false}
                />
              </div>

              <div className="quick-add dir-chips">
                {techChips.map((t) => (
                  <button
                    key={t.name}
                    className={`tech-chip clickable${tech === t.name ? " active-chip" : ""}`}
                    onClick={() => {
                      setTech(tech === t.name ? null : t.name);
                      setShowAll(false);
                    }}
                  >
                    {t.name} · {t.count}
                  </button>
                ))}
              </div>

              <p className="mentorship-note">
                {state.data.liveGsoc
                  ? `GSoC organizations come live from Google's program listing (${state.data.gsoc.length} orgs). `
                  : "Google's live listing is unreachable right now — showing curated GSoC picks. "}
                LFX lists exact projects per term on{" "}
                <a
                  className="inline-link"
                  href="https://mentorship.lfx.linuxfoundation.org/"
                  target="_blank"
                  rel="noreferrer"
                >
                  mentorship.lfx.linuxfoundation.org
                </a>
                ; Outreachy publishes its project list during each cohort&apos;s
                contribution period on{" "}
                <a
                  className="inline-link"
                  href="https://www.outreachy.org/apply/project-selection/"
                  target="_blank"
                  rel="noreferrer"
                >
                  outreachy.org
                </a>
                . The rosters here are their recurring communities.
              </p>
            </div>

            <div className="panel">
              <h3>
                {filtered.length} organization{filtered.length === 1 ? "" : "s"}
                {tech ? ` · ${tech}` : ""}
                {query ? ` · “${query}”` : ""}
              </h3>
              {filtered.length === 0 ? (
                <p className="report-loading">
                  Nothing matches — try clearing the search or the tech filter.
                </p>
              ) : (
                <>
                  <div className="org-grid dir-grid">
                    {shown.map((o) => (
                      <div className="org-card" key={`${o.program}-${o.name}`}>
                        <div className="org-head">
                          <span className={`program-badge ${badgeClass(o.program)}`}>
                            {o.program}
                          </span>
                          <strong>{o.name}</strong>
                        </div>
                        {(o.tech || []).length > 0 && (
                          <div className="org-tech">
                            {o.tech.slice(0, 5).map((t) => (
                              <span key={t} className="tech-chip">
                                {String(t)}
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
                              {o.program.startsWith("GSoC") &&
                              String(o.issues).includes("ideas")
                                ? "project ideas ↗"
                                : "starter issues ↗"}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!showAll && filtered.length > INITIAL_SHOWN && (
                    <button
                      className="report-btn dir-more"
                      onClick={() => setShowAll(true)}
                    >
                      show all {filtered.length}
                    </button>
                  )}
                </>
              )}
            </div>

            <p className="footer-note">
              Commit City · program directory · always confirm details on the
              official program sites
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function badgeClass(program) {
  if (program.includes("Outreachy")) return "outreachy";
  if (program.startsWith("GSoC")) return "gsoc";
  return "lfx";
}
