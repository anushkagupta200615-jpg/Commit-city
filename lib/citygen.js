// Deterministic skyline generation — shared by server and client.
// Each tower represents one repository: height from stars,
// window glow from how recently it was pushed.

export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// items: [{ name, stars, recency (0..1), landmarkColor?, url?, language? }]
// Returns positioned buildings with the tallest towers downtown (center).
export function generateSkyline(seedStr, items) {
  const n = items.length;
  if (n === 0) return [];
  const rng = mulberry32(hashString(seedStr));
  const maxStars = Math.max(1, ...items.map((i) => i.stars));

  const sized = items.map((it) => {
    const starScale = Math.log(it.stars + 1) / Math.log(maxStars + 2);
    const h = Math.min(
      470,
      Math.round(95 + 300 * starScale + 50 * it.recency + rng() * 45)
    );
    return {
      ...it,
      h,
      lit: Math.min(0.9, 0.22 + 0.58 * it.recency + rng() * 0.08),
      seed: Math.floor(rng() * 1e9),
      antenna: !it.landmarkColor && rng() < 0.2,
      shade: Math.floor(rng() * 3),
      setback: rng() < 0.35,
    };
  });

  // Tallest towers get the most central lots — Manhattan silhouette.
  sized.sort((a, b) => b.h - a.h);
  const center = (n - 1) / 2;
  const lots = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => Math.abs(a - center) - Math.abs(b - center)
  );

  const slot = 1600 / n;
  return sized.map((b, rank) => {
    const lot = lots[rank];
    const w = Math.max(26, Math.min(130, slot * (0.95 + rng() * 0.7)));
    const x = lot * slot + (rng() - 0.5) * slot * 0.3;
    return { ...b, x: Math.round(x), w: Math.round(w) };
  });
}
