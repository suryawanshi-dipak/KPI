import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Modal, Spinner, StatusPill, Toast } from "../components/UI";
import { Icon } from "../components/Icon";
import KraForm from "../forms/KraForm";
import { listKras, listKpis, saveKra, getStats, deleteKra, getCurrentUser, listAssignments, employeeName, listEmployees} from "../lib/store";

export default function Kras() {
  const [kras, setKras] = useState(null);
  const [kpis, setKpis] = useState([]);
  const [stats, setStats] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [kraFilter, setKraFilter] = useState("all");
  const [q, setQ] = useState("");
  // Track which KRA area cards have their KPI lists expanded
  const [expandedKras, setExpandedKras] = useState({});

  // Helper function to toggle expansion state of a specific KRA card
  const toggleKraExpanded = (id) => {
    setExpandedKras((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const load = () => Promise.all([listKras(), listKpis(), getStats(), getCurrentUser(), listAssignments(), listEmployees()])
    .then(([r, k, s, user, a, e]) => { setKras(r); setKpis(k); setStats(s); setCurrentUser(user); setAssignments(a); setEmployees(e); });
  useEffect(() => { load(); }, []);

  function flash(m){ setToast(m); setTimeout(()=>setToast(null),2400); }
  async function handleSave(p){ setSaving(true); await saveKra(p); setSaving(false); setEditing(null); await load(); flash(p.id?"KRA updated":"KRA created"); }
  
  async function handleDelete(id, name) {
    if (window.confirm(`Are you sure you want to delete the KRA area "${name}"?`)) {
      try {
        await deleteKra(id);
        await load();
        flash("KRA deleted");
      } catch (err) {
        alert(err.message || "Failed to delete KRA Area");
      }
    }
  }

  if (!kras || !stats || !currentUser) return <Layout crumb={<b>KRA Areas</b>}><Spinner /></Layout>;

  const isEmployee = currentUser.role === "employee";
  const isManager = currentUser.role === "manager";
  const isAdmin = currentUser.role === "admin";

  const visibleKras = (() => {
    if (kraFilter === "all") return kras;

    const currentUserId = Number(currentUser.id);

    if (kraFilter === "my") {
      const assignedKpiIds = new Set(
        assignments
          .filter((assignment) => Number(assignment.employee_id) === currentUserId)
          .map((assignment) => Number(assignment.kpi_metric_id))
      );

      return kras.filter((kra) => {
        const areaKpis = kpis.filter((kpi) => Number(kpi.kra_area_id) === Number(kra.id));
        const isCreatedByMe = Number(kra.created_by) === currentUserId;
        const hasAssignedKpi = areaKpis.some((kpi) => assignedKpiIds.has(Number(kpi.id)));
        return isCreatedByMe || hasAssignedKpi;
      });
    }

    const selectedPersonId = Number(kraFilter);
    if (!Number.isNaN(selectedPersonId) && selectedPersonId > 0) {
      const selectedPersonKpiIds = new Set(
        assignments
          .filter((assignment) => Number(assignment.employee_id) === selectedPersonId)
          .map((assignment) => Number(assignment.kpi_metric_id))
      );

      return kras.filter((kra) => {
        const areaKpis = kpis.filter((kpi) => Number(kpi.kra_area_id) === Number(kra.id));
        const isCreatedBySelectedPerson = Number(kra.created_by) === selectedPersonId;
        const hasSelectedPersonKpi = areaKpis.some((kpi) => selectedPersonKpiIds.has(Number(kpi.id)));
        return isCreatedBySelectedPerson || hasSelectedPersonKpi;
      });
    }

    return kras;
  })();

  const filteredKras = visibleKras.filter((kra) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return [kra.area_name, kra.financial_year]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });

  return (
    <Layout crumb={<><span>Configuration</span> · <b>KRA Areas</b></>}>
      <div className="page-head">
        <div><h1>KRA areas</h1><p>Key Result Areas group related KPIs for review and reporting.</p></div>
        {!isEmployee && (
          <button className="btn btn--primary" onClick={() => setEditing({})}><Icon.plus /> New KRA area</button>
        )}
      </div>

      <div className="filter-bar" style={{ marginBottom: "1rem" }}>
        <div className="search">
          <Icon.search />
          <input placeholder="Search KRA areas…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
            Filter:
          </span>
          <select
            className="select"
            style={{ width: "auto", minWidth: "180px", padding: "0.45rem 0.6rem" }}
            value={kraFilter}
            onChange={(e) => setKraFilter(e.target.value)}
          >
            <option value="all">Show All KRAs</option>
            <option value="my">My KRAs</option>
            {isManager && employees
              .filter((employee) => Number(employee.managerId) === Number(currentUser.id) && Number(employee.id) !== Number(currentUser.id))
              /* Sort employee options alphabetically A to Z */
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            {isAdmin && employees
              .filter((employee) => employee.role === "manager" && Number(employee.id) !== Number(currentUser.id))
              /* Sort manager options alphabetically A to Z */
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
          </select>
        </div>
        <span className="tag">{filteredKras.length} of {visibleKras.length}</span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:"1rem" }}>
        {filteredKras.map((kra) => {
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
                  <div className="cell-sub" style={{marginTop:2}}>
                    {kra.financial_year} · Created by: {employeeName(kra.created_by)}
                  </div>
                </div>
                {!isEmployee && (
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    <button className="icon-btn" title="Edit" onClick={() => setEditing(kra)}><Icon.edit /></button>
                    <button className="icon-btn icon-btn--danger" title="Delete" onClick={() => handleDelete(kra.id, kra.area_name)} style={{ color: "var(--bad)" }}><Icon.trash /></button>
                  </div>
                )}
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
                  {/* Show all KPIs if card is expanded, otherwise slice to only show the first 4 */}
                  {(expandedKras[kra.id] ? areaKpis : areaKpis.slice(0, 4)).map((k) => (
                    <div key={k.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:"0.84rem" }}>{k.name}</span>
                      <StatusPill status={stats.latestByKpi[k.id]?.status || "unknown"} />
                    </div>
                  ))}
                  
                  {/* Show "Show More" or "Show Less" toggle button if KRA area contains more than 4 KPIs */}
                  {areaKpis.length > 4 && (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{
                        padding: "0.2rem 0.5rem",
                        fontSize: "0.78rem",
                        height: "auto",
                        marginTop: "0.25rem",
                        color: "var(--primary)",
                        alignSelf: "flex-start",
                        fontWeight: 600
                      }}
                      onClick={() => toggleKraExpanded(kra.id)}
                    >
                      {expandedKras[kra.id] ? "Show Less" : `Show More (+${areaKpis.length - 4})`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!isEmployee && editing && (
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
