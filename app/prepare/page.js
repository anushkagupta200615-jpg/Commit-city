"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import RichText from "../../components/RichText";
import {
  PROGRAMS,
  STIPENDS,
  upcomingMilestones,
  openWindows,
  buildPlan,
  buildIcs,
} from "../../lib/mentorshipData";

// Mentorship HQ — deadlines, eligibility, planning and proposal help
// for students targeting GSoC, LFX Mentorship, and Outreachy.

export default function PreparePage() {
  const now = useMemo(() => new Date(), []);
  const milestones = useMemo(() => upcomingMilestones(now, 8), [now]);
  const open = useMemo(() => openWindows(now), [now]);
  const plan = useMemo(() => buildPlan(now), [now]);

  function downloadCalendar() {
    const ics = buildIcs(upcomingMilestones(now, 14));
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "commit-city-mentorship-deadlines.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main className="hq-page">
      <div className="hq-head">
        <Link href="/" className="back-pill">
          ← commit city
        </Link>
        <h1>
          🧭 Mentorship <span>HQ</span>
        </h1>
        <p>
          Everything a student needs to land GSoC, LFX Mentorship, or Outreachy
          — deadlines, eligibility, a plan, and a proposal coach.
        </p>
        <Link href="/programs" className="hq-link">
          📚 browse the full directory — every GSoC org, plus LFX & Outreachy →
        </Link>
      </div>

      <div className="city-content">
        {/* open now */}
        {open.length > 0 && (
          <div className="panel open-now-panel">
            <h3>🔔 Open right now</h3>
            <p className="sub">Application windows accepting submissions today.</p>
            <div className="open-now-row">
              {open.map((w) => (
                <div className="open-now-card" key={`${w.program}-${w.label}`}>
                  <span className={`program-badge ${badgeClass(w.program)}`}>
                    {w.program}
                  </span>
                  <strong>{w.label}</strong>
                  <span className="open-tag">OPEN NOW</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* countdowns */}
        <div className="panel">
          <div className="panel-head-row">
            <div>
              <h3>Season countdowns</h3>
              <p className="sub">
                The next milestones across all three programs. Dates are ≈
                approximate (based on each program&apos;s usual rhythm) — always
                confirm on the official page.
              </p>
            </div>
            <button className="report-btn" onClick={downloadCalendar}>
              📅 add to calendar (.ics)
            </button>
          </div>
          <div className="countdown-grid">
            {milestones.map((ms) => (
              <a
                key={`${ms.program}-${ms.label}`}
                href={ms.url}
                target="_blank"
                rel="noreferrer"
                className="countdown-card"
              >
                <span className={`program-badge ${badgeClass(ms.program)}`}>
                  {ms.program}
                </span>
                <div className="countdown-days">
                  {ms.daysAway <= 0 ? "today" : `${ms.daysAway}d`}
                </div>
                <div className="countdown-label">{ms.label}</div>
                <div className="countdown-date">
                  ≈{" "}
                  {ms.date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* readiness plan */}
        <div className="panel">
          <h3>Your week-by-week plan</h3>
          <p className="sub">
            Working backward from the next application deadline —{" "}
            <strong>
              {plan.deadline.program}: {plan.deadline.label}
            </strong>{" "}
            in about {plan.weeks} week{plan.weeks === 1 ? "" : "s"}.
          </p>
          <div className="plan-phases">
            {plan.phases.map((phase) => (
              <div className="plan-phase" key={phase.title}>
                <h4>{phase.title}</h4>
                <ul>
                  {phase.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* eligibility quiz */}
        <EligibilityQuiz />

        {/* comparison */}
        <div className="panel">
          <h3>Which program fits you?</h3>
          <p className="sub">The three big mentorship programs, side by side.</p>
          <div className="compare-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th></th>
                  {PROGRAMS.map((p) => (
                    <th key={p.id}>
                      <a href={p.url} target="_blank" rel="noreferrer">
                        {p.short} ↗
                      </a>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <CompareRow label="Who can apply" field="who" />
                <CompareRow label="Time commitment" field="commitment" />
                <CompareRow label="Stipend" field="stipend" />
                <CompareRow label="When" field="cadence" />
                <CompareRow label="Prior contribution" field="contribution" />
              </tbody>
            </table>
          </div>
        </div>

        {/* stipends */}
        <div className="panel">
          <h3>What would you earn?</h3>
          <p className="sub">
            Representative amounts — GSoC scales by project size and country
            purchasing power (see the{" "}
            <a
              href="https://developers.google.com/open-source/gsoc/help/student-stipends"
              target="_blank"
              rel="noreferrer"
              className="inline-link"
            >
              official table
            </a>
            ).
          </p>
          <div className="stipend-list">
            {STIPENDS.map((s, i) => (
              <div className="stipend-row" key={i}>
                <span className={`program-badge ${badgeClass(s.program)}`}>
                  {s.program}
                </span>
                <span className="stipend-detail">{s.detail}</span>
                <span className="stipend-amount">{s.amount}</span>
              </div>
            ))}
          </div>
        </div>

        {/* proposal coach */}
        <ProposalCoach />

        <p className="footer-note">
          Commit City · Mentorship HQ · dates are approximate — the official
          program sites are always the source of truth
        </p>
      </div>
    </main>
  );
}

function badgeClass(program) {
  if (program.includes("Outreachy")) return "outreachy";
  if (program.startsWith("GSoC")) return "gsoc";
  return "lfx";
}

function CompareRow({ label, field }) {
  return (
    <tr>
      <td className="compare-label">{label}</td>
      {PROGRAMS.map((p) => (
        <td key={p.id}>{p[field]}</td>
      ))}
    </tr>
  );
}

// ---------- eligibility quiz ----------

const QUIZ = [
  { id: "adult", q: "Will you be 18 or older by the program start date?" },
  {
    id: "underrep",
    q: "Do you belong to a group underrepresented in tech, or face systemic barriers to entering it? (Outreachy's criteria — check their site for specifics)",
  },
  {
    id: "fulltime",
    q: "Could you commit to FULL-TIME work (30+ hours/week) for ~13 weeks with no other full-time job or classes?",
  },
  {
    id: "contributed",
    q: "Have you made any open-source contributions before (even a docs fix)?",
  },
];

function EligibilityQuiz() {
  const [answers, setAnswers] = useState({});
  const answered = Object.keys(answers).length === QUIZ.length;

  let results = null;
  if (answered) {
    results = [];
    if (!answers.adult) {
      results.push({
        tone: "warn",
        text: "All three programs require you to be 18+ by the start date — bookmark this page and come back when you're eligible. Contributing to open source before then still counts for everything later.",
      });
    } else {
      results.push({
        tone: "good",
        text: "✅ GSoC — you're eligible. It's open to anyone 18+ who is new to open source (you don't have to be a student).",
      });
      results.push({
        tone: "good",
        text: "✅ LFX Mentorship — you're eligible for most projects; each lists its own prerequisites.",
      });
      if (answers.underrep && answers.fulltime) {
        results.push({
          tone: "good",
          text: "✅ Outreachy — you likely qualify. Its stipend is the largest ($7,000) and its contribution period gives you a structured path in. Verify the detailed eligibility rules on outreachy.org.",
        });
      } else if (answers.underrep && !answers.fulltime) {
        results.push({
          tone: "warn",
          text: "◐ Outreachy — you may meet the identity criteria, but it requires FULL-TIME availability (30+ hrs/week). If you have classes or a job, target GSoC (flexible hours) or a part-time LFX project instead.",
        });
      } else {
        results.push({
          tone: "info",
          text: "Outreachy has strict eligibility criteria around underrepresentation — check outreachy.org/apply/eligibility to be sure either way.",
        });
      }
      results.push(
        answers.contributed
          ? {
              tone: "good",
              text: "You've contributed before — your next move is focusing those contributions on 1-2 target orgs (see the bridges feature on your city page).",
            }
          : {
              tone: "info",
              text: "No contributions yet is completely fine — every program expects beginners. Start with one good-first-issue this week; your city page lists some matched to your languages.",
            }
      );
    }
  }

  return (
    <div className="panel">
      <h3>Am I eligible?</h3>
      <p className="sub">Four questions, honest answers — no data leaves your browser.</p>
      <div className="quiz">
        {QUIZ.map((item) => (
          <div className="quiz-q" key={item.id}>
            <span>{item.q}</span>
            <div className="quiz-btns">
              <button
                className={answers[item.id] === true ? "active" : ""}
                onClick={() => setAnswers((a) => ({ ...a, [item.id]: true }))}
              >
                yes
              </button>
              <button
                className={answers[item.id] === false ? "active" : ""}
                onClick={() => setAnswers((a) => ({ ...a, [item.id]: false }))}
              >
                no
              </button>
            </div>
          </div>
        ))}
      </div>
      {results && (
        <div className="quiz-results">
          {results.map((r, i) => (
            <p key={i} className={`quiz-result ${r.tone}`}>
              {r.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- proposal coach ----------

const COACH_MODES = [
  { id: "ideas", tab: "💡 give me ideas", btn: "💡 suggest project ideas", loading: "the coach is brainstorming…" },
  { id: "outline", tab: "✍️ outline from an idea", btn: "✍️ outline my proposal", loading: "the coach is writing…" },
  { id: "review", tab: "🔍 review my draft", btn: "🔍 review my draft", loading: "the coach is reading…" },
];

function ProposalCoach() {
  const [mode, setMode] = useState("ideas");
  const [program, setProgram] = useState("GSoC");
  const [org, setOrg] = useState("");
  const [skills, setSkills] = useState("");
  const [idea, setIdea] = useState("");
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState({ status: "idle" });
  const [copied, setCopied] = useState(false);

  const current = COACH_MODES.find((m) => m.id === mode);

  async function run() {
    setResult({ status: "loading" });
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, program, org, skills, idea, draft }),
      });
      const json = await res.json();
      if (!res.ok) {
        setResult({ status: "error", reason: json.error });
      } else {
        setResult({ status: "ready", text: json.text });
      }
    } catch {
      setResult({ status: "error", reason: "unexpected" });
    }
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="panel">
      <h3>🎓 Proposal coach</h3>
      <p className="sub">
        Not sure what to propose? Start with ideas. Have one? Get an outline.
        Wrote a draft? Get an org-mentor style review.
      </p>

      <div className="coach-tabs">
        {COACH_MODES.map((m) => (
          <button
            key={m.id}
            className={mode === m.id ? "active" : ""}
            onClick={() => setMode(m.id)}
          >
            {m.tab}
          </button>
        ))}
      </div>

      <div className="coach-form">
        <div className="coach-row">
          <select value={program} onChange={(e) => setProgram(e.target.value)}>
            <option>GSoC</option>
            <option>LFX</option>
            <option>Outreachy</option>
          </select>
          <input
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            placeholder={
              mode === "ideas"
                ? "target org — optional, coach picks if empty"
                : "target org (e.g. Zulip)"
            }
          />
        </div>
        {mode === "ideas" && (
          <input
            className="coach-wide-input"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="your languages & skills (e.g. Python, React, a bit of Docker)"
          />
        )}
        {mode === "outline" && (
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={5}
            placeholder="Paste the project idea from the org's ideas list (or describe what you want to build)…"
          />
        )}
        {mode === "review" && (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            placeholder="Paste your full draft proposal…"
          />
        )}
        <button
          className="report-btn"
          onClick={run}
          disabled={result.status === "loading"}
        >
          {result.status === "loading" ? current.loading : current.btn}
        </button>
      </div>

      {result.status === "ready" && (
        <div className="coach-result-wrap">
          <button className="copy-mini" onClick={copyResult}>
            {copied ? "✓ copied" : "⧉ copy"}
          </button>
          <div className="report-text coach-result">
            <RichText text={result.text} />
          </div>
        </div>
      )}
      {result.status === "error" && (
        <p className="report-loading">
          {result.reason === "no_key"
            ? "The coach needs a free GEMINI_API_KEY in .env.local to work."
            : result.reason === "rate_limited"
              ? "The free tier needs a short breather — try again in a minute."
              : result.reason?.startsWith("missing")
                ? "Give the coach something to work with first (skills, an idea, or a draft)."
                : "The coach stumbled — try again in a moment."}
        </p>
      )}
    </div>
  );
}
