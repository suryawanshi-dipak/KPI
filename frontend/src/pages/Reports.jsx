import Layout from "../components/Layout";
import { Icon } from "../components/Icon";

const REPORTS = [
  { title:"Executive summary", desc:"High-level overview of organizational KPI health." },
  { title:"KPI health report", desc:"Detailed analysis of all KPI statuses and trends." },
  { title:"Performance trends", desc:"Historical performance analysis and forecasting." },
  { title:"Team comparison", desc:"Compare performance across teams and members." },
];

export default function Reports() {
  return (
    <Layout crumb={<><span>Administration</span> · <b>Reports</b></>}>
      <div className="page-head"><div><h1>Reports &amp; analytics</h1><p>Generate KPI reports for reviews and stakeholders.</p></div></div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"1rem" }}>
        {REPORTS.map((r) => (
          <div className="card" key={r.title}>
            <div className="card__body">
              <div style={{ width:38, height:38, borderRadius:10, background:"var(--primary-bg)", color:"var(--primary)", display:"grid", placeItems:"center", marginBottom:"0.8rem" }}>
                <Icon.reports style={{ width:19, height:19 }} />
              </div>
              <h3 style={{ fontSize:"1rem", marginBottom:"0.3rem" }}>{r.title}</h3>
              <p className="cell-sub" style={{ marginBottom:"1rem" }}>{r.desc}</p>
              <button className="btn" style={{ width:"100%" }} disabled>Generate report</button>
            </div>
          </div>
        ))}
      </div>
      <p className="cell-sub" style={{ marginTop:"1.2rem" }}>Report generation is a Phase 2 feature — wired to the backend later.</p>
    </Layout>
  );
}
