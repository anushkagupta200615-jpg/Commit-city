// Server-side SVG string renderer for embeds and OG images.
// Mirrors CityScene's look without React: sky, stars, moon,
// skyline with tinted windows, landmark spires, water reflection.

import { generateSkyline, mulberry32, hashString } from "./citygen";

const WATER_Y = 560;
const SILHOUETTES = ["#0c1430", "#0e1836", "#0a1128"];

export function renderSkylineSvg({ seed, towers, label = "", animate = true }) {
  const buildings = generateSkyline(seed, towers);
  const rng = mulberry32(hashString(seed + "-stars"));
  const parts = [];

  parts.push(
    `<svg viewBox="0 0 1600 800" width="1600" height="800" xmlns="http://www.w3.org/2000/svg" role="img">`
  );
  parts.push(`<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#02040f"/><stop offset="70%" stop-color="#0a1230"/><stop offset="100%" stop-color="#182a5c"/>
    </linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#101d42"/><stop offset="100%" stop-color="#020409"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#020409" stop-opacity="0"/><stop offset="100%" stop-color="#020409" stop-opacity="0.95"/>
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="glow" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>`);

  if (animate) {
    parts.push(`<style>
      .tw { animation: tw 3.2s ease-in-out infinite; }
      @keyframes tw { 0%,100% { opacity: 0.25; } 50% { opacity: 1; } }
    </style>`);
  }

  parts.push(`<rect width="1600" height="${WATER_Y}" fill="url(#sky)"/>`);

  // stars
  for (let i = 0; i < 80; i++) {
    const x = (rng() * 1600).toFixed(1);
    const y = (rng() * 400).toFixed(1);
    const r = (0.7 + rng() * 1.3).toFixed(2);
    const tw = rng() < 0.4 && animate;
    parts.push(
      `<circle cx="${x}" cy="${y}" r="${r}" fill="#dfe8ff" ${
        tw ? `class="tw" style="animation-delay:${(rng() * 4).toFixed(1)}s"` : `opacity="0.55"`
      }/>`
    );
  }

  // moon
  parts.push(`<circle cx="1330" cy="110" r="60" fill="#f4f1e0" opacity="0.12" filter="url(#glow)"/>
  <circle cx="1330" cy="110" r="38" fill="#f2eeda"/>
  <circle cx="1318" cy="100" r="7" fill="#e3ddc2" opacity="0.6"/>
  <circle cx="1342" cy="122" r="5" fill="#e3ddc2" opacity="0.5"/>
  <ellipse cx="800" cy="${WATER_Y}" rx="900" ry="140" fill="#2b4a8f" opacity="0.25" filter="url(#glow)"/>`);

  // skyline
  parts.push(`<g id="sl">`);
  for (const b of buildings) {
    parts.push(renderBuilding(b));
  }
  parts.push(`</g>`);

  // water + reflection
  parts.push(`<rect x="0" y="${WATER_Y}" width="1600" height="${800 - WATER_Y}" fill="url(#water)"/>`);
  parts.push(
    `<use href="#sl" transform="matrix(1 0 0 -1 0 ${WATER_Y * 2})" opacity="0.28" filter="url(#blur)"/>`
  );
  for (const b of buildings) {
    if (!b.landmarkColor) continue;
    parts.push(
      `<rect x="${b.x + b.w / 2 - 6}" y="${WATER_Y + 6}" width="12" height="170" fill="${b.landmarkColor}" opacity="0.3" filter="url(#blur)"/>`
    );
  }
  parts.push(
    `<rect x="0" y="${WATER_Y + 60}" width="1600" height="${800 - WATER_Y - 60}" fill="url(#fade)"/>`
  );

  if (label) {
    parts.push(
      `<text x="40" y="768" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" fill="#9aa7c7">${escapeXml(label)}</text>`
    );
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}

function renderBuilding(b) {
  const top = WATER_Y - b.h;
  const fill = SILHOUETTES[b.shade];
  const cx = b.x + b.w / 2;
  const warm = b.windowColor || "#f7d789";
  const out = [`<g>`];

  if (b.setback) {
    out.push(
      `<rect x="${(cx - b.w * 0.28).toFixed(1)}" y="${(top - b.h * 0.16).toFixed(1)}" width="${(b.w * 0.56).toFixed(1)}" height="${(b.h * 0.2).toFixed(1)}" fill="${fill}"/>`
    );
  }
  out.push(`<rect x="${b.x}" y="${top}" width="${b.w}" height="${b.h}" fill="${fill}"/>`);

  const rng = mulberry32(b.seed);
  const cols = Math.max(1, Math.floor((b.w - 10) / 13));
  const rows = Math.max(2, Math.floor((b.h - 16) / 18));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const roll = rng();
      if (roll < b.lit) {
        const color = roll < b.lit * 0.15 ? "#bcd4ff" : warm;
        out.push(
          `<rect x="${b.x + 6 + c * 13}" y="${top + 10 + r * 18}" width="6" height="9" rx="1" fill="${color}" opacity="0.92"/>`
        );
      }
    }
  }

  if (b.antenna) {
    const ay = b.setback ? top - b.h * 0.16 : top;
    out.push(
      `<line x1="${cx}" y1="${ay}" x2="${cx}" y2="${ay - 34}" stroke="#3a4a7a" stroke-width="3"/>` +
        `<circle cx="${cx}" cy="${ay - 36}" r="3.5" fill="#ff6b6b"/>`
    );
  }

  if (b.landmarkColor) {
    out.push(
      `<rect x="${b.x}" y="${top}" width="${b.w}" height="14" fill="${b.landmarkColor}" opacity="0.55"/>` +
        `<rect x="${cx - 3}" y="${top - 56}" width="6" height="56" fill="${b.landmarkColor}"/>` +
        `<circle cx="${cx}" cy="${top - 60}" r="10" fill="${b.landmarkColor}" opacity="0.35" filter="url(#glow)"/>` +
        `<circle cx="${cx}" cy="${top - 60}" r="4.5" fill="#ffffff"/>`
    );
  }

  out.push(`</g>`);
  return out.join("");
}

function escapeXml(s) {
  return s.replace(/[<>&"']/g, (c) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[c]);
}
