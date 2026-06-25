import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Modal, Spinner, StatusPill, Toast } from "../components/UI";
import { Icon } from "../components/Icon";
import KraForm from "../forms/KraForm";
import { listKras, listKpis, saveKra, getStats } from "../lib/store";

export default function Kras() {
  const [kras, setKras] = useState(null);
  const [kpis, setKpis] = useState([]);
  const [stats, setStats] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const load = () => Promise.all([listKras(), listKpis(), getStats()])
    .then(([r, k, s]) => { setKras(r); setKpis(k); setStats(s); });
  useEffect(() => { load(); }, []);

  function flash(m){ setToast(m); setTimeout(()=>setToast(null),2400); }
  async function handleSave(p){ setSaving(true); await saveKra(p); setSaving(false); setEditing(null); await load(); flash(p.id?"KRA updated":"KRA created"); }

  if (!kras || !stats) return <Layout crumb={<b>KRA Areas</b>}><Spinner /></Layout>;

  return (
    <Layout crumb={<><span>Configuration</span> · <b>KRA Areas</b></>}>
      <div className="page-head">
        <div><h1>KRA areas</h1><p>Key Result Areas group related KPIs for review and reporting.</p></div>
        <button className="btn btn--primary" onClick={() => setEditing({})}><Icon.plus /> New KRA area</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:"1rem" }}>
        {kras.map((kra) => {
          const areaKpis = kpis.filter((k) => Number(k.kra_area_id) === Number(kra.id));
          const counts = { green:0, amber:0, red:0 };
          areaKpis.forEach((k) => {
            const s = stats.latestByKpi[k.id]?.status || "unknown";
            if (s==="green") counts.green++; else if (s==="amber") counts.amber++;
            else if (s==="red"||s==="critical") counts.red++;
          });
          const total = Math.max(areaKpis.length,1);
          return (
            <div className="card" key={kra.id}>
              <div className="card__head">
                <div>
                  <h3>{kra.area_name}</h3>
                  <div className="cell-sub" style={{marginTop:2}}>{kra.financial_year}</div>
                </div>
                <button className="icon-btn" title="Edit" onClick={() => setEditing(kra)}><Icon.edit /></button>
              </div>
              <div className="card__body">
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.5rem" }}>
                  <span className="tag">{areaKpis.length} KPIs</span>
                  <span className="cell-sub">{counts.green} green · {counts.amber} amber · {counts.red} red</span>
                </div>
                <div className="health-bar">
                  <span className="h-green" style={{ width:`${counts.green/total*100}%` }} />
                  <span className="h-amber" style={{ width:`${counts.amber/total*100}%` }} />
                  <span className="h-red" style={{ width:`${counts.red/total*100}%` }} />
                </div>
                <div style={{ marginTop:"0.9rem", display:"flex", flexDirection:"column", gap:"0.5rem" }}>
                  {areaKpis.slice(0,4).map((k) => (
                    <div key={k.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:"0.84rem" }}>{k.name}</span>
                      <StatusPill status={stats.latestByKpi[k.id]?.status || "unknown"} />
                    </div>
                  ))}
                  {areaKpis.length > 4 && <span className="cell-sub">+{areaKpis.length-4} more</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <Modal title={editing.id ? "Edit KRA area" : "New KRA area"}
          subtitle={editing.id ? editing.area_name : "Group related KPIs under a Key Result Area"}
          onClose={() => setEditing(null)}>
          <KraForm initial={editing.id ? editing : null} saving={saving}
            onSubmit={handleSave} onCancel={() => setEditing(null)} />
        </Modal>
      )}
      {toast && <Toast message={toast} />}
    </Layout>
  );
}
