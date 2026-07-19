"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// Year-in-review poster — a shareable "Commit City Wrapped" card.

export default function WrappedPage() {
  const { username } = useParams();
  const [state, setState] = useState({ status: "loading" });
  const year = new Date().getFullYear();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/city/${encodeURIComponent(username)}`);
        const json = await res.json();
        if (!alive) return;
        setState(res.ok ? { status: "ready", data: json } : { status: "error" });
      } catch {
        if (alive) setState({ status: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [username]);

  async function downloadPoster() {
    const { user, city } = state.data;
    const a = city.analysis;
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#02040f";
    ctx.fillRect(0, 0, 1080, 1350);

    const skyline = new Image();
    await new Promise((resolve, reject) => {
      skyline.onload = resolve;
      skyline.onerror = reject;
      skyline.src = `/api/skyline/${encodeURIComponent(user.login)}`;
    });
    ctx.drawImage(skyline, 0, 250, 1080, 540);

    ctx.textAlign = "center";
    ctx.fillStyle = "#9aa7c7";
    ctx.font = "600 30px Outfit, sans-serif";
    ctx.fillText("COMMIT CITY", 540, 110);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 84px Outfit, sans-serif";
    ctx.fillText(`${year}`, 540, 200);
    ctx.fillStyle = "#f6c453";
    ctx.font = "700 40px Outfit, sans-serif";
    ctx.fillText(`@${user.login}`, 540, 850);

    const rows = [
      [`${city.towerCount}`, "towers raised"],
      [`${city.totalContributions.toLocaleString()}`, "contributions"],
      [`${a.totalStars.toLocaleString()}`, "stars collected"],
      [`${a.longestStreak}`, "longest streak"],
    ];
    rows.forEach(([num, label], i) => {
      const x = 165 + (i % 2) * 550;
      const y = 960 + Math.floor(i / 2) * 150;
      ctx.fillStyle = "#4da3ff";
      ctx.font = "800 56px Outfit, sans-serif";
      ctx.fillText(num, x + 105, y);
      ctx.fillStyle = "#9aa7c7";
      ctx.font = "500 26px Outfit, sans-serif";
      ctx.fillText(label, x + 105, y + 40);
    });

    ctx.fillStyle = "#5d6a8f";
    ctx.font = "500 24px Outfit, sans-serif";
    ctx.fillText("every project raises a tower", 540, 1290);

    canvas.toBlob((png) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(png);
      link.download = `${user.login}-commit-city-${year}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    });
  }

  if (state.status === "loading") {
    return (
      <main className="build-screen">
        <div className="build-icon">🎁</div>
        <h2>Printing the poster…</h2>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="build-screen">
        <div className="build-icon">🌫️</div>
        <h2>Couldn&apos;t print the poster</h2>
        <Link href={`/city/${username}`} className="back-pill solid">
          ← back to the city
        </Link>
      </main>
    );
  }

  const { user, city } = state.data;
  const a = city.analysis;

  return (
    <main className="wrapped-page">
      <div className="wrapped-actions">
        <Link href={`/city/${user.login}`} className="back-pill solid">
          ← back to the city
        </Link>
        <button className="report-btn" onClick={downloadPoster}>
          ⬇ download poster
        </button>
      </div>

      <div className="poster">
        <div className="poster-kicker">COMMIT CITY</div>
        <div className="poster-year">{year}</div>
        <img
          className="poster-skyline"
          src={`/api/skyline/${encodeURIComponent(user.login)}`}
          alt={`${user.login}'s skyline`}
        />
        <div className="poster-login">@{user.login}</div>
        <div className="poster-stats">
          <div>
            <span>{city.towerCount}</span>towers raised
          </div>
          <div>
            <span>{city.totalContributions.toLocaleString()}</span>contributions
          </div>
          <div>
            <span>{a.totalStars.toLocaleString()}</span>stars collected
          </div>
          <div>
            <span>{a.longestStreak}</span>longest streak
          </div>
        </div>
        <div className="poster-foot">every project raises a tower</div>
      </div>
    </main>
  );
}
