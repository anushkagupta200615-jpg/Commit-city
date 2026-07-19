// Program calendars, comparison data, stipends, readiness-plan and
// .ics generation for GSoC, LFX Mentorship, and Outreachy.
//
// Dates are RECURRING APPROXIMATIONS based on each program's typical
// yearly rhythm — the UI labels them "≈ approximate" and links to the
// official pages, which are always the source of truth.

export const PROGRAMS = [
  {
    id: "gsoc",
    name: "Google Summer of Code",
    short: "GSoC",
    url: "https://summerofcode.withgoogle.com/",
    who: "Anyone 18+ who is new to open source — students AND non-students.",
    commitment: "~12 weeks · 90h (small), 175h (medium) or 350h (large), flexible hours",
    stipend: "$750 – $6,600 depending on project size and your country",
    cadence: "Once a year — contributor applications around late March",
    contribution:
      "Not formally required, but merged PRs to your target org before applying are the #1 success factor.",
  },
  {
    id: "lfx",
    name: "LFX Mentorship (Linux Foundation)",
    short: "LFX",
    url: "https://mentorship.lfx.linuxfoundation.org/",
    who: "Anyone who meets the per-project prerequisites — no student requirement.",
    commitment: "~12 weeks, full-time or part-time depending on the project",
    stipend: "$3,000 – $6,600 depending on your region",
    cadence: "Three terms a year — Spring, Summer, and Fall",
    contribution:
      "Each project lists its own prerequisite tasks — completing them well is effectively the interview.",
  },
  {
    id: "outreachy",
    name: "Outreachy",
    short: "Outreachy",
    url: "https://www.outreachy.org/",
    who: "People 18+ from groups underrepresented in tech (strict eligibility rules — check the site).",
    commitment: "13 weeks, full-time (30+ hrs/week) — you cannot have another full-time commitment",
    stipend: "$7,000 flat (paid in installments) + $500 travel stipend",
    cadence: "Two cohorts a year — May and December",
    contribution:
      "REQUIRED: you must record contributions to your chosen project during the contribution period to be eligible for selection.",
  },
];

// Recurring yearly milestones (month is 1-based). Approximate by design.
export const MILESTONES = [
  { program: "GSoC", label: "Mentoring organizations announced", m: 2, d: 21, url: "https://summerofcode.withgoogle.com/" },
  { program: "GSoC", label: "Contributor applications open", m: 3, d: 24, url: "https://summerofcode.withgoogle.com/" },
  { program: "GSoC", label: "Application deadline", m: 4, d: 2, url: "https://summerofcode.withgoogle.com/" },
  { program: "GSoC", label: "Accepted contributors announced", m: 5, d: 8, url: "https://summerofcode.withgoogle.com/" },
  { program: "GSoC", label: "Coding period begins", m: 6, d: 2, url: "https://summerofcode.withgoogle.com/" },
  { program: "Outreachy", label: "Initial applications open (May cohort)", m: 1, d: 15, url: "https://www.outreachy.org/apply/" },
  { program: "Outreachy", label: "Contribution period begins (May cohort)", m: 3, d: 5, url: "https://www.outreachy.org/apply/" },
  { program: "Outreachy", label: "Internships begin (May cohort)", m: 5, d: 29, url: "https://www.outreachy.org/" },
  { program: "Outreachy", label: "Initial applications open (Dec cohort)", m: 8, d: 18, url: "https://www.outreachy.org/apply/" },
  { program: "Outreachy", label: "Contribution period begins (Dec cohort)", m: 10, d: 8, url: "https://www.outreachy.org/apply/" },
  { program: "Outreachy", label: "Internships begin (Dec cohort)", m: 12, d: 1, url: "https://www.outreachy.org/" },
  { program: "LFX", label: "Spring term applications open", m: 1, d: 29, url: "https://mentorship.lfx.linuxfoundation.org/" },
  { program: "LFX", label: "Summer term applications open", m: 4, d: 29, url: "https://mentorship.lfx.linuxfoundation.org/" },
  { program: "LFX", label: "Fall term applications open", m: 7, d: 15, url: "https://mentorship.lfx.linuxfoundation.org/" },
];

// Application windows (for "OPEN NOW" detection).
export const WINDOWS = [
  { program: "GSoC", label: "Contributor applications", startM: 3, startD: 24, endM: 4, endD: 2 },
  { program: "LFX", label: "Spring term applications", startM: 1, startD: 29, endM: 2, endD: 26 },
  { program: "LFX", label: "Summer term applications", startM: 4, startD: 29, endM: 5, endD: 27 },
  { program: "LFX", label: "Fall term applications", startM: 7, startD: 15, endM: 8, endD: 12 },
  { program: "Outreachy", label: "Initial applications (May cohort)", startM: 1, startD: 15, endM: 2, endD: 6 },
  { program: "Outreachy", label: "Initial applications (Dec cohort)", startM: 8, startD: 18, endM: 9, endD: 8 },
];

