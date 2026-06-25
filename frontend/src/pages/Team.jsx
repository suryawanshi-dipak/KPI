import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Spinner } from "../components/UI";
import { listEmployees, listAssignments, listKpis, getStats } from "../lib/store";

export default function Team() {
  const [people, setPeople] = useState(null);
  const [assign, setAssign] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([listEmployees(), listAssignments(), listKpis(), getStats()])
      .then(([p,a,k,s]) => { setPeople(p); setAssign(a); setKpis(k); setStats(s); });
  }, []);

  if (!people || !stats) return <Layout crumb={<b>Team</b>}><Spinner /></Layout>;

  const members = people.filter((p) => p.role !== "admin");

  return (
    <Layout crumb={<b>Team</b>}>
      <div className="page-head"><div><h1>Team dashboard</h1><p>KPI ownership and health by team member.</p></div></div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"1rem" }}>
        {members.map((m) => {
          const myKpiIds = new Set(assign.filter((a)=>Number(a.employee_id)===Number(m.id)).map((a)=>Number(a.kpi_metric_id)));
          const counts = { green:0, amber:0, red:0 };
          myKpiIds.forEach((id) => {
            const s = stats.latestByKpi[id]?.status || "unknown";
            if (s==="green") counts.green++; else if (s==="amber") counts.amber++;
            else if (s==="red"||s==="critical") counts.red++;
          });
          const total = Math.max(myKpiIds.size,1);
          const health = Math.round((counts.green/total)*100);
          const initials = (m.name||"?").split(" ").map(w=>w[0]).slice(0,2).join("");
          return (
            <div className="card" key={m.id}>
              <div className="card__body">
                <div style={{ display:"flex", gap:"0.7rem", alignItems:"center", marginBottom:"0.8rem" }}>
                  <div className="avatar" style={{ width:40, height:40, fontSize:"0.9rem" }}>{initials}</div>
                  <div>
                    <div className="cell-strong">{m.name}</div>
                    <div className="cell-sub" style={{ textTransform:"capitalize" }}>{m.designation || m.role}</div>
                  </div>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.35rem" }}>
                  <span className="cell-sub">Health</span><span className="cell-strong">{health}%</span>
                </div>
                <div className="health-bar">
                  <span className="h-green" style={{ width:`${counts.green/total*100}%` }} />
                  <span className="h-amber" style={{ width:`${counts.amber/total*100}%` }} />
                  <span className="h-red" style={{ width:`${counts.red/total*100}%` }} />
                </div>
                <div className="cell-sub" style={{ marginTop:"0.6rem" }}>
                  {myKpiIds.size} KPIs · {counts.green}G {counts.amber}A {counts.red}R
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
