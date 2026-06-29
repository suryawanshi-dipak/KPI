import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import Layout from "../components/Layout";
import { Modal, Spinner, StatusPill, Toast } from "../components/UI";
import { Icon } from "../components/Icon";
import MeasurementForm from "../forms/MeasurementForm";
import { getKpi, measurementsForKpi, saveMeasurement, kraName, employeeName } from "../lib/store";

export default function KpiDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [kpi, setKpi] = useState(null);
  const [ms, setMs] = useState([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const load = () => Promise.all([getKpi(id), measurementsForKpi(id)]).then(([k,m]) => { setKpi(k); setMs(m); });
  useEffect(() => { load(); }, [id]);
  function flash(m){ setToast(m); setTimeout(()=>setToast(null),2400); }
  async function handleSave(p){ setSaving(true); await saveMeasurement(p); setSaving(false); setAdding(false); await load(); flash("Measurement saved"); }

  if (!kpi) return <Layout crumb={<b>KPI</b>}><Spinner /></Layout>;

  const activeMs = ms.filter(m => {
    // A measurement is superseded if there is another measurement in ms whose corrected_from_id matches its id
    return !ms.some(other => Number(other.corrected_from_id) === Number(m.id));
  });

  const chartData = activeMs
    .filter(m => !m.is_pending && m.measured_value !== null && m.measured_value !== undefined)
    .map((m) => ({
      period: m.measurement_period_label,
      value: Number(m.measured_value)
    }));

  const latest = activeMs[activeMs.length - 1];

  return (
    <Layout crumb={<><span onClick={()=>nav("/kpis")} style={{cursor:"pointer"}}>KPIs</span> · <b>{kpi.name}</b></>}>
      <div className="page-head">
        <div>
          <h1>{kpi.name}</h1>
          <p>{kraName(kpi.kra_area_id)} · {cap(kpi.frequency)} · target {kpi.direction==="higher_better"?"≥":"≤"} {kpi.target_value}{kpi.unit==="Percentage"?"%":` ${kpi.unit}`}</p>
        </div>
        <button className="btn btn--primary" onClick={()=>setAdding(true)}><Icon.measure /> Enter measurement</button>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="stat__label">Latest value</div><div className="stat__value mono">{latest?.measured_value ?? "—"}</div><div className="stat__sub">{latest?.measurement_period_label || "no data"}</div></div>
        <div className="stat"><div className="stat__label">Latest status</div><div style={{marginTop:"0.5rem"}}><StatusPill status={latest?.status||"unknown"} /></div></div>
        <div className="stat"><div className="stat__label">Target</div><div className="stat__value mono">{kpi.target_value}</div><div className="stat__sub">{kpi.unit}</div></div>
        <div className="stat"><div className="stat__label">Records</div><div className="stat__value">{activeMs.length}</div><div className="stat__sub">measurements</div></div>
      </div>

      <div className="card" style={{ marginBottom:"1.1rem" }}>
        <div className="card__head"><h3>Trend over time</h3><span className="tag">target line shown</span></div>
        <div className="card__body" style={{ height:280 }}>
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top:8, right:14, bottom:4, left:-14 }}>
                <XAxis dataKey="period" tick={{ fontSize:11, fill:"#7d879c" }} />
                <YAxis tick={{ fontSize:11, fill:"#7d879c" }} />
                <Tooltip />
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
              {[...ms].reverse().map((m) => (
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
