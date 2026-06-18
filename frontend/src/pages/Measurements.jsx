import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Modal, Spinner, StatusPill, Toast } from "../components/UI";
import { Icon } from "../components/Icon";
import MeasurementForm from "../forms/MeasurementForm";
import {listMeasurements, listKpis , saveMeasurement, deleteMeasurement, employeeName} from "../lib/store";

export default function Measurements() {
  const [rows, setRows] = useState(null);
  const [kpis, setKpis] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [q, setQ] = useState("");

  const load = () => Promise.all([listMeasurements(), listKpis()])
    .then(([m, k]) => { setRows(m.sort((a,b)=>String(b.period_start_date).localeCompare(String(a.period_start_date)))); setKpis(k); });
  useEffect(() => { load(); }, []);

  const kpiName = (id) => kpis.find((k) => Number(k.id) === Number(id))?.name || "—";
  function flash(m){ setToast(m); setTimeout(()=>setToast(null),2400); }
  
  
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

  const filtered = rows.filter((m) => kpiName(m.kpi_metric_id).toLowerCase().includes(q.toLowerCase())
    || String(m.measurement_period_label).toLowerCase().includes(q.toLowerCase()));

  return (
    <Layout crumb={<b>Measurements</b>}>
      <div className="page-head">
        <div><h1>Measurements</h1><p>Every recorded KPI reading, with who measured it and when.</p></div>
        <button className="btn btn--primary" onClick={() => setAdding(true)}><Icon.plus /> Enter measurement</button>
      </div>

      <div className="filter-bar">
        <div className="search"><Icon.search /><input placeholder="Search by KPI or period…" value={q} onChange={(e)=>setQ(e.target.value)} /></div>
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

    <button className="icon-btn" title="Edit" onClick={() => setEditing(m)} ><Icon.edit /></button>
    <button className="icon-btn" title="Delete Measurement" onClick={() => handleDelete(m.id)}  style={{ color: "var(--bad)" }}><Icon.trash /></button>
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
