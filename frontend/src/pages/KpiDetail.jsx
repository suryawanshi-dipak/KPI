import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import Layout from "../components/Layout";
import { Modal, Spinner, StatusPill, Toast } from "../components/UI";
import { Icon } from "../components/Icon";
import MeasurementForm from "../forms/MeasurementForm";
import { getCurrentUser, getKpi, listEmployees, measurementsForKpi, saveMeasurement, kraName, employeeName, listAssignments } from "../lib/store";

function buildViewOptions(currentUser, employeesList, assignmentsList, kpiId) {
  const options = [];

  if (!currentUser) return options;

  const assignedEmployeeIds = (assignmentsList || [])
    .filter((a) => Number(a.kpi_metric_id) === Number(kpiId))
    .map((a) => Number(a.employee_id));

  if (String(currentUser.role).toLowerCase() === "manager") {
    if (assignedEmployeeIds.includes(Number(currentUser.id))) {
      options.push({ id: Number(currentUser.id), name: currentUser.name || "Me", role: currentUser.role });
    }
    const reports = employeesList.filter((employee) => Number(employee.managerId) === Number(currentUser.id));
    reports.forEach((employee) => {
      if (assignedEmployeeIds.includes(Number(employee.id))) {
        if (!options.some((option) => Number(option.id) === Number(employee.id))) {
          options.push({ id: Number(employee.id), name: employee.name, role: employee.role });
        }
      }
    });
  } else if (String(currentUser.role).toLowerCase() === "admin") {
    employeesList.forEach((employee) => {
      if (assignedEmployeeIds.includes(Number(employee.id))) {
        const isSelf = Number(employee.id) === Number(currentUser.id);
        options.push({
          id: Number(employee.id),
          name: isSelf ? `${employee.name || "Me"} (Admin)` : employee.name,
          role: employee.role
        });
      }
    });
  }

  if (options.length === 0) {
    options.push({ id: Number(currentUser.id), name: currentUser.name || "Me", role: currentUser.role });
  }

  return options;
}

