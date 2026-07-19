"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import CityScene from "../../../../components/CityScene";

// Compare mode — two skylines facing each other across the river,
// with a friendly stats face-off. No winners declared; two cities, one night.

export default function VersusPage() {
  const { a, b } = useParams();
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ra, rb] = await Promise.all([
          fetch(`/api/city/${encodeURIComponent(a)}`),
          fetch(`/api/city/${encodeURIComponent(b)}`),
        ]);
        const [ja, jb] = await Promise.all([ra.json(), rb.json()]);
        if (!alive) return;
        if (!ra.ok || !rb.ok) {
          setState({
            status: "error",
            message: !ra.ok
              ? `We couldn't find a city for "${a}".`
              : `We couldn't find a city for "${b}".`,
          });
        } else {
          setState({ status: "ready", left: ja, right: jb });
        }
      } catch {
        if (alive)
          setState({ status: "error", message: "Something went sideways. Try again." });
      }
    })();
    return () => {
      alive = false;
    };
  }, [a, b]);

  if (state.status === "loading") {
    return (
      <main className="build-screen">
        <div className="build-icon">🌉</div>
        <h2>
          Raising two skylines — {a} & {b}…
        </h2>
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
          ← start over
        </Link>
      </main>
    );
  }

  const { left, right } = state;
  const rows = [
    ["Towers", left.city.towerCount, right.city.towerCount],
    [
      "Contributions",
      left.city.totalContributions,
      right.city.totalContributions,
    ],
    [
      "Stars",
      left.city.analysis.totalStars,
      right.city.analysis.totalStars,
    ],
    [
      "Longest streak",
      left.city.analysis.longestStreak,
      right.city.analysis.longestStreak,
    ],
    [
      "Best day",
      left.city.analysis.bestDay.count,
      right.city.analysis.bestDay.count,
    ],
    [
      "Active repos (90d)",
      left.city.analysis.activeRepos,
      right.city.analysis.activeRepos,
    ],
  ];

  return (
    <main className="versus-page">
      <div className="versus-head">
        <Link href="/" className="back-pill">
          ← new skyline
        </Link>
        <h1>
          <span>{left.user.login}</span> · two cities, one river ·{" "}
          <span>{right.user.login}</span>
        </h1>
      </div>

      <CityBand data={left} />
      <CityBand data={right} flip />

      <div className="city-content">
        <div className="panel">
          <h3>Face-off</h3>
          <p className="sub">Side by side — no leaderboard, just two skylines.</p>
          <table className="versus-table">
            <thead>
              <tr>
                <th>
                  <Link href={`/city/${left.user.login}`}>@{left.user.login}</Link>
                </th>
                <th></th>
                <th>
                  <Link href={`/city/${right.user.login}`}>@{right.user.login}</Link>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, l, r]) => (
                <tr key={label}>
                  <td className={l >= r ? "lead" : ""}>{l.toLocaleString()}</td>
                  <td className="vs-label">{label}</td>
                  <td className={r >= l ? "lead" : ""}>{r.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="footer-note">Commit City · two cities, one night sky</p>
      </div>
    </main>
  );
}

function CityBand({ data, flip }) {
  return (
    <div className={`versus-band${flip ? " flip" : ""}`}>
      <CityScene
        seed={data.user.login.toLowerCase()}
        towers={data.city.towers}
        suburbs={data.city.suburbs}
        mood="clear"
        ambient={false}
        hero
      />
      <div className="band-tag">
        <img src={data.user.avatarUrl} alt="" />
        <span>
          @{data.user.login} · {data.city.towerCount} towers
        </span>
      </div>
    </div>
  );
}
