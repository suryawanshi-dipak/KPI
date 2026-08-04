import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Modal, Spinner, StatusPill, Toast } from "../components/UI";
import { Icon } from "../components/Icon";
import MeasurementForm from "../forms/MeasurementForm";
// Added listKras and kraName imports to handle KRA area filtering
import {listMeasurements, listKpis, listKras, kraName, saveMeasurement, deleteMeasurement, employeeName, getCurrentUser, listEmployees, listAssignments} from "../lib/store";

export default function Measurements() {
  const [rows, setRows] = useState(null); // Used to verify if data has loaded (non-null means loaded)
  const [allRows, setAllRows] = useState([]); // All measurements retrieved from API
  const [employees, setEmployees] = useState([]); // All employees
  const [currentUser, setCurrentUser] = useState(null); // Currently logged in user
  const [kpis, setKpis] = useState([]); // All KPIs
  const [assignments, setAssignments] = useState([]); // All KPI assignments
  // Cached list of KRA areas and selected KRA filter state
  const [kras, setKras] = useState([]);
  const [kraFilter, setKraFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all"); // State for manager/admin filter dropdown
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [q, setQ] = useState("");

  function flash(m){ setToast(m); setTimeout(()=>setToast(null),2400); }

  // Retrieve current user and all reference datasets (including KRA Areas) from backend
  const load = async () => {
    try {
      const user = await getCurrentUser();
      const [
        measurements,
        kpisData,
        assignmentsData,
        employeesList,
        krasData // Fetch all active KRA Areas
      ] = await Promise.all([
        listMeasurements(),
        listKpis(),
        listAssignments(),
        listEmployees(),
        listKras()
      ]);

      setCurrentUser(user);
      setEmployees(employeesList);
      setAssignments(assignmentsData);
      setAllRows(measurements);
      setKpis(kpisData);
      setKras(krasData); // Store KRA list in local state for filtering
      setRows(measurements); // Mark loading complete
    } catch (err) {
      console.error("Error loading measurements page data:", err);
      flash("Failed to load page data.");
    }
  };

  useEffect(() => {
    setTimeout(() => {
      load();
    }, 0);
  }, []); // eslint-disable-line

  const kpiName = (id) => kpis.find((k) => Number(k.id) === Number(id))?.name || "—";

  // Look up the KPI record for a measurement so we can render its configured target
  const kpiForMeasurement = (kpiMetricId) =>
    kpis.find((k) => Number(k.id) === Number(kpiMetricId));

  // Format KPI target with direction prefix (≥ / ≤) and percentage unit when applicable
  const formatTarget = (kpi) => {
    if (!kpi) return "—";
    const prefix = kpi.direction === "higher_better" ? "≥ " : "≤ ";
    const suffix = kpi.unit === "Percentage" ? "%" : "";
    return `${prefix}${kpi.target_value}${suffix}`;
  };

  // 1. Role-based base visibility filtering
  let visibleMeasurements = [];
  if (currentUser) {
    // Admin: can see all measurements recorded by all employees/managers
    if (currentUser.role === "admin") {
      visibleMeasurements = allRows;
    }
    // Employee: can see only measurements recorded by themselves (logged-in user) OR measurements for Team KPIs where they are a team member
    else if (currentUser.role === "employee") {
      const myTeams = new Set(
        assignments
          .filter((a) => Number(a.employee_id) === Number(currentUser.id))
          .map((a) => a.team)
          .filter(Boolean)
      );

      visibleMeasurements = allRows.filter((m) => {
        // Direct measurements recorded by the user
        if (Number(m.measured_by) === Number(currentUser.id)) return true;

        // Team KPI measurements for teams they belong to
        const kpi = kpis.find((k) => Number(k.id) === Number(m.kpi_metric_id));
        if (kpi && (kpi.is_team_kpi === 1 || kpi.is_team_kpi === true)) {
          return assignments.some(
            (a) => Number(a.kpi_metric_id) === Number(kpi.id) && myTeams.has(a.team)
          );
        }

        return false;
      });
    }
    // Manager: can see measurements recorded by themselves (manager) and their team members (direct reports)
    else if (currentUser.role === "manager") {
      // Get IDs of all team members managed by this manager
      const teamIds = employees
        .filter((e) => Number(e.managerId) === Number(currentUser.id))
        .map((e) => Number(e.id));
      
      // Include the manager's own ID
      const teamIdsWithSelf = [...teamIds, Number(currentUser.id)];

      // Filter: visible only if the measurement was recorded (measured_by) by the manager or a team member
      visibleMeasurements = allRows.filter((m) =>
        teamIdsWithSelf.includes(Number(m.measured_by))
      );
    }
  }

  // 2. Apply dropdown select employee filter for manager/admin
  let baseFiltered = visibleMeasurements;
  if (currentUser && (currentUser.role === "manager" || currentUser.role === "admin")) {
    if (employeeFilter === "self") {
      // Manager filtering for only their own measurements
      baseFiltered = visibleMeasurements.filter(
        (m) => Number(m.measured_by) === Number(currentUser.id)
      );
    } else if (employeeFilter !== "all") {
      // Filter by a specific selected employee / manager / HR
      baseFiltered = visibleMeasurements.filter(
        (m) => Number(m.measured_by) === Number(employeeFilter)
      );
    }
  }

  // Sort measurements by period start date descending
  baseFiltered.sort(
    (a, b) => String(b.period_start_date).localeCompare(String(a.period_start_date))
  );

  // 3. Search query and KRA Area filtering (by KPI name, period label, or selected KRA area)
  const filtered = baseFiltered.filter((m) => {
    const kpi = kpis.find((k) => Number(k.id) === Number(m.kpi_metric_id));
    if (!kpi) return false;

    // Filter by KRA area if a specific KRA is selected
    if (kraFilter !== "all" && Number(kpi.kra_area_id) !== Number(kraFilter)) {
      return false;
    }

    // Check if matching the search keyword (KPI name or period label)
    const matchesSearch = kpi.name.toLowerCase().includes(q.toLowerCase()) ||
      String(m.measurement_period_label).toLowerCase().includes(q.toLowerCase());

    return matchesSearch;
  });
  
  
  async function handleSave(p) {

  setSaving(true);

  try {

    await saveMeasurement(p);

    setAdding(false);
    setEditing(null);

    await load();

    flash(
      p.id
        ? "Measurement updated"
        : "Measurement saved"
    );

  } finally {

    setSaving(false);

  }
}


async function handleDelete(id) {

  if (
    !window.confirm(
      "Delete this measurement?"
    )
  ) {
    return;
  }

  setSaving(true);

  try {

    await deleteMeasurement(id);

    await load();

    flash("Measurement deleted");

  } finally {

    setSaving(false);

  }

}


  if (!rows) return <Layout crumb={<b>Measurements</b>}><Spinner /></Layout>;

  return (
    <Layout crumb={<b>Measurements</b>}>
      <div className="page-head">
        <div><h1>Measurements</h1><p>Every recorded KPI reading, with who measured it and when.</p></div>
        <button className="btn btn--primary" onClick={() => setAdding(true)}><Icon.plus /> Enter measurement</button>
      </div>

      <div className="filter-bar">
        <div className="search">
          <Icon.search />
          <input placeholder="Search by KPI or period…" value={q} onChange={(e)=>setQ(e.target.value)} />
        </div>
        
        {/* KRA Area filter dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
            Filter by KRA:
          </span>
          <select
            className="select"
            style={{ width: "auto", minWidth: "160px", padding: "0.45rem 0.6rem" }}
            value={kraFilter}
            onChange={(e) => setKraFilter(e.target.value)}
          >
            <option value="all">All KRAs</option>
            {kras.map((k) => (
              <option key={k.id} value={k.id}>
                {k.area_name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Manager & Admin filter dropdown to filter measurements by employee */}
        {currentUser && (currentUser.role === "manager" || currentUser.role === "admin") && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
              Filter by Employee:
            </span>
            <select
              className="select"
              style={{ width: "auto", minWidth: "180px", padding: "0.45rem 0.6rem" }}
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
            >
              <option value="all">Show All</option>
              {currentUser.role === "manager" && (
                <>
                  <option value="self">Only My Measurements</option>
                  {employees
                    .filter((e) => Number(e.managerId) === Number(currentUser.id))
                    /* Sort manager's team employees alphabetically A to Z */
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </>
              )}
              {currentUser.role === "admin" && (
                <>
                  {employees
                    /* Sort all employees alphabetically A to Z for admin */
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({cap(e.role)})
                      </option>
                    ))}
                </>
              )}
            </select>
          </div>
        )}

        <span className="tag">{filtered.length} records</span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data">
            <thead><tr>
              <th>KPI</th><th>Period</th><th>Value</th><th>Target</th><th>Status</th>
              <th>Recorded by</th>
                 <th>Note</th>
                  <th></th>
            </tr></thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td className="cell-strong">{kpiName(m.kpi_metric_id)}</td>
                  <td>
                    <div className="mono">{m.measurement_period_label}</div>
                    <div className="cell-sub">{m.period_start_date} → {m.period_end_date}</div>
                  </td>
                  <td className="mono">{m.is_pending ? "—" : m.measured_value}</td>
                  {/* Target threshold for the KPI this measurement belongs to */}
                  <td className="mono">{formatTarget(kpiForMeasurement(m.kpi_metric_id))}</td>
                  <td><StatusPill status={m.status} /></td>
                  <td className="cell-sub">{employeeName(m.measured_by)}</td>
                  <td className="cell-sub" style={{ maxWidth: 260 }}>
                    {/* Constrain height of measurement note column with a scrollbar and title tooltip to keep rows standardized */}
                    <div
                      title={m.is_pending ? `Pending: ${m.pending_reason||""}` : (m.measurement_note || "")}
                      style={{
                        maxHeight: "42px",
                        overflowY: "auto",
                        wordBreak: "break-word",
                        lineHeight: "1.4"
                      }}
                    >
                      {m.is_pending ? `Pending: ${m.pending_reason||""}` : (m.measurement_note || "—")}
                    </div>
                  </td>
                  <td>
                    <div className="cell-actions">
                      {/* 
                          Admins can edit/delete everything.
                          Managers can edit/delete measurements for themselves and their managed team members.
                          Employees can only edit/delete measurements they recorded themselves.
                      */}
                      {currentUser && (
                        currentUser.role === "admin" ||
                        (currentUser.role === "manager" && (
                          Number(m.measured_by) === Number(currentUser.id) ||
                          employees.some((e) => Number(e.id) === Number(m.measured_by) && Number(e.managerId) === Number(currentUser.id))
                        )) ||
                        (currentUser.role === "employee" && Number(m.measured_by) === Number(currentUser.id))
                      ) && (
                        <>
                          <button className="icon-btn" title="Edit" onClick={() => setEditing(m)}>
                            <Icon.edit />
                          </button>
                          <button
                            className="icon-btn"
                            title="Delete Measurement"
                            onClick={() => handleDelete(m.id)}
                            style={{ color: "var(--bad)" }}
                          >
                            <Icon.trash />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {adding && (
        <Modal title="Enter measurement" subtitle="Guided KPI reading entry" onClose={() => setAdding(false)} wide>
          <MeasurementForm saving={saving} onSubmit={handleSave} onCancel={() => setAdding(false)} />
        </Modal>
      )}

      {editing && (
  <Modal title="Edit measurement" subtitle={kpiName(editing.kpi_metric_id)} onClose={() => setEditing(null)} wide>
    <MeasurementForm initial={editing} saving={saving} onSubmit={handleSave} onCancel={() => setEditing(null)}/>
  </Modal>
)}
      {toast && <Toast message={toast} />}
    </Layout>
  );
}

// Helper function to capitalize role descriptions cleanly
function cap(s) {
  if (!s) return "";
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}