export const STIPENDS = [
  { program: "GSoC", detail: "United States", amount: "$3,300 medium / $6,600 large" },
  { program: "GSoC", detail: "India, Brazil, Nigeria (PPP-adjusted)", amount: "$1,500 medium / $3,000 large" },
  { program: "GSoC", detail: "Small project (any country)", amount: "$750 – $1,650" },
  { program: "LFX", detail: "Varies by region", amount: "$3,000 – $6,600" },
  { program: "Outreachy", detail: "All interns, worldwide", amount: "$7,000 + $500 travel" },
];

function nextOccurrence(m, d, now) {
  const thisYear = new Date(now.getFullYear(), m - 1, d);
  if (thisYear >= now) return thisYear;
  return new Date(now.getFullYear() + 1, m - 1, d);
}

export function upcomingMilestones(now = new Date(), count = 8) {
  return MILESTONES.map((ms) => ({
    ...ms,
    date: nextOccurrence(ms.m, ms.d, now),
  }))
    .sort((a, b) => a.date - b.date)
    .slice(0, count)
    .map((ms) => ({
      ...ms,
      daysAway: Math.ceil((ms.date - now) / 86400000),
    }));
}

export function openWindows(now = new Date()) {
  const y = now.getFullYear();
  return WINDOWS.filter((w) => {
    const start = new Date(y, w.startM - 1, w.startD);
    const end = new Date(y, w.endM - 1, w.endD, 23, 59);
    return now >= start && now <= end;
  });
}

// The next application-style deadline across all programs.
export function nextApplicationDeadline(now = new Date()) {
  const deadlines = WINDOWS.map((w) => ({
    program: w.program,
    label: w.label,
    date: (() => {
      const end = new Date(now.getFullYear(), w.endM - 1, w.endD, 23, 59);
      if (end >= now) return end;
      return new Date(now.getFullYear() + 1, w.endM - 1, w.endD, 23, 59);
    })(),
  })).sort((a, b) => a.date - b.date);
  return deadlines[0];
}

// A week-by-week readiness plan working backward from the next deadline.
export function buildPlan(now = new Date()) {
  const deadline = nextApplicationDeadline(now);
  const weeks = Math.max(1, Math.ceil((deadline.date - now) / (7 * 86400000)));

  const phases = [];
  if (weeks > 8) {
    phases.push({
      title: `Explore (now → ${weeks - 8} week${weeks - 8 === 1 ? "" : "s"} in)`,
      items: [
        "Shortlist 2–3 organizations whose tech stack matches your districts.",
        "Join each org's chat (Zulip / Slack / Discord / mailing list) and introduce yourself.",
        "Set up each project's dev environment and get the test suite running.",
        "Read recent merged PRs to learn each org's code style and review culture.",
      ],
    });
  }
  phases.push({
    title: weeks > 3 ? "Contribute (the middle weeks)" : "Contribute (now!)",
    items: [
      "Land 2–3 small PRs per target org — docs fixes and good-first-issues absolutely count.",
      "Comment helpfully on other people's issues; visibility with maintainers matters.",
      "Outreachy: record every contribution on the Outreachy site during the contribution period.",
      "Keep your streak alive — mentors do look at recent activity.",
    ],
  });
  phases.push({
    title: `Propose (final 2 weeks before ${deadline.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`,
    items: [
      "Pick ONE project idea per org and discuss it with a mentor before writing.",
      "Draft your proposal: synopsis, deliverables, weekly timeline, and why you.",
      "Get feedback from the org's channel, revise, and submit 2–3 days early.",
      "Link your merged PRs prominently — they are your strongest evidence.",
    ],
  });

  return { deadline, weeks, phases };
}

// Minimal RFC 5545 calendar for the next milestones.
export function buildIcs(milestones) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Commit City//Mentorship Deadlines//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const ms of milestones) {
    const d = ms.date;
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ms.program}-${ymd}@commit-city`,
      `DTSTART;VALUE=DATE:${ymd}`,
      `SUMMARY:${ms.program}: ${ms.label} (approximate)`,
      `DESCRIPTION:Approximate date based on ${ms.program}'s usual schedule — confirm at ${ms.url}`,
      `URL:${ms.url}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