export default function KpiDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const [kpi, setKpi] = useState(null);
  const [ms, setMs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [viewOptions, setViewOptions] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const load = async () => {
    const [kpiData, measurementsData, user, employeesList, assignmentsList] = await Promise.all([
      getKpi(id),
      measurementsForKpi(id),
      getCurrentUser(),
      listEmployees(),
      listAssignments(),
    ]);

    const options = buildViewOptions(user, employeesList, assignmentsList, id);
    const params = new URLSearchParams(location.search);
    const requestedUserId = Number(params.get("viewUser"));
    const canSelectUser = user && ["manager", "admin"].includes(String(user.role).toLowerCase());
    const defaultUserId = canSelectUser
      ? (options.some((option) => Number(option.id) === Number(requestedUserId))
          ? Number(requestedUserId)
          : (options.find((option) => Number(option.id) === Number(selectedUserId))?.id ?? options[0]?.id ?? user.id))
      : Number(user.id);

    setKpi(kpiData);
    setMs(measurementsData);
    setCurrentUser(user);
    setViewOptions(options);
    setSelectedUserId(defaultUserId);
  };
  useEffect(() => { load(); }, [id, location.search]);
  function flash(m){ setToast(m); setTimeout(()=>setToast(null),2400); }
  async function handleSave(p){ setSaving(true); await saveMeasurement(p); setSaving(false); setAdding(false); await load(); flash("Measurement saved"); }

  if (!kpi) return <Layout crumb={<b>KPI</b>}><Spinner /></Layout>;

  const canSelectUser = currentUser && ["manager", "admin"].includes(String(currentUser.role).toLowerCase());
  const effectiveUserId = selectedUserId ?? currentUser?.id ?? null;
  const visibleMeasurements = effectiveUserId
    ? ms.filter((measurement) => Number(measurement.measured_by) === Number(effectiveUserId))
    : ms;

  const activeMs = visibleMeasurements.filter(m => {
    // A measurement is superseded if there is another measurement in visibleMeasurements whose corrected_from_id matches its id
    return !visibleMeasurements.some(other => Number(other.corrected_from_id) === Number(m.id));
  });

  const chartData = activeMs
    .filter(m => !m.is_pending && m.measured_value !== null && m.measured_value !== undefined)
    // Added index key to guarantee unique keys on XAxis, resolving the Recharts duplicate key tooltip bug
    .map((m, i) => ({
      index: i,
      period: m.measurement_period_label,
      value: Number(m.measured_value)
    }));

  const latest = activeMs[activeMs.length - 1];

  return (
    <Layout crumb={<><span onClick={()=>nav("/kpis")} style={{cursor:"pointer"}}>KPIs</span> · <b>{kpi.name}</b></>}>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1>{kpi.name}</h1>
          <p>{kraName(kpi.kra_area_id)} · {cap(kpi.frequency)} · target {kpi.direction==="higher_better"?"≥":"≤"} {kpi.target_value}{kpi.unit==="Percentage"?"%":` ${kpi.unit}`}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          {canSelectUser && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--ink-soft)", fontWeight: 600 }}>View by employee</label>
              <select
                className="select"
                value={effectiveUserId || ""}
                onChange={(event) => setSelectedUserId(Number(event.target.value))}
                style={{ minWidth: 220 }}
              >
                {viewOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}{option.role ? ` (${option.role})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button className="btn btn--primary" style={{ alignSelf: "flex-end", height: 42 }} onClick={()=>setAdding(true)}>
            <Icon.measure /> Enter measurement
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="stat__label">Latest value</div><div className="stat__value mono">{latest?.measured_value ?? "—"}</div><div className="stat__sub">{latest?.measurement_period_label || "no data"}</div></div>
        <div className="stat"><div className="stat__label">Latest status</div><div style={{marginTop:"0.5rem"}}><StatusPill status={latest?.status||"unknown"} /></div></div>
        <div className="stat"><div className="stat__label">Target</div><div className="stat__value mono">{kpi.target_value}</div><div className="stat__sub">{kpi.unit}</div></div>
        <div className="stat"><div className="stat__label">Records</div><div className="stat__value">{activeMs.length}</div><div className="stat__sub">measurements</div></div>
      </div>

      <div className="card" style={{ marginBottom:"1.1rem" }}>
        <div className="card__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Trend over time</h3>
            <span className="tag">target line shown</span>
          </div>
        </div>
        <div className="card__body" style={{ height:280 }}>
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top:8, right:14, bottom:4, left:-14 }}>
                {/* Using index as dataKey and tickFormatter to display period label cleanly, preventing hover index overlap */}
                <XAxis dataKey="index" tickFormatter={(tick) => chartData[tick]?.period || ""} tick={{ fontSize:11, fill:"#7d879c" }} />
                <YAxis tick={{ fontSize:11, fill:"#7d879c" }} />
                {/* custom labelFormatter to map index back to the period name */}
                <Tooltip labelFormatter={(label) => chartData[label]?.period || ""} />
                <ReferenceLine y={kpi.target_value} stroke="#1f8a4c" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="value" stroke="#3a5bd9" strokeWidth={2.5} dot={{ r:3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="empty"><h3>No measurements yet</h3><p>Enter the first reading to start the trend.</p></div>}
        </div>
      </div>

      <div className="card">
        <div className="card__head"><h3>Measurement history</h3></div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Period</th><th>Value</th><th>Status</th><th>By</th><th>Note</th><th>Post-action</th></tr></thead>
            <tbody>
              {[...visibleMeasurements].reverse().map((m) => (
                <tr key={m.id}>
                  <td><div className="mono">{m.measurement_period_label}</div><div className="cell-sub">{m.period_start_date} → {m.period_end_date}</div></td>
                  <td className="mono">{m.is_pending?"—":m.measured_value}</td>
                  <td><StatusPill status={m.status} /></td>
                  <td className="cell-sub">{employeeName(m.measured_by)}</td>
                  <td className="cell-sub" style={{ maxWidth:240 }}>{m.is_pending?`Pending: ${m.pending_reason||""}`:(m.measurement_note||"—")}</td>
                  <td className="cell-sub">{m.post_action || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {adding && (
        <Modal title="Enter measurement" subtitle={kpi.name} onClose={()=>setAdding(false)} wide>
          <MeasurementForm lockedKpiId={kpi.id} saving={saving} onSubmit={handleSave} onCancel={()=>setAdding(false)} />
        </Modal>
      )}
      {toast && <Toast message={toast} />}
    </Layout>
  );
}
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
