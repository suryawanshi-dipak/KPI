import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Modal, Spinner, StatusPill, Toast } from "../components/UI";
import { Icon } from "../components/Icon";
import MeasurementForm from "../forms/MeasurementForm";
import {listMeasurements, listKpis , saveMeasurement, deleteMeasurement, employeeName, getCurrentUser , listEmployees , listAssignments} from "../lib/store";

export default function Measurements() {
  const [rows, setRows] = useState(null); // Used to verify if data has loaded (non-null means loaded)
  const [allRows, setAllRows] = useState([]); // All measurements retrieved from API
  const [employees, setEmployees] = useState([]); // All employees
  const [currentUser, setCurrentUser] = useState(null); // Currently logged in user
  const [kpis, setKpis] = useState([]); // All KPIs
  const [assignments, setAssignments] = useState([]); // All KPI assignments
  const [employeeFilter, setEmployeeFilter] = useState("all"); // State for manager/admin filter dropdown
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [q, setQ] = useState("");

  function flash(m){ setToast(m); setTimeout(()=>setToast(null),2400); }

  // Retrieve current user and all reference datasets from backend
  const load = async () => {
    try {
      const user = await getCurrentUser();
      const [
        measurements,
        kpisData,
        assignmentsData,
        employeesList
      ] = await Promise.all([
        listMeasurements(),
        listKpis(),
        listAssignments(),
        listEmployees()
      ]);

      setCurrentUser(user);
      setEmployees(employeesList);
      setAssignments(assignmentsData);
      setAllRows(measurements);
      setKpis(kpisData);
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

  // 1. Role-based base visibility filtering
  let visibleMeasurements = [];
  if (currentUser) {
    // Admin: can see all measurements recorded by all employees/managers
    if (currentUser.role === "admin") {
      visibleMeasurements = allRows;
    }
    // Employee: can see only measurements recorded by themselves (logged-in user)
    else if (currentUser.role === "employee") {
      visibleMeasurements = allRows.filter((m) =>
        Number(m.measured_by) === Number(currentUser.id)
      );
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

  // 3. Search query filter (by KPI name or period label)
  const filtered = baseFiltered.filter((m) =>
    kpiName(m.kpi_metric_id).toLowerCase().includes(q.toLowerCase()) ||
    String(m.measurement_period_label).toLowerCase().includes(q.toLowerCase())
  );
  
  
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
              <th>KPI</th><th>Period</th><th>Value</th><th>Status</th>
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
                  <td><StatusPill status={m.status} /></td>
                  <td className="cell-sub">{employeeName(m.measured_by)}</td>
                  <td className="cell-sub" style={{ maxWidth: 260 }}>{m.is_pending ? `Pending: ${m.pending_reason||""}` : (m.measurement_note || "—")}</td>
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
