"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CityScene from "../../components/CityScene";

// Squad street — a study group of cities all aiming at the same program.
// Share one link; everyone sees everyone's skyline, stats, and (optionally)
// bridge progress toward a common target org. Accountability, not ranking.

export default function SquadPage() {
  return (
    <Suspense fallback={<main className="build-screen"><div className="build-icon">🌉</div><h2>Assembling the squad…</h2></main>}>
      <SquadInner />
    </Suspense>
  );
}

function SquadInner() {
  const params = useSearchParams();
  const router = useRouter();
  const usersParam = params.get("users") || "";
  const org = (params.get("org") || "").trim();
  const users = [
    ...new Set(
      usersParam
        .split(",")
        .map((u) => u.trim().replace(/^@/, ""))
        .filter((u) => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(u))
    ),
  ].slice(0, 4);

  const [members, setMembers] = useState({ status: users.length ? "loading" : "empty" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (users.length === 0) return;
    let alive = true;
    (async () => {
      const loaded = [];
      for (const u of users) {
        try {
          const res = await fetch(`/api/city/${encodeURIComponent(u)}`);
          if (!res.ok) continue;
          const city = await res.json();
          let bridge = null;
          if (org) {
            try {
              const br = await fetch(
                `/api/bridges/${encodeURIComponent(u)}?orgs=${encodeURIComponent(org)}`
              );
              if (br.ok) bridge = (await br.json()).bridges[0];
            } catch {}
          }
          loaded.push({ ...city, bridge });
          if (alive) setMembers({ status: "loading", data: [...loaded] });
        } catch {}
      }
      if (alive)
        setMembers(
          loaded.length > 0 ? { status: "ready", data: loaded } : { status: "error" }
        );
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersParam, org]);

  if (users.length === 0) {
    return (
      <main className="build-screen">
        <div className="build-icon">🌉</div>
        <h2>Build a squad street</h2>
        <p>Up to four friends, one shared page — optionally all aiming at the same org.</p>
        <SquadForm router={router} />
      </main>
    );
  }

  if (members.status === "error") {
    return (
      <main className="build-screen">
        <div className="build-icon">🌫️</div>
        <h2>Couldn&apos;t find those cities</h2>
        <Link href="/squad" className="back-pill solid">
          ← rebuild the squad
        </Link>
      </main>
    );
  }

  const data = members.data || [];

  return (
    <main className="versus-page">
      <div className="versus-head">
        <Link href="/" className="back-pill">
          ← commit city
        </Link>
        <h1>
          🌉 squad street{org ? <> · target: <span>{org}</span></> : null}
        </h1>
        <button
          className="back-pill"
          style={{ position: "static" }}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {}
          }}
        >
          {copied ? "✓ copied" : "🔗 share squad"}
        </button>
      </div>

      <div className="city-content">
        <div className="squad-grid">
          {data.map((m) => (
            <Link
              key={m.user.login}
              href={`/city/${m.user.login}`}
              className="squad-card"
            >
              <div className="featured-scene squad-scene">
                <CityScene
                  seed={m.user.login.toLowerCase()}
                  towers={m.city.towers}
                  ambient={false}
                />
              </div>
              <div className="squad-meta">
                <img src={m.user.avatarUrl} alt="" />
                <div>
                  <strong>@{m.user.login}</strong>
                  <span>
                    {m.city.towerCount} towers · {m.city.currentStreak}-night streak
                  </span>
                  {m.bridge && (
                    <span className="squad-bridge">
                      🌉 {m.bridge.merged} merged · {m.bridge.open} in review at {org}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
          {members.status === "loading" && (
            <div className="squad-card loading-card">raising skylines…</div>
          )}
        </div>

        {members.status === "ready" && (
          <div className="panel">
            <h3>The street at a glance</h3>
            <p className="sub">Everyone&apos;s pace, side by side — accountability, not ranking.</p>
            <div className="compare-scroll">
              <table className="versus-table squad-table">
                <thead>
                  <tr>
                    <th></th>
                    {data.map((m) => (
                      <th key={m.user.login}>@{m.user.login}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Towers", (m) => m.city.towerCount],
                    ["Contributions", (m) => m.city.totalContributions],
                    ["Stars", (m) => m.city.analysis.totalStars],
                    ["Current streak", (m) => m.city.currentStreak],
                    ["Active days (1y)", (m) => m.city.analysis.activeDaysLastYear],
                    ...(org ? [["Merged PRs → " + org, (m) => m.bridge?.merged ?? "—"]] : []),
                  ].map(([label, fn]) => (
                    <tr key={label}>
                      <td className="vs-label">{label}</td>
                      {data.map((m) => (
                        <td key={m.user.login}>
                          {typeof fn(m) === "number" ? fn(m).toLocaleString() : fn(m)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="footer-note">
          Commit City · squads keep streaks alive · add ?org=zulip to track a shared target
        </p>
      </div>
    </main>
  );
}

function SquadForm({ router }) {
  const [names, setNames] = useState("");
  const [org, setOrg] = useState("");
  return (
    <form
      className="landing-search squad-form"
      onSubmit={(e) => {
        e.preventDefault();
        const users = names
          .split(/[,\s]+/)
          .map((u) => u.trim())
          .filter(Boolean)
          .slice(0, 4)
          .join(",");
        if (!users) return;
        router.push(
          `/squad?users=${encodeURIComponent(users)}${org.trim() ? `&org=${encodeURIComponent(org.trim())}` : ""}`
        );
      }}
    >
      <input
        value={names}
        onChange={(e) => setNames(e.target.value)}
        placeholder="usernames, comma separated"
        spellCheck={false}
      />
      <input
        value={org}
        onChange={(e) => setOrg(e.target.value)}
        placeholder="target org (optional)"
        spellCheck={false}
      />
      <button type="submit">build street →</button>
    </form>
  );
}
