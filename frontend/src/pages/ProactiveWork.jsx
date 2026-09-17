import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Modal, Spinner, Toast } from "../components/UI";
import { Icon } from "../components/Icon";
import ProactiveWorkForm from "../forms/ProactiveWorkForm";
import ProactiveWorkDetail from "../components/ProactiveWorkDetail";
import TeamSummaryPanel from "../components/TeamSummaryPanel";
import {
  getCurrentUser,
  listEmployees,
  listProactiveWork,
  listProactiveWorkEveryone,
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

const TABS = [
  { key: "my-team", label: "My team" },
  { key: "everyone", label: "Everyone" },
  { key: "mine", label: "Mine" },
];

export default function ProactiveWork() {
  const [currentUser, setCurrentUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [tab, setTab] = useState("my-team");
  const [entries, setEntries] = useState(null);
  const [everyonePage, setEveryonePage] = useState({ content: [], page: 0, total_pages: 0, total_elements: 0 });
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [viewingEntry, setViewingEntry] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [showTeamSummary, setShowTeamSummary] = useState(false);

  function flash(m) { setToast(m); setTimeout(() => setToast(null), 2400); }

  const loadTeamOrMine = async (activeTab = tab, filter = employeeFilter) => {
    const subjectFilter = activeTab === "mine"
      ? currentUser?.id
      : (filter !== "all" ? Number(filter) : undefined);
    const list = await listProactiveWork(subjectFilter != null ? { subjectEmployeeId: subjectFilter } : {});
    setEntries(list);
  };

  const loadEveryone = async (page = 0) => {
    const result = await listProactiveWorkEveryone({
      page,
      unseenOnly: segment === "unseen",
      highlightedOnly: segment === "highlighted",
    });
    setEveryonePage(result);
  };

  const load = async () => {
    const [user, employeesList] = await Promise.all([getCurrentUser(), listEmployees()]);
    setCurrentUser(user);
    setEmployees(employeesList);
    if (tab === "everyone") {
      await loadEveryone(0);
    } else {
      const subjectFilter = tab === "mine" ? user?.id : (employeeFilter !== "all" ? Number(employeeFilter) : undefined);
      const list = await listProactiveWork(subjectFilter != null ? { subjectEmployeeId: subjectFilter } : {});
      setEntries(list);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function handleTabChange(nextTab) {
    setTab(nextTab);
    setSegment("all");
    if (nextTab === "everyone") {
      await loadEveryone(0);
    } else {
      await loadTeamOrMine(nextTab, employeeFilter);
    }
  }

  async function handleSegmentChange(nextSegment) {
    setSegment(nextSegment);
    if (tab === "everyone") {
      const result = await listProactiveWorkEveryone({
        page: 0,
        unseenOnly: nextSegment === "unseen",
        highlightedOnly: nextSegment === "highlighted",
      });
      setEveryonePage(result);
    }
  }

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
    await loadTeamOrMine(tab, nextFilter);
  }

  async function handleSave(payload) {
    setSaving(true);
    try {
      await saveProactiveWorkEntry(payload);
      setAdding(false);
      setEditingEntry(null);
      await load();
      if (viewingId != null) {
        const refreshed = await getProactiveWorkEntry(viewingId);
        setViewingEntry(refreshed);
      }
      flash(payload.id ? "Proactive work updated" : "Proactive work logged");
    } catch (err) {
      flash(err.message || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleHighlight(entry, ev) {
    ev?.stopPropagation();
    try {
      await setProactiveWorkHighlighted(entry.id, !entry.is_highlighted);
      await load();
      if (viewingId === entry.id) {
        const refreshed = await getProactiveWorkEntry(entry.id);
        setViewingEntry(refreshed);
      }
    } catch (err) {
      flash(err.message || "Failed to update highlight");
    }
  }

  async function handleViewingChanged() {
    const refreshed = await getProactiveWorkEntry(viewingId);
    setViewingEntry(refreshed);
    await load();
  }

  async function closeViewing() {
    setViewingId(null);
    await load();
  }

  if (!currentUser || (tab !== "everyone" && entries === null)) {
    return <Layout crumb={<b>Proactive Work</b>}><Spinner /></Layout>;
  }

  const canFilterByEmployee = (currentUser.role === "manager" || currentUser.role === "admin") && tab === "my-team";
  const canHighlight = currentUser.role === "manager" || currentUser.role === "admin";
  const canOpenTeamSummary = currentUser.role === "manager" || currentUser.role === "admin";

  const sourceRows = tab === "everyone" ? everyonePage.content : (entries || []);
  const unseenCount = sourceRows.filter((e) => !e.is_seen).length;

  const filtered = sourceRows.filter((e) => {
    if (tab !== "everyone") {
      if (segment === "unseen" && e.is_seen) return false;
      if (segment === "highlighted" && !e.is_highlighted) return false;
    }
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
          {canOpenTeamSummary && (
            <button className="btn btn--ghost" onClick={() => setShowTeamSummary((s) => !s)}>
              Team Summary
            </button>
          )}
          <button className="btn btn--primary" onClick={() => setAdding(true)}>
            <Icon.plus /> Log proactive work
          </button>
        </div>
      </div>

      <div className="segmented" style={{ marginBottom: "0.9rem" }}>
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => handleTabChange(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <div className="search">
          <Icon.search />
          <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="segmented">
          <button className={segment === "all" ? "active" : ""} onClick={() => handleSegmentChange("all")}>All</button>
          <button className={segment === "unseen" ? "active" : ""} onClick={() => handleSegmentChange("unseen")}>
            Unseen{tab !== "everyone" ? ` · ${unseenCount}` : ""}
          </button>
          <button className={segment === "highlighted" ? "active" : ""} onClick={() => handleSegmentChange("highlighted")}>
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

        <span className="tag">
          {tab === "everyone" ? `${everyonePage.total_elements} entries` : `${filtered.length} entries`}
        </span>
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
                  <th>♥</th>
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
                    <td className="mono cell-sub">{e.endorsement_count || 0}</td>
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
        {tab === "everyone" && everyonePage.total_pages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: "0.8rem", alignItems: "center", padding: "0.9rem" }}>
            <button className="btn btn--ghost" disabled={everyonePage.page <= 0}
              onClick={() => loadEveryone(everyonePage.page - 1)}>← Newer</button>
            <span className="cell-sub">Page {everyonePage.page + 1} of {everyonePage.total_pages}</span>
            <button className="btn btn--ghost" disabled={everyonePage.page >= everyonePage.total_pages - 1}
              onClick={() => loadEveryone(everyonePage.page + 1)}>Older →</button>
          </div>
        )}
      </div>

      {canOpenTeamSummary && showTeamSummary && (
        <Modal title="Team summary" subtitle="A counts grid — not a score."
          onClose={() => setShowTeamSummary(false)} wide>
          <TeamSummaryPanel currentUser={currentUser} employees={employees} />
        </Modal>
      )}

      {(adding || editingEntry) && (
        <Modal title={editingEntry ? "Edit proactive work" : "Log proactive work"}
          subtitle="Something you did that no KPI would show."
          onClose={() => { setAdding(false); setEditingEntry(null); }}>
          <ProactiveWorkForm currentUser={currentUser} initial={editingEntry} saving={saving}
            onSubmit={handleSave} onCancel={() => { setAdding(false); setEditingEntry(null); }} />
        </Modal>
      )}

      {viewingId != null && (
        <Modal title="Proactive Work" onClose={closeViewing}>
          {viewingLoading || !viewingEntry ? <Spinner /> : (
            <ProactiveWorkDetail
              entry={viewingEntry}
              currentUser={currentUser}
              onChanged={handleViewingChanged}
              onToggleHighlight={(entry) => handleToggleHighlight(entry)}
              onEdit={() => { setEditingEntry(viewingEntry); setViewingId(null); }}
            />
          )}
        </Modal>
      )}

      {toast && <Toast message={toast} />}
    </Layout>
  );
}
