import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "../components/Layout";
import { Modal, Spinner, StatusPill, Toast } from "../components/UI";
import { Icon } from "../components/Icon";
import KpiForm from "../forms/KpiForm";
import MeasurementForm from "../forms/MeasurementForm";
import { listKpis, saveKpi, getStats, kraName, saveMeasurement , employeeName , deleteKpi , saveAssignment , assignmentsForKpi , deleteAssignment, listEmployees, listAssignments, getCurrentUser, listMeasurements } from "../lib/store";
import KpiAssignmentForm from "../forms/KpiAssignmentForm";

export default function Kpis() {
  const [kpis, setKpis] = useState(null);
  const [stats, setStats] = useState(null);
  const [editing, setEditing] = useState(null); // {} for new, {id...} for edit
  const [measuring, setMeasuring] = useState(null); // kpi being measured
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [viewAssignments, setViewAssignments] = useState(null);
  const [assignmentRows, setAssignmentRows] = useState([]);
  
  // Custom states for authentication, filtering, and role checks
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [managerFilter, setManagerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [measurements, setMeasurements] = useState([]);

  const [editingAssignment, setEditingAssignment] = useState(null);
  const [toast, setToast] = useState(null);
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const location = useLocation();

  // Load KPI configuration, stats, assignments, employees and current logged in user in parallel
  const load = () =>
    Promise.all([
      listKpis(),
      getStats(),
      listAssignments(),
      listEmployees(),
      getCurrentUser(),
      listMeasurements()
    ])
      .then(([k, s, a, e, user, m]) => {
        setKpis(k);
        setStats(s);
        setAssignments(a);
        setEmployees(e);
        setCurrentUser(user);
        setMeasurements(m);
      })
      .catch((err) => {
        console.error("Error loading KPI configuration data:", err);
      });

  useEffect(() => {
    load();
  }, []);

  function flash(msg) { setToast(msg); setTimeout(() => setToast(null), 2400); }

  async function handleSave(payload) {
    setSaving(true);
    await saveKpi(payload);
    setSaving(false);
    setEditing(null);
    await load();
    flash(payload.id ? "KPI updated" : "KPI created");
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you Sure , You want to Delete this KPI ?")) return;
    
    setSaving(true);
    
    try {
      await deleteKpi(id);
      await load();
      flash("KPI deleted");
    } finally {
      setSaving(false);
    }
  }
  
  async function handleMeasure(payload) {
    setSaving(true);
    await saveMeasurement(payload);
    setSaving(false);
    setMeasuring(null);
    await load();
    flash("Measurement saved");
  }

  async function openAssignments(kpi) {
    try {
      const rows = await assignmentsForKpi(kpi.id);
      setAssignmentRows(rows);
      setViewAssignments(kpi);
    } catch (err) {
      console.error(err);
      flash("Unable to load assignments");
    }
  }

  // Handles saving assignment updates (for a single employee) or new assignments (for multiple employees)
  async function handleAssignmentSave(payload) {
    setSaving(true);
    try {
      // Check if saving multiple assignments at once (payload.employee_ids is an array of IDs)
      if (payload.employee_ids && Array.isArray(payload.employee_ids)) {
        await Promise.all(
          payload.employee_ids.map((empId) =>
            saveAssignment({
              kpi_metric_id: payload.kpi_metric_id,
              employee_id: empId,
              team: payload.team,
              is_primary: payload.is_primary,
              assigned_from: payload.assigned_from,
              assigned_to: payload.assigned_to,
            })
          )
        );
      } else {
        // Otherwise, save a single updated or newly created assignment
        await saveAssignment(payload);
      }
      setAssigning(null);
      setEditingAssignment(null);
      if (viewAssignments) {
        const rows = await assignmentsForKpi(viewAssignments.id);
        setAssignmentRows(rows);
      }
      const updatedAssignments = await listAssignments();
      setAssignments(updatedAssignments);
      flash(payload.id ? "Assignment updated" : "Assignments created");
    } catch (err) {
      console.error(err);
      flash(err.message || "Failed to save assignment");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAssignment(id) {
    if (!window.confirm("Delete this assignment?")) return;
    setSaving(true);
    try {
      await deleteAssignment(id);
      const [rows, updatedAssignments] = await Promise.all([
        assignmentsForKpi(viewAssignments.id),
        listAssignments(),
      ]);
      setAssignmentRows(rows);
      setAssignments(updatedAssignments);
      flash("Assignment deleted");
    } catch (err) {
      console.error(err);
      flash("Failed to delete assignment");
    } finally {
      setSaving(false);
    }
  }

  if (!kpis || !stats || !currentUser) {
    return <Layout crumb={<b>KPIs</b>}><Spinner /></Layout>;
  }

  // Access check flags
  const isEmployee = currentUser.role === "employee";
  const isManager = currentUser.role === "manager";
  const isAdmin = currentUser.role === "admin";

  // Role-based KPI Visibility logic
  let baseKpis = kpis;

  if (isEmployee) {
    // 1) For Employees: visible KPIs assigned to them OR Team KPIs assigned to their team(s)
    const myTeams = new Set(
      assignments
        .filter((a) => Number(a.employee_id) === Number(currentUser.id))
        .map((a) => a.team)
        .filter(Boolean)
    );

    const myKpiIds = new Set(
      assignments
        .filter((a) => Number(a.employee_id) === Number(currentUser.id))
        .map((a) => Number(a.kpi_metric_id))
    );

    baseKpis = kpis.filter((k) => {
      if (myKpiIds.has(Number(k.id))) return true;

      // If it is a Team KPI and assigned to any team the employee belongs to
      if (k.is_team_kpi === 1 || k.is_team_kpi === true) {
        return assignments.some(
          (a) => Number(a.kpi_metric_id) === Number(k.id) && myTeams.has(a.team)
        );
      }
      return false;
    });
  } else if (isManager || isAdmin) {
    // 2) For Managers & Admins: show all KPIs by default
    baseKpis = kpis;

    // Apply the dropdown select filter for manager/admin view
    if (managerFilter === "self") {
      const myKpiIds = new Set(
        assignments
          .filter((a) => Number(a.employee_id) === Number(currentUser.id))
          .map((a) => Number(a.kpi_metric_id))
      );
      // Filter KPIs: show KPIs assigned to self OR created by self
      baseKpis = kpis.filter((k) => myKpiIds.has(Number(k.id)) || Number(k.created_by) === Number(currentUser.id));
    } else if (managerFilter === "unassigned") {
      // Show KPIs that have no assignments at all
      const assignedKpiIds = new Set(
        assignments.map((a) => Number(a.kpi_metric_id))
      );
      baseKpis = kpis.filter((k) => !assignedKpiIds.has(Number(k.id)));
    } else if (managerFilter !== "all") {
      const selectedMemberId = Number(managerFilter);
      const selectedMember = employees.find(e => Number(e.id) === selectedMemberId);
      const memberKpiIds = new Set(
        assignments
          .filter((a) => Number(a.employee_id) === selectedMemberId)
          .map((a) => Number(a.kpi_metric_id))
      );
      
      // If the target is a manager or admin, show KPIs assigned to them OR created by them.
      const isTargetManagerOrAdmin = selectedMember && (selectedMember.role === "manager" || selectedMember.role === "admin");
      
      baseKpis = kpis.filter((k) => 
        memberKpiIds.has(Number(k.id)) || 
        (isTargetManagerOrAdmin && Number(k.created_by) === selectedMemberId)
      );
    }
  }

  // Filter list by search query and KPI active status
  const filtered = baseKpis.filter((k) => {
    const matchesSearch = k.name.toLowerCase().includes(q.toLowerCase()) ||
      kraName(k.kra_area_id).toLowerCase().includes(q.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "active" && k.is_active !== 1 && k.is_active !== true) return false;
    if (statusFilter === "inactive" && k.is_active !== 0 && k.is_active !== false) return false;

    return true;
  });

  // For managers/admins, show self-created KPIs first, then the rest.
  // This keeps the current user’s own KPIs at the top of the list.
  const orderedKpis = [...filtered];
  if ((isManager || isAdmin) && currentUser) {
    orderedKpis.sort((a, b) => {
      const aSelf = Number(a.created_by) === Number(currentUser.id) ? 0 : 1;
      const bSelf = Number(b.created_by) === Number(currentUser.id) ? 0 : 1;

      if (aSelf !== bSelf) return aSelf - bSelf;
      // Keep the list stable and readable by sorting by KPI name afterward.
      return a.name.localeCompare(b.name);
    });
  }

  // Get the latest status of a KPI specifically recorded for a given employee
  const getLatestStatusForEmployee = (kpiId, empId) => {
    if (!measurements) return "unknown";
    const kpiMs = measurements.filter(m => Number(m.kpi_metric_id) === Number(kpiId) && Number(m.measured_by) === Number(empId) && !m.is_deleted);
    if (kpiMs.length === 0) return "unknown";
    const sorted = [...kpiMs].sort((a, b) => String(b.period_start_date).localeCompare(String(a.period_start_date)));
    return sorted[0].status;
  };

  // Status column is shown to employees by default, and to managers/admins only when a specific employee filter is selected
  const showStatusColumn = isEmployee || (managerFilter !== "all");

  return (
    <Layout crumb={<><span>Configuration</span> · <b>KPIs</b></>}>
      <div className="page-head">
        <div>
          <h1>KPIs</h1>
          <p>Define and configure key performance indicators and their thresholds.</p>
        </div>
        {/* New KPI button is hidden for regular employees */}
        {(isAdmin || isManager) && (
          <button className="btn btn--primary" onClick={() => setEditing({})}>
            <Icon.plus /> New KPI
          </button>
        )}
      </div>

      <div className="filter-bar">
        <div className="search">
          <Icon.search />
          <input placeholder="Search KPIs or KRA areas…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {/* Filter by KPI status select dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
            Filter by KPI:
          </span>
          <select
            className="select"
            style={{ width: "auto", minWidth: "130px", padding: "0.45rem 0.6rem" }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Show All</option>
            <option value="active">Active</option>
            <option value="inactive">Not Active</option>
          </select>
        </div>
        
        {/* Manager/Admin KPI assignments filter dropdown */}
        {(isManager || isAdmin) && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
              Filter by Employee:
            </span>
            <select
              className="select"
              style={{ width: "auto", minWidth: "180px", padding: "0.45rem 0.6rem" }}
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
            >
              <option value="all">Show All</option>
              <option value="self">Only My KPIs</option>
              {isManager && employees
                .filter((e) => Number(e.managerId) === Number(currentUser.id))
                /* Sort employee options alphabetically A to Z */
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              {isAdmin && employees
                .filter((e) => Number(e.id) !== Number(currentUser.id))
                /* Sort employee/manager options alphabetically A to Z */
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({cap(e.role)})
                  </option>
                ))}
            </select>
          </div>
        )}

        <span className="tag">{filtered.length} of {baseKpis.length}</span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>KPI name</th>
                <th>KRA area</th>
                {/* Hide Assignees column for employees */}
                {!isEmployee && <th>Assignees</th>}
                <th>Target</th>
                <th>Direction</th>
                <th>Frequency</th>
                {showStatusColumn && <th>Latest status</th>}
                <th>Created By</th>
                <th>Actions</th>

              </tr>
            </thead>
            <tbody>
              {orderedKpis.map((k) => {
                const m = stats.latestByKpi[k.id];
                const myTeamEmployeeIds = new Set(
                  employees
                    .filter((e) => Number(e.managerId) === Number(currentUser.id) || Number(e.id) === Number(currentUser.id))
                    .map((e) => Number(e.id))
                );
                const isKpiAccessible = !isManager || (
                  Number(k.created_by) === Number(currentUser.id) ||
                  assignments.some(
                    (a) => Number(a.kpi_metric_id) === Number(k.id) && myTeamEmployeeIds.has(Number(a.employee_id))
                  )
                );
                return (
                  <tr key={k.id}>
                    <td>
                      <div className="cell-strong">{k.name}</div>
                      <div className="cell-sub">{k.source_system}</div>
                    </td>
                    <td><span className="tag">{kraName(k.kra_area_id)}</span></td>

                    {/* View/Edit assignments only visible to managers and admins */}
                    {!isEmployee && (
                      <td>
                        {isKpiAccessible ? (
                          // If there are no assignments for this KPI, show "Not Assigned".
                          // Otherwise render the button to view assigned employees.
                          (assignments || []).some(a => Number(a.kpi_metric_id) === Number(k.id)) ? (
                            <button className="btn btn--ghost" onClick={() => openAssignments(k)}>View Employees</button>
                          ) : (
                            <div style={{ textAlign: "center", color: "var(--muted)" }}>Not Assigned</div>
                          )
                        ) : (
                          <div style={{ textAlign: "center", color: "var(--muted)" }}>—</div>
                        )}
                      </td>
                    )}
                    
                    <td className="mono">
                      {k.direction === "higher_better" ? "≥ " : "≤ "}{k.target_value}
                      {k.unit === "Percentage" ? "%" : ""}
                    </td>
                    <td className="cell-sub">{k.direction === "higher_better" ? "Higher ↑" : "Lower ↓"}</td>
                    <td className="cell-sub">{cap(k.frequency)}</td>
                    {showStatusColumn && (
                      <td>
                        <StatusPill status={
                          isEmployee 
                            ? getLatestStatusForEmployee(k.id, currentUser.id)
                            : getLatestStatusForEmployee(k.id, managerFilter === "self" ? currentUser.id : Number(managerFilter))
                        } />
                      </td>
                    )}
                    <td className="cell-sub">{employeeName(k.created_by)}</td>
                    <td>
                      <div className="cell-actions">
                        {isKpiAccessible ? (
                          <>
                            {/* Ruler / Add Measurement - visible to admins, managers, or directly assigned employees */}
                            {(isAdmin || isManager || assignments.some(a => Number(a.kpi_metric_id) === Number(k.id) && Number(a.employee_id) === Number(currentUser.id))) && (
                              <button className="icon-btn" title="Enter measurement" onClick={() => setMeasuring(k)}>
                                <Icon.measure />
                              </button>
                            )}
                            {/* Eye / View Trend - visible to everyone */}
                            <button
                              className="icon-btn"
                              title="View trend"
                              onClick={() => {
                                const isDirectlyAssigned = assignments.some(a => Number(a.kpi_metric_id) === Number(k.id) && Number(a.employee_id) === Number(currentUser.id));
                                const isTeamKpi = k.is_team_kpi === 1 || k.is_team_kpi === true;
                                const teamAssignment = isTeamKpi ? assignments.find(a => Number(a.kpi_metric_id) === Number(k.id)) : null;

                                const assignedEmployeeIds = assignments
                                  .filter(a => Number(a.kpi_metric_id) === Number(k.id))
                                  .map(a => Number(a.employee_id));

                                let selectedEmployeeId = currentUser.id;
                                if (isManager || isAdmin) {
                                  if (managerFilter !== "all" && managerFilter !== "self" && assignedEmployeeIds.includes(Number(managerFilter))) {
                                    selectedEmployeeId = Number(managerFilter);
                                  } else if (assignedEmployeeIds.includes(Number(currentUser.id))) {
                                    selectedEmployeeId = Number(currentUser.id);
                                  } else if (assignedEmployeeIds.length > 0) {
                                    selectedEmployeeId = assignedEmployeeIds[0];
                                  }
                                } else if (isTeamKpi && !isDirectlyAssigned && teamAssignment) {
                                  selectedEmployeeId = teamAssignment.employee_id;
                                }

                                nav(`/kpis/${k.id}?viewUser=${selectedEmployeeId}`);
                              }}
                            >
                              <Icon.eye />
                            </button>
                            {/* Administrative controls: only visible to managers and admins */}
                            {(isAdmin || isManager) && (
                              <>
                                <button className="icon-btn" title="Edit" onClick={() => setEditing(k)}>
                                  <Icon.edit />
                                </button>
                                <button className="icon-btn" title="Make a Copy" onClick={() => setEditing({ ...k, id: undefined, isCopy: true, name: `${k.name} (Copy)` })}>
                                  <Icon.copy />
                                </button>
                                <button className="icon-btn" title="Assign employees" onClick={() => setAssigning(k)}>
                                  <Icon.plus />
                                </button>
                                <button className="icon-btn" title="Delete KPI" onClick={() => handleDelete(k.id)} style={{ color: "var(--bad)" }}>
                                  <Icon.trash />                                  
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          // If KPI is not accessible but user is manager or admin, show View Trend and Make a Copy button
                          (isManager || isAdmin) ? (
                            <>
                              <button
                                className="icon-btn"
                                title="View trend"
                                onClick={() => {
                                  const assignedEmployeeIds = assignments
                                    .filter(a => Number(a.kpi_metric_id) === Number(k.id))
                                    .map(a => Number(a.employee_id));

                                  let selectedEmployeeId = currentUser.id;
                                  if (managerFilter !== "all" && managerFilter !== "self" && assignedEmployeeIds.includes(Number(managerFilter))) {
                                    selectedEmployeeId = Number(managerFilter);
                                  } else if (assignedEmployeeIds.includes(Number(currentUser.id))) {
                                    selectedEmployeeId = Number(currentUser.id);
                                  } else if (assignedEmployeeIds.length > 0) {
                                    selectedEmployeeId = assignedEmployeeIds[0];
                                  }

                                  nav(`/kpis/${k.id}?viewUser=${selectedEmployeeId}`);
                                }}
                              >
                                <Icon.eye />
                              </button>
                              <button className="icon-btn" title="Make a Copy" onClick={() => setEditing({ ...k, id: undefined, isCopy: true, name: `${k.name} (Copy)` })}>
                                <Icon.copy />
                              </button>
                            </>
                          ) : (
                            <div style={{ textAlign: "center", color: "var(--muted)" }}>—</div>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal
          title={editing.id ? "Edit KPI" : (editing.isCopy ? "Copy KPI" : "New KPI")}
          subtitle={editing.id ? editing.name : (editing.isCopy ? `Copy of ${editing.name.replace(" (Copy)", "")}` : "Define a new key performance indicator")}
          onClose={() => setEditing(null)} wide>
          <KpiForm initial={editing.id ? editing : (editing.isCopy ? editing : null)} kpis={kpis} isCopy={editing.isCopy} saving={saving}
            onSubmit={handleSave} onCancel={() => setEditing(null)} />
        </Modal>
      )}

      {measuring && (
        <Modal
          title="Enter measurement"
          subtitle={measuring.name}
          onClose={() => setMeasuring(null)} wide>
          <MeasurementForm lockedKpiId={measuring.id} saving={saving}
            onSubmit={handleMeasure} onCancel={() => setMeasuring(null)} />
        </Modal>
      )}

      {assigning && (
  <Modal
    title="Assign KPI"
    subtitle={assigning.name}
    onClose={() => setAssigning(null)}
    wide
  >
    <KpiAssignmentForm
      kpiId={assigning.id}
      saving={saving}
      onSubmit={handleAssignmentSave}
      onCancel={() => setAssigning(null)}
      assignments={assignments} // Pass current assignments for duplicate validation
      isTeamKpi={assigning.is_team_kpi === 1 || assigning.is_team_kpi === true}
    />
  </Modal>
)}



{viewAssignments && (

  <Modal
    title="Assigned Employees"
    subtitle={viewAssignments.name}
    onClose={() => setViewAssignments(null)}
    wide
  >

    <table className="data">

      <thead>

       <tr>
  <th>Employee</th>
  <th>Team</th>
  <th>Primary</th>
  <th>From</th>
  <th>To</th>
  <th>Actions</th>
</tr>

      </thead>
      <tbody>{assignmentRows.map(a => {
        const targetEmployee = employees.find(e => Number(e.id) === Number(a.employee_id));
        const isSelfOrTeamMember = Number(a.employee_id) === Number(currentUser.id) || 
          (targetEmployee && Number(targetEmployee.managerId) === Number(currentUser.id));
        const canEditOrDeleteAssignment = isAdmin || isSelfOrTeamMember;
        return (
          <tr key={a.id}>
            <td>{a.employee_name}</td>
            <td>{a.team || "—"}</td>
            <td>{a.is_primary ? "Yes" : "No"}</td>
            <td>{a.assigned_from}</td>
            <td>{a.assigned_to || "—"}</td>
            <td>
              {canEditOrDeleteAssignment ? (
                <div className="cell-actions">
                  <button className="icon-btn" title="Edit assignment" onClick={() => setEditingAssignment(a)}><Icon.edit /></button>
                  <button className="icon-btn"  title="Delete assignment" onClick={() => handleDeleteAssignment(a.id)}><Icon.trash /></button>
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "var(--muted)" }}>—</div>
              )}
            </td>
          </tr>
        );
      })}
      </tbody>
    </table>
  </Modal>
)}

{editingAssignment && (

  <Modal
    title="Edit Assignment"
    subtitle={editingAssignment.employee_name}
    onClose={() => setEditingAssignment(null)}
    wide
  >

    <KpiAssignmentForm
      initial={editingAssignment}
      kpiId={editingAssignment.kpi_metric_id}
      saving={saving}
      onSubmit={handleAssignmentSave}
      onCancel={() => setEditingAssignment(null)}
      assignments={assignments} // Pass current assignments for duplicate validation
    />

  </Modal>

)}



      {toast && <Toast message={toast} />}
    </Layout>
  );
}
function cap(s) {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}
