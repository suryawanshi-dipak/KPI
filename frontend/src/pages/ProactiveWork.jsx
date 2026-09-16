import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Modal, Spinner, Toast } from "../components/UI";
import { Icon } from "../components/Icon";
import ProactiveWorkForm from "../forms/ProactiveWorkForm";
import TeamSummaryPanel from "../components/TeamSummaryPanel";
import {
  getCurrentUser,
  listEmployees,
  listProactiveWork,
  getProactiveWorkEntry,
  saveProactiveWorkEntry,
  setProactiveWorkHighlighted,
} from "../lib/store";

const CATEGORY_LABELS = {
  ATTENDANCE_PUNCTUALITY: "Attendance & Punctuality",
  TEAM_SUPPORT: "Team Support",
  INITIATIVE_IDEA: "Initiative / Idea",
  EXTRA_HOURS: "Extra Hours",
  RESOURCE_SAVING: "Resource Saving",
  PROCESS_IMPROVEMENT: "Process Improvement",
  OTHER: "Other",
};

function categoryLabel(entry) {
  if (!entry) return "—";
  if (entry.category === "OTHER" && entry.other_category_text) return entry.other_category_text;
  return CATEGORY_LABELS[entry.category] || entry.category || "—";
}

function formatWhen(entry) {
  if (!entry?.effort_start_date) return "—";
  if (entry.effort_end_date && entry.effort_end_date !== entry.effort_start_date) {
    return `${entry.effort_start_date} → ${entry.effort_end_date}`;
  }
  return entry.effort_start_date;
}

