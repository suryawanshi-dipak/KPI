import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { Modal, Spinner, StatusPill, Toast } from "../components/UI";
import { Icon } from "../components/Icon";
import KpiForm from "../forms/KpiForm";
import MeasurementForm from "../forms/MeasurementForm";
import { listKpis, saveKpi, getStats, kraName, saveMeasurement , deleteKpi , saveAssignment , assignmentsForKpi , deleteAssignment } from "../lib/store";
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

//   const [assignmentCounts, setAssignmentCounts] = useState({});
const [editingAssignment, setEditingAssignment] = useState(null);
  const [toast, setToast] = useState(null);
  const [q, setQ] = useState("");
  const nav = useNavigate();

  const load = () =>
  Promise.all([listKpis(), getStats()])
    .then(([k, s]) => {
      setKpis(k);
      setStats(s);
    });


useEffect(() => {load();}, []);



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


async function handleAssignmentSave(payload) {

  setSaving(true);

  try {

    await saveAssignment(payload);

    setAssigning(null);
    setEditingAssignment(null);

    if (viewAssignments) {

      const rows =
        await assignmentsForKpi(viewAssignments.id);

      setAssignmentRows(rows);
    }

    await load();

    flash(
      payload.id
        ? "Assignment updated"
        : "Assignment created"
    );

  }
  catch (err) {

    console.error(err);

    flash("Failed to save assignment");

  }
  finally {

    setSaving(false);

  }
}

  
// async function handleAssignmentSave(payload) {
//   setSaving(true);
//   try {
//     await saveAssignment(payload);

//     setAssigning(null);

//     await load();

//     flash("Assignment saved");
//   }
//   catch (err) {
//     console.error(err);
//     flash("Failed to save assignment");
//   }
//   finally {
//     setSaving(false);
//   }
// }


async function handleDeleteAssignment(id) {

  if (!window.confirm("Delete this assignment?"))
    return;

  try {

    await deleteAssignment(id);

    const rows = await assignmentsForKpi(viewAssignments.id);

    setAssignmentRows(rows);

    flash("Assignment deleted");

  }
  catch (err) {

    console.error(err);

    flash("Failed to delete assignment");

  }
}


  if (!kpis || !stats) return <Layout crumb={<b>KPIs</b>}><Spinner /></Layout>;

  const filtered = kpis.filter((k) =>
    k.name.toLowerCase().includes(q.toLowerCase()) ||
    kraName(k.kra_area_id).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <Layout crumb={<><span>Configuration</span> · <b>KPIs</b></>}>
      <div className="page-head">
        <div>
          <h1>KPIs</h1>
          <p>Define and configure key performance indicators and their thresholds.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setEditing({})}>
          <Icon.plus /> New KPI
        </button>
      </div>

      <div className="filter-bar">
        <div className="search">
          <Icon.search />
          <input placeholder="Search KPIs or KRA areas…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="tag">{filtered.length} of {kpis.length}</span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>KPI name</th><th>KRA area</th><th>Assignees</th><th>Target</th>
                <th>Direction</th><th>Frequency</th><th>Latest status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((k) => {
                const m = stats.latestByKpi[k.id];
                return (
                  <tr key={k.id}>
                    <td>
                      <div className="cell-strong">{k.name}</div>
                      <div className="cell-sub">{k.source_system}</div>
                    </td>
                    <td><span className="tag">{kraName(k.kra_area_id)}</span></td>

<td><button className="btn btn--ghost" onClick={() => openAssignments(k)}>View Employees</button></td>
                    
                    <td className="mono">
                      {k.direction === "higher_better" ? "≥ " : "≤ "}{k.target_value}
                      {k.unit === "Percentage" ? "%" : ""}
                    </td>
                    <td className="cell-sub">{k.direction === "higher_better" ? "Higher ↑" : "Lower ↓"}</td>
                    <td className="cell-sub">{cap(k.frequency)}</td>
                    <td><StatusPill status={m?.status || "unknown"} /></td>
                    <td>
                      <div className="cell-actions">
                        <button className="icon-btn" title="Enter measurement" onClick={() => setMeasuring(k)}>
                          <Icon.measure />
                        </button>
                        <button className="icon-btn" title="View trend" onClick={() => nav(`/kpis/${k.id}`)}>
                          <Icon.eye />
                        </button>
                        <button className="icon-btn" title="Edit" onClick={() => setEditing(k)}>
                          <Icon.edit />
                        </button>
                        <button className="icon-btn" title="Assign employees" onClick={() => setAssigning(k)}><Icon.plus /></button>
                        <button className="icon-btn" title="Delete KPI" onClick={() => handleDelete(k.id)}  style={{ color: "var(--bad)" }}>
                          <Icon.trash />                                  
                        </button>
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
          title={editing.id ? "Edit KPI" : "New KPI"}
          subtitle={editing.id ? editing.name : "Define a new key performance indicator"}
          onClose={() => setEditing(null)} wide>
          <KpiForm initial={editing.id ? editing : null} saving={saving}
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
      <tbody>{assignmentRows.map(a => (
<tr key={a.id}>

  <td>{a.employee_name}</td>
  <td>{a.team || "—"}</td>
  <td>{a.is_primary ? "Yes" : "No"}</td>
  <td>{a.assigned_from}</td>
  <td>{a.assigned_to || "—"}</td>
  <td><div className="cell-actions">
    <button className="icon-btn" title="Edit assignment" onClick={() => setEditingAssignment(a)}><Icon.edit /></button>
    <button className="icon-btn"  title="Delete assignment" onClick={() => handleDeleteAssignment(a.id)}><Icon.trash /></button>
    </div></td></tr>
))}
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
