import { useEffect, useMemo, useState } from "react";
import { listProactiveWork } from "../lib/store";

const CATEGORY_ORDER = [
  "ATTENDANCE_PUNCTUALITY",
  "TEAM_SUPPORT",
  "INITIATIVE_IDEA",
  "EXTRA_HOURS",
  "RESOURCE_SAVING",
  "PROCESS_IMPROVEMENT",
  "OTHER",
];

const CATEGORY_SHORT_LABELS = {
  ATTENDANCE_PUNCTUALITY: "Attend",
  TEAM_SUPPORT: "Support",
  INITIATIVE_IDEA: "Initiative",
  EXTRA_HOURS: "Hours",
  RESOURCE_SAVING: "Resource",
  PROCESS_IMPROVEMENT: "Process",
  OTHER: "Other",
};

const PERIOD_OPTIONS = [
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 180, label: "Last 180 days" },
];

function formatCutoff(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * FR-PW-11 (BRD v2.0, Increment 3) — Manager role only, their own team.
 *
 * "A counts grid, not a score." Cell shading reflects density only (a single neutral tint
 * scaled to that cell's count against the grid's max), never red/green semantics. The Total
 * column is last and the grid is never sorted by it — the useful read is the shape of a row,
 * not a ranking. Employees with zero entries in the period are omitted from the grid (a row
 * of all zeros isn't a "shape") and surfaced only in the footer count.
 *
 * Fetches its own unfiltered team data rather than reusing ProactiveWork.jsx's `entries` state
 * — that state gets narrowed whenever the manager filters the main list to one employee, which
 * would silently make this grid wrong for everyone else on the team. One extra cheap call
 * against the existing manager-scoped GET /api/v1/proactive-work; no new backend endpoint.
 *
 * Rendered as the body of a Modal (see ProactiveWork.jsx) — no card wrapper of its own, since
 * the modal shell already supplies the title/close chrome.
 */
export default function TeamSummaryPanel({ currentUser, employees }) {
  const [days, setDays] = useState(90);
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    let active = true;
    listProactiveWork().then((list) => { if (active) setEntries(list); });
    return () => { active = false; };
  }, []);

  const team = useMemo(
    () => employees.filter((e) => Number(e.managerId) === Number(currentUser.id)),
    [employees, currentUser]
  );

  const inRange = useMemo(() => {
    if (!entries) return [];
    const cutoff = formatCutoff(days);
    return entries.filter((e) => e.effort_start_date >= cutoff);
  }, [entries, days]);

  const rows = useMemo(() => {
    return team
      .map((emp) => {
        const empEntries = inRange.filter((e) => Number(e.subject_employee_id) === Number(emp.id));
        const counts = {};
        CATEGORY_ORDER.forEach((c) => { counts[c] = 0; });
        empEntries.forEach((e) => {
          if (counts[e.category] !== undefined) counts[e.category] += 1;
        });
        return {
          id: emp.id,
          name: emp.name,
          counts,
          total: empEntries.length,
          highlighted: empEntries.filter((e) => e.is_highlighted).length,
        };
      })
      .filter((row) => row.total > 0)
      // Deliberately unranked by total — alphabetical so nobody reads this as a leaderboard.
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [team, inRange]);

  const zeroCount = team.length - rows.length;

  const maxCount = useMemo(() => {
    let max = 0;
    rows.forEach((r) => CATEGORY_ORDER.forEach((c) => { if (r.counts[c] > max) max = r.counts[c]; }));
    return max;
  }, [rows]);

  function cellStyle(count) {
    if (!count) return {};
    const intensity = 0.12 + 0.55 * (count / maxCount);
    return { background: `rgba(58, 91, 217, ${intensity.toFixed(2)})` };
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem" }}>
        <span className="cell-sub">last {days} days</span>
        <select className="select" style={{ width: "auto" }}
          value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {PERIOD_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>
      <div>
        {entries === null ? (
          <p className="cell-sub">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="cell-sub">Nobody on your team has logged proactive work in this period.</p>
        ) : (
          <div className="table-wrap">
            <table className="data team-summary-grid">
              <thead>
                <tr>
                  <th>Employee</th>
                  {CATEGORY_ORDER.map((c) => <th key={c}>{CATEGORY_SHORT_LABELS[c]}</th>)}
                  <th>Total</th>
                  <th>★</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="cell-strong">{row.name}</td>
                    {CATEGORY_ORDER.map((c) => (
                      <td key={c} className="mono team-summary-grid__cell" style={cellStyle(row.counts[c])}>
                        <span className={row.counts[c] ? "" : "team-summary-grid__zero"}>{row.counts[c]}</span>
                      </td>
                    ))}
                    <td className="mono cell-strong">{row.total}</td>
                    <td className="mono team-summary-grid__star">{row.highlighted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {entries !== null && rows.length > 0 && (
          <p className="cell-sub" style={{ marginTop: "0.8rem" }}>
            A thin row usually means little was logged, not that little happened.
            {zeroCount > 0 && (
              <>
                {" "}{zeroCount} {zeroCount === 1 ? "person" : "people"} on your team{" "}
                {zeroCount === 1 ? "has" : "have"} no entries at all this period.
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
