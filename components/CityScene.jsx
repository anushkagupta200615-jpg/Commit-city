"use client";

import { useMemo } from "react";
import { generateSkyline, mulberry32, hashString } from "../lib/citygen";

// New York at night. One tower per repository: height from stars,
// windows tinted by language district, glow from recent pushes.
// Fork suburbs line the edges, the city's mood shows as fireworks or
// fog, and a ferry, plane and shooting star keep the night alive.

const WATER_Y = 560;
const SILHOUETTES = ["#0c1430", "#0e1836", "#0a1128"];

export default function CityScene({
  seed,
  towers,
  suburbs = [],
  mood = "clear",
  svgRef,
  hero = false,
  ambient = true,
  onSelectTower,
}) {
  const buildings = useMemo(() => generateSkyline(seed, towers), [seed, towers]);

  const stars = useMemo(() => {
    const rng = mulberry32(hashString(seed + "-stars"));
    return Array.from({ length: 80 }, () => ({
      x: rng() * 1600,
      y: rng() * 400,
      r: 0.7 + rng() * 1.3,
      delay: rng() * 4,
      twinkle: rng() < 0.4,
    }));
  }, [seed]);

  const suburbBlocks = useMemo(() => {
    const rng = mulberry32(hashString(seed + "-suburbs"));
    return suburbs.map((s, i) => {
      const left = i % 2 === 0;
      const idx = Math.floor(i / 2);
      return {
        name: s.name,
        x: left ? 8 + idx * 40 : 1560 - idx * 40,
        w: 26 + rng() * 12,
        h: 38 + rng() * 46,
        lit: 0.25 + rng() * 0.2,
        seed: Math.floor(rng() * 1e9),
      };
    });
  }, [seed, suburbs]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1600 800"
      preserveAspectRatio={hero ? "xMidYMax slice" : "xMidYMid meet"}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Night skyline generated from GitHub repositories"
      style={hero ? { width: "100%", height: "100%", display: "block" } : undefined}
    >
      <defs>
        <linearGradient id="nightsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#02040f" />
          <stop offset="70%" stopColor="#0a1230" />
          <stop offset="100%" stopColor="#182a5c" />
        </linearGradient>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#101d42" />
          <stop offset="100%" stopColor="#020409" />
        </linearGradient>
        <linearGradient id="waterfade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#020409" stopOpacity="0" />
          <stop offset="100%" stopColor="#020409" stopOpacity="0.95" />
        </linearGradient>
        <filter id="refblur" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="softglow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* sky */}
      <rect width="1600" height={WATER_Y} fill="url(#nightsky)" />

      {/* stars */}
      <g fill="#dfe8ff">
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            className={s.twinkle ? "twinkle" : undefined}
            style={s.twinkle ? { animationDelay: `${s.delay}s` } : undefined}
            opacity={s.twinkle ? undefined : 0.55}
          />
        ))}
      </g>

      {/* shooting star */}
      {ambient && (
        <line
          className="shooting-star"
          x1="0"
          y1="0"
          x2="70"
          y2="26"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}

      {/* moon */}
      <circle cx="1330" cy="110" r="60" fill="#f4f1e0" opacity="0.12" filter="url(#softglow)" />
      <circle cx="1330" cy="110" r="38" fill="#f2eeda" />
      <circle cx="1318" cy="100" r="7" fill="#e3ddc2" opacity="0.6" />
      <circle cx="1342" cy="122" r="5" fill="#e3ddc2" opacity="0.5" />

      {/* plane crossing the sky */}
      {ambient && (
        <g className="plane-move">
          <g transform="translate(0 62)">
            <rect x="-16" y="-2.5" width="32" height="5" rx="2.5" fill="#8fa4cc" />
            <polygon points="-2,-2 8,-12 12,-2" fill="#8fa4cc" />
            <circle cx="18" cy="0" r="3" fill="#ff6b6b" className="twinkle" />
          </g>
        </g>
      )}

      {/* horizon glow behind the skyline */}
      <ellipse cx="800" cy={WATER_Y} rx="900" ry="140" fill="#2b4a8f" opacity="0.25" filter="url(#softglow)" />

      {/* fireworks over downtown */}
      {mood === "fireworks" && (
        <g>
          {[
            [560, 180, "#f6c453", 0],
            [860, 130, "#ff7ad9", 0.9],
            [1080, 210, "#4da3ff", 1.7],
          ].map(([x, y, c, d], i) => (
            <g
              key={i}
              className="firework"
              style={{ animationDelay: `${d}s`, transformOrigin: `${x}px ${y}px` }}
            >
              {Array.from({ length: 10 }).map((_, k) => {
                const a = (k / 10) * Math.PI * 2;
                return (
                  <line
                    key={k}
                    x1={x + 10 * Math.cos(a)}
                    y1={y + 10 * Math.sin(a)}
                    x2={x + 34 * Math.cos(a)}
                    y2={y + 34 * Math.sin(a)}
                    stroke={c}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          ))}
        </g>
      )}

      {/* fork suburbs — low-rises behind the main skyline */}
      <g opacity="0.85">
        {suburbBlocks.map((s, i) => (
          <SuburbBlock key={i} s={s} />
        ))}
      </g>

      {/* skyline */}
      <g id="skyline">
        {buildings.map((b, i) => (
          <Building key={b.name || i} b={b} onSelectTower={onSelectTower} />
        ))}
      </g>

      {/* river */}
      <rect x="0" y={WATER_Y} width="1600" height={800 - WATER_Y} fill="url(#water)" />

      {/* mirrored skyline in the water */}
      <use
        href="#skyline"
        transform={`matrix(1 0 0 -1 0 ${WATER_Y * 2})`}
        opacity="0.28"
        filter="url(#refblur)"
      />

      {/* colored light streaks under landmark spires */}
      {buildings
        .filter((b) => b.landmarkColor)
        .map((b, i) => (
          <rect
            key={i}
            x={b.x + b.w / 2 - 6}
            y={WATER_Y + 6}
            width="12"
            height="170"
            fill={b.landmarkColor}
            opacity="0.3"
            filter="url(#refblur)"
          />
        ))}

      {/* fade the reflection into deep water */}
      <rect x="0" y={WATER_Y + 60} width="1600" height={800 - WATER_Y - 60} fill="url(#waterfade)" />

      {/* ferry crossing the river */}
      {ambient && (
        <g className="ferry-move">
          <g transform="translate(0 640)">
            <path d="M -34 0 L 34 0 L 24 14 L -24 14 Z" fill="#131c38" />
            <rect x="-20" y="-12" width="40" height="12" rx="3" fill="#1d2a52" />
            {[-12, -2, 8].map((wx) => (
              <rect key={wx} x={wx} y="-9" width="6" height="6" rx="1" fill="#f7d789" />
            ))}
            <circle cx="26" cy="-10" r="2.5" fill="#7ee0a3" />
            <rect x="-30" y="16" width="60" height="5" rx="2.5" fill="#f7d789" opacity="0.12" />
          </g>
        </g>
      )}

      {/* fog rolling over the river */}
      {mood === "fog" && (
        <g fill="#c9d4ee">
          <ellipse className="fog-drift" cx="380" cy="560" rx="330" ry="46" opacity="0.14" filter="url(#softglow)" />
          <ellipse className="fog-drift-slow" cx="900" cy="600" rx="420" ry="54" opacity="0.12" filter="url(#softglow)" />
          <ellipse className="fog-drift" cx="1330" cy="545" rx="300" ry="40" opacity="0.13" filter="url(#softglow)" />
        </g>
      )}

      {/* water shimmer */}
      <g stroke="#c9d8ff" strokeWidth="1.5" opacity="0.08">
        {[590, 620, 655, 700, 745].map((y, i) => (
          <line key={y} x1={80 + i * 140} y1={y} x2={520 + i * 190} y2={y} />
        ))}
      </g>
    </svg>
  );
}

function SuburbBlock({ s }) {
  const top = WATER_Y - s.h;
  const windows = [];
  const rng = mulberry32(s.seed);
  const cols = Math.max(1, Math.floor((s.w - 8) / 12));
  const rows = Math.max(1, Math.floor((s.h - 10) / 16));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() < s.lit) {
        windows.push({ x: s.x + 5 + c * 12, y: top + 7 + r * 16 });
      }
    }
  }
  return (
    <g>
      <title>{`${s.name} (fork)`}</title>
      <rect x={s.x} y={top} width={s.w} height={s.h} fill="#081020" />
      {windows.map((w, i) => (
        <rect key={i} x={w.x} y={w.y} width="5" height="7" rx="1" fill="#c9a75e" opacity="0.7" />
      ))}
    </g>
  );
}

