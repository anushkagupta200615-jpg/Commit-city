// Turns raw GitHub data into the city model.
// One tower per repository: height from stars, glow from recent pushes.
// Windows are tinted by language district. Plus deep analysis:
// records, districts, rhythm, momentum, heatmap, yearly growth.

const LANDMARK_COLORS = ["#4da3ff", "#b17aff", "#ff7ad9"];
export const LANG_COLORS = [
  "#f6c453", "#4da3ff", "#ff7ad9", "#7ee0a3", "#b17aff", "#ff9c6b",
];
const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function buildCityModel(data) {
  const ownRepos = data.repos.filter((r) => !r.fork);

  // ---- landmarks: top 3 by stars ----
  const topByStars = [...ownRepos].sort((a, b) => b.stars - a.stars);
  const landmarkNames = new Map(
    topByStars.slice(0, 3).map((r, i) => [r.name, LANDMARK_COLORS[i]])
  );

  // ---- districts: language breakdown ----
  const langCounts = new Map();
  for (const r of ownRepos) {
    if (!r.language) continue;
    langCounts.set(r.language, (langCounts.get(r.language) || 0) + 1);
  }
  const langTotal = [...langCounts.values()].reduce((a, b) => a + b, 0) || 1;
  const districts = [...langCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count], i) => ({
      name,
      count,
      pct: Math.round((count / langTotal) * 100),
      color: LANG_COLORS[i % LANG_COLORS.length],
    }));
  const districtColor = new Map(districts.map((d) => [d.name, d.color]));

  // ---- towers: one per project ----
  const towers = ownRepos.slice(0, 100).map((r) => ({
    name: r.name,
    stars: r.stars,
    forks: r.forks || 0,
    language: r.language,
    description: r.description,
    url: r.url,
    createdYear: r.createdAt ? Number(r.createdAt.slice(0, 4)) : null,
    pushedAt: r.pushedAt,
    recency: recencyScore(r.pushedAt),
    landmarkColor: landmarkNames.get(r.name) || null,
    windowColor: districtColor.get(r.language) || "#f7d789",
  }));

  const landmarks = topByStars.slice(0, 3).map((r, i) => ({
    name: r.name,
    stars: r.stars,
    description: r.description,
    language: r.language,
    url: r.url,
    color: LANDMARK_COLORS[i],
  }));

  // ---- fork suburbs: low-rises across the river's edges ----
  const suburbs = data.repos
    .filter((r) => r.fork)
    .slice(0, 14)
    .map((r) => ({ name: r.name }));

  // ---- contribution days (drop padded future dates) ----
  const today = new Date().toISOString().slice(0, 10);
  const days = data.contributions.days
    .filter((d) => d.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  let currentStreak = 0;
  for (let i = 0; i < days.length; i++) {
    if (days[i].count > 0) currentStreak++;
    else if (i === 0) continue;
    else break;
  }

  let longestStreak = 0;
  let run = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) {
      run++;
      if (run > longestStreak) longestStreak = run;
    } else run = 0;
  }

  let bestDay = { date: null, count: 0 };
  for (const d of days) if (d.count > bestDay.count) bestDay = d;

  const weekdayTotals = Array(7).fill(0);
  let weekendSum = 0;
  let activeDayCount = 0;
  let activeSum = 0;
  for (const d of days) {
    const dow = new Date(d.date + "T00:00:00Z").getUTCDay();
    weekdayTotals[dow] += d.count;
    if (dow === 0 || dow === 6) weekendSum += d.count;
    if (d.count > 0) {
      activeDayCount++;
      activeSum += d.count;
    }
  }
  const busiestDow = weekdayTotals.indexOf(Math.max(...weekdayTotals));
  const totalCounted = weekdayTotals.reduce((a, b) => a + b, 0) || 1;

  const monthTotals = Array(12).fill(0);
  for (const d of days) monthTotals[Number(d.date.slice(5, 7)) - 1] += d.count;
  const busiestMonth = monthTotals.indexOf(Math.max(...monthTotals));

  const activeDaysLastYear = days.filter(
    (d) => daysAgo(d.date) <= 365 && d.count > 0
  ).length;
  const last30 = days.slice(0, 30).reduce((s, d) => s + d.count, 0);

  // ---- momentum: last 90 days vs the 90 before ----
  const last90 = days.slice(0, 90).reduce((s, d) => s + d.count, 0);
  const prev90 = days.slice(90, 180).reduce((s, d) => s + d.count, 0);
  const momentumPct =
    prev90 > 0
      ? Math.round(((last90 - prev90) / prev90) * 100)
      : last90 > 0
        ? 100
        : 0;

  // ---- mood of the city ----
  const mood =
    currentStreak >= 7 || last30 >= 40
      ? "fireworks"
      : last30 <= 3
        ? "fog"
        : "clear";

  // ---- heatmap: last 52 weeks, oldest first ----
  const heatmap = days
    .slice(0, 364)
    .map((d) => ({ date: d.date, count: d.count, level: d.level ?? 0 }))
    .reverse();

  // ---- yearly growth ----
  const years = Object.entries(data.contributions.years)
    .map(([year, total]) => ({ year, total }))
    .sort((a, b) => (a.year < b.year ? -1 : 1));

  const totalStars = ownRepos.reduce((s, r) => s + r.stars, 0);
  const totalForks = ownRepos.reduce((s, r) => s + (r.forks || 0), 0);
  const activeRepos = ownRepos.filter(
    (r) => r.pushedAt && daysAgo(r.pushedAt) <= 90
  ).length;
  const avgPerActiveDay =
    activeDayCount > 0 ? Math.round((activeSum / activeDayCount) * 10) / 10 : 0;
  const weekendPct = Math.round((weekendSum / totalCounted) * 100);

  // ---- rhythm: narrative one-liners ----
  const rhythm = [];
  rhythm.push(
    `${WEEKDAYS[busiestDow]}s are when this city works hardest, and ${weekendPct}% of all construction happens on weekends.`
  );
  rhythm.push(
    avgPerActiveDay >= 10
      ? `When the crews show up, they pour concrete: ${avgPerActiveDay} contributions per active day.`
      : `Steady, methodical construction: ${avgPerActiveDay} contributions on a typical active day.`
  );
  if (bestDay.date) {
    rhythm.push(
      `The wildest night on record: ${bestDay.count} contributions on ${formatDate(bestDay.date)}.`
    );
  }
  rhythm.push(
    momentumPct >= 15
      ? `The city is booming — activity is up ${momentumPct}% over the previous quarter.`
      : momentumPct <= -15
        ? `A quiet season downtown — activity is ${Math.abs(momentumPct)}% below the previous quarter.`
        : `Construction pace is steady quarter over quarter (${momentumPct >= 0 ? "+" : ""}${momentumPct}%).`
  );

  return {
    totalContributions: data.contributions.total,
    towerCount: towers.length,
    towers,
    suburbs,
    landmarks,
    currentStreak,
    last30,
    mood,
    momentum: { last90, prev90, pct: momentumPct },
    heatmap,
    analysis: {
      longestStreak,
      bestDay,
      busiestWeekday: WEEKDAYS[busiestDow],
      busiestMonth: MONTHS[busiestMonth],
      weekendPct,
      avgPerActiveDay,
      activeDaysLastYear,
      totalStars,
      totalForks,
      activeRepos,
      followers: data.user.followers,
      accountAgeYears:
        Math.round(
          ((Date.now() - new Date(data.user.createdAt).getTime()) /
            (365.25 * 86400000)) * 10
        ) / 10,
      districts,
      years,
      rhythm,
    },
  };
}

function recencyScore(pushedAt) {
  if (!pushedAt) return 0;
  const age = daysAgo(pushedAt);
  if (age <= 7) return 1;
  if (age <= 30) return 0.8;
  if (age <= 90) return 0.55;
  if (age <= 180) return 0.35;
  if (age <= 365) return 0.18;
  return 0.06;
}

function daysAgo(dateStr) {
  return (Date.now() - new Date(dateStr).getTime()) / 86400000;
}

function formatDate(iso) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
