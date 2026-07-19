"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CityScene from "../components/CityScene";

const EXAMPLES = ["torvalds", "gaearon", "sindresorhus"];

// Synthetic towers for the landing backdrop — shaped like a lively
// account: a few stars-heavy landmarks, many small active projects.
const DEMO_TOWERS = Array.from({ length: 46 }, (_, i) => ({
  name: "",
  stars: [820, 540, 390][i] ?? Math.round(Math.pow(1.18, 46 - i)),
  recency: ((i * 7) % 10) / 10,
  landmarkColor: ["#4da3ff", "#b17aff", "#ff7ad9"][i] || null,
}));

export default function Landing() {
  const [input, setInput] = useState("");
  const [going, setGoing] = useState(false);
  const [featured, setFeatured] = useState([]);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    (async () => {
      const loaded = [];
      for (const u of EXAMPLES) {
        try {
          const res = await fetch(`/api/city/${u}`);
          if (!res.ok) continue;
          const json = await res.json();
          loaded.push(json);
          if (alive) setFeatured([...loaded]);
        } catch {}
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function go(username) {
    const u = (username || input).trim().replace(/^@/, "");
    if (!u) return;
    setGoing(true);
    router.push(`/city/${encodeURIComponent(u)}`);
  }

  return (
    <main className="landing">
      <div className="landing-backdrop">
        <CityScene seed="new-york-city" towers={DEMO_TOWERS} hero />
      </div>
      <div className="landing-haze" />

      <div className="landing-content">
        <div className="landing-badge">🏙️ every project raises a tower</div>
        <h1 className="landing-title">
          Commit <span>City</span>
        </h1>
        <p className="landing-tag">
          Your GitHub, rendered as the New York skyline at night. Every public
          project raises a tower, stars push it higher, recent pushes light the
          windows — and your top repos crown the landmarks.
        </p>

        <form
          className="landing-search"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="github username"
            spellCheck={false}
            autoFocus
          />
          <button type="submit" disabled={going}>
            {going ? "Flying in…" : "Build my skyline →"}
          </button>
        </form>

        <div className="landing-examples">
          <span>or visit:</span>
          {EXAMPLES.map((u) => (
            <button key={u} className="example-chip" onClick={() => go(u)}>
              {u}
            </button>
          ))}
        </div>

        {featured.length > 0 && (
          <div className="featured-row">
            {featured.map((f) => (
              <Link
                key={f.user.login}
                href={`/city/${f.user.login}`}
                className="featured-card"
              >
                <div className="featured-scene">
                  <CityScene
                    seed={f.user.login.toLowerCase()}
                    towers={f.city.towers}
                    ambient={false}
                  />
                </div>
                <span>
                  @{f.user.login} · {f.city.towerCount} towers
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
