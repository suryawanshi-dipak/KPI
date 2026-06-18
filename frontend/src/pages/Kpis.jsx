import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { Modal, Spinner, StatusPill, Toast } from "../components/UI";
import { Icon } from "../components/Icon";
import KpiForm from "../forms/KpiForm";
import MeasurementForm from "../forms/MeasurementForm";
import { listKpis, saveKpi, getStats, kraName, saveMeasurement , deleteKpi } from "../lib/store";

export default function Kpis() {
  const [kpis, setKpis] = useState(null);
  const [stats, setStats] = useState(null);
  const [editing, setEditing] = useState(null); // {} for new, {id...} for edit
  const [measuring, setMeasuring] = useState(null); // kpi being measured
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [q, setQ] = useState("");
  const nav = useNavigate();

  const load = () => Promise.all([listKpis(), getStats()]).then(([k, s]) => { setKpis(k); setStats(s); });
  useEffect(() => { load(); }, []);

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
                <th>KPI name</th><th>KRA area</th><th>Target</th>
                <th>Direction</th><th>Frequency</th><th>Latest status</th><th></th>
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

      {toast && <Toast message={toast} />}
    </Layout>
  );
}
function cap(s) {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}