function Building({ b, onSelectTower }) {
  const top = WATER_Y - b.h;
  const fill = SILHOUETTES[b.shade];
  const cx = b.x + b.w / 2;
  const warm = b.windowColor || "#f7d789";

  const windows = useMemo(() => {
    const rng = mulberry32(b.seed);
    const cols = Math.max(1, Math.floor((b.w - 10) / 13));
    const rows = Math.max(2, Math.floor((b.h - 16) / 18));
    const lit = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const roll = rng();
        if (roll < b.lit) {
          lit.push({
            x: b.x + 6 + c * 13,
            y: top + 10 + r * 18,
            cool: roll < b.lit * 0.15,
          });
        }
      }
    }
    return lit;
  }, [b, top]);

  const body = (
    <g
      className={b.url ? "tower" : undefined}
      onClick={onSelectTower && b.url ? () => onSelectTower(b) : undefined}
    >
      {(b.name || b.stars > 0) && (
        <title>
          {b.name ? `${b.name} · ★ ${b.stars.toLocaleString()}` : ""}
          {b.language ? ` · ${b.language}` : ""}
        </title>
      )}

      {b.setback && (
        <rect
          x={cx - b.w * 0.28}
          y={top - b.h * 0.16}
          width={b.w * 0.56}
          height={b.h * 0.2}
          fill={fill}
        />
      )}

      <rect x={b.x} y={top} width={b.w} height={b.h} fill={fill} />

      <g>
        {windows.map((w, i) => (
          <rect
            key={i}
            x={w.x}
            y={w.y}
            width="6"
            height="9"
            rx="1"
            fill={w.cool ? "#bcd4ff" : warm}
            opacity="0.92"
          />
        ))}
      </g>

      {b.antenna && (
        <g>
          <line
            x1={cx}
            y1={b.setback ? top - b.h * 0.16 : top}
            x2={cx}
            y2={(b.setback ? top - b.h * 0.16 : top) - 34}
            stroke="#3a4a7a"
            strokeWidth="3"
          />
          <circle
            cx={cx}
            cy={(b.setback ? top - b.h * 0.16 : top) - 36}
            r="3.5"
            fill="#ff6b6b"
            className="twinkle"
          />
        </g>
      )}

      {b.landmarkColor && (
        <g>
          <rect x={b.x} y={top} width={b.w} height="14" fill={b.landmarkColor} opacity="0.55" />
          <rect x={cx - 3} y={top - 56} width="6" height="56" fill={b.landmarkColor} />
          <circle cx={cx} cy={top - 60} r="10" fill={b.landmarkColor} opacity="0.35" filter="url(#softglow)" />
          <circle cx={cx} cy={top - 60} r="4.5" fill="#ffffff" />
        </g>
      )}
    </g>
  );

  if (onSelectTower) return body;

  return b.url ? (
    <a href={b.url} target="_blank" rel="noreferrer">
      {body}
    </a>
  ) : (
    body
  );
}