export default function ProactiveWork() {
  const [currentUser, setCurrentUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [entries, setEntries] = useState(null);
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [viewingEntry, setViewingEntry] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [showTeamSummary, setShowTeamSummary] = useState(false);

  function flash(m) { setToast(m); setTimeout(() => setToast(null), 2400); }

  const load = async (filter = employeeFilter) => {
    const [user, employeesList] = await Promise.all([getCurrentUser(), listEmployees()]);
    setCurrentUser(user);
    setEmployees(employeesList);
    const list = await listProactiveWork(filter !== "all" ? { subjectEmployeeId: Number(filter) } : {});
    setEntries(list);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  useEffect(() => {
    if (viewingId == null) return;
    let active = true;
    // Deferred via setTimeout to avoid a synchronous setState-in-effect call, matching the
    // pattern already used elsewhere in this codebase (see MeasurementForm.jsx).
    const timer = setTimeout(() => {
      setViewingLoading(true);
      getProactiveWorkEntry(viewingId)
        .then((entry) => { if (active) { setViewingEntry(entry); setViewingLoading(false); } })
        .catch((err) => {
          if (active) { setViewingLoading(false); setViewingId(null); flash(err.message || "Failed to load entry"); }
        });
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [viewingId]);

  async function handleFilterChange(nextFilter) {
    setEmployeeFilter(nextFilter);
    await load(nextFilter);
  }

  async function handleSave(payload) {
    setSaving(true);
    try {
      await saveProactiveWorkEntry(payload);
      setAdding(false);
      await load();
      flash("Proactive work logged");
    } catch (err) {
      flash(err.message || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleHighlight(entry, ev) {
    ev.stopPropagation();
    try {
      await setProactiveWorkHighlighted(entry.id, !entry.is_highlighted);
      await load();
    } catch (err) {
      flash(err.message || "Failed to update highlight");
    }
  }

  async function closeViewing() {
    setViewingId(null);
    await load();
  }

  if (!currentUser || entries === null) {
    return <Layout crumb={<b>Proactive Work</b>}><Spinner /></Layout>;
  }

  const canFilterByEmployee = currentUser.role === "manager" || currentUser.role === "admin";
  // Highlight toggle is manager/admin only (BRD §8.3) — never shown for an employee viewing
  // their own list, even though they can see the highlighted state.
  const canHighlight = currentUser.role === "manager" || currentUser.role === "admin";
  const unseenCount = entries.filter((e) => !e.is_seen).length;

  const filtered = entries.filter((e) => {
    if (segment === "unseen" && e.is_seen) return false;
    if (segment === "highlighted" && !e.is_highlighted) return false;
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      (e.title || "").toLowerCase().includes(needle) ||
      (e.description || "").toLowerCase().includes(needle) ||
      (e.subject_employee_name || "").toLowerCase().includes(needle)
    );
  });

  return (
    <Layout crumb={<b>Proactive Work</b>}>
      <div className="page-head">
        <div>
          <h1>Proactive Work</h1>
          <p>Effort worth remembering that no KPI captures.</p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          {currentUser.role === "manager" && (
            <button className="btn btn--ghost" onClick={() => setShowTeamSummary((s) => !s)}>
              Team Summary
            </button>
          )}
          <button className="btn btn--primary" onClick={() => setAdding(true)}>
            <Icon.plus /> Log proactive work
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search">
          <Icon.search />
          <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="segmented">
          <button className={segment === "all" ? "active" : ""} onClick={() => setSegment("all")}>All</button>
          <button className={segment === "unseen" ? "active" : ""} onClick={() => setSegment("unseen")}>
            Unseen · {unseenCount}
          </button>
          <button className={segment === "highlighted" ? "active" : ""} onClick={() => setSegment("highlighted")}>
            ★ Highlighted
          </button>
        </div>

        {canFilterByEmployee && (
          <select className="select" style={{ width: "auto", minWidth: 180 }}
            value={employeeFilter} onChange={(e) => handleFilterChange(e.target.value)}>
            <option value="all">All employees</option>
            {[...employees].sort((a, b) => a.name.localeCompare(b.name)).map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        )}

        <span className="tag">{filtered.length} entries</span>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty">
            <h3>Nothing logged yet</h3>
            <p>Staying late, covering for a teammate, an unasked-for improvement — log it here.</p>
            <button className="btn btn--primary" onClick={() => setAdding(true)} style={{ marginTop: "0.8rem" }}>
              <Icon.plus /> Log proactive work
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>What they did</th>
                  <th>Employee</th>
                  <th>Category</th>
                  <th>When</th>
                  <th>Linked KPI</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className={!e.is_seen ? "pwe-row--unseen" : ""}
                    style={{ cursor: "pointer" }} onClick={() => setViewingId(e.id)}>
                    <td>
                      <div className="cell-strong">{e.title}</div>
                      <div className="cell-sub pwe-desc">{e.description}</div>
                    </td>
                    <td>
                      <div>{e.subject_employee_name}</div>
                      <div className="cell-sub">logged by {e.logged_by_name}</div>
                    </td>
                    <td><span className="tag">{categoryLabel(e)}</span></td>
                    <td className="mono">{formatWhen(e)}</td>
                    <td>
                      {e.kpi_measurement_id ? (
                        <span className="pwe-kpi-chip">{e.kpi_metric_name} · {e.kpi_measurement_period_label}</span>
                      ) : "—"}
                    </td>
                    <td>
                      <span className={`pill ${e.is_seen ? "pill--green" : "pill--new"}`}>
                        {e.is_seen ? "SEEN" : "NEW"}
                      </span>
                    </td>
                    <td>
                      {canHighlight && (
                        <button className="icon-btn pwe-star"
                          title={e.is_highlighted ? "Remove highlight" : "Highlight"}
                          onClick={(ev) => handleToggleHighlight(e, ev)}>
                          <Icon.proactive fill={e.is_highlighted ? "#f5a623" : "none"} stroke="#f5a623"
                            style={{ width: 15, height: 15 }} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FR-PW-11 — manager role only, their own team; not shown for employee/admin */}
      {currentUser.role === "manager" && showTeamSummary && (
        <Modal title="Team summary" subtitle="A counts grid for your team — not a score."
          onClose={() => setShowTeamSummary(false)} wide>
          <TeamSummaryPanel currentUser={currentUser} employees={employees} />
        </Modal>
      )}

      {adding && (
        <Modal title="Log proactive work" subtitle="Something you did that no KPI would show." onClose={() => setAdding(false)}>
          <ProactiveWorkForm currentUser={currentUser} saving={saving} onSubmit={handleSave} onCancel={() => setAdding(false)} />
        </Modal>
      )}

      {viewingId != null && (
        <Modal title="Proactive work entry" subtitle={viewingEntry?.title} onClose={closeViewing}>
          {viewingLoading || !viewingEntry ? <Spinner /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
              <div className="preview-panel">
                <div className="preview-panel__row"><span className="k">Credited to</span><span className="v">{viewingEntry.subject_employee_name}</span></div>
                <div className="preview-panel__row"><span className="k">Logged by</span><span className="v">{viewingEntry.logged_by_name}</span></div>
                <div className="preview-panel__row"><span className="k">Category</span><span className="v">{categoryLabel(viewingEntry)}</span></div>
                <div className="preview-panel__row"><span className="k">When</span><span className="v mono">{formatWhen(viewingEntry)}</span></div>
                {viewingEntry.kpi_measurement_id && (
                  <div className="preview-panel__row"><span className="k">Linked KPI</span>
                    <span className="v">{viewingEntry.kpi_metric_name} · {viewingEntry.kpi_measurement_period_label}</span></div>
                )}
              </div>
              <div>
                <strong style={{ fontSize: "0.8rem", color: "var(--ink-soft)", display: "block", marginBottom: "0.3rem" }}>Details</strong>
                <p style={{ fontSize: "0.86rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{viewingEntry.description}</p>
              </div>
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={closeViewing}>Close</button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} />}
    </Layout>
  );
}
