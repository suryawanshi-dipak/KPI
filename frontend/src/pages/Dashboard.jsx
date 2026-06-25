import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import Layout from "../components/Layout";
import { Spinner, StatusPill } from "../components/UI";
import { getStats, listKpis, listKras, measurementsForKpi, kraName } from "../lib/store";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [kpis, setKpis] = useState([]);
  const [kras, setKras] = useState([]);
  const [trend, setTrend] = useState([]);
  const [trendKpi, setTrendKpi] = useState(null);

  useEffect(() => {
    Promise.all([getStats(), listKpis(), listKras()]).then(([s, k, r]) => {
      setStats(s); setKpis(k); setKras(r);
      // pick a KPI with the most measurements for the trend preview
      if (k.length) {
        const first = k[0];
        setTrendKpi(first);
        measurementsForKpi(first.id).then((ms) =>
          setTrend(ms.map((m) => ({ period: m.measurement_period_label, value: m.measured_value })))
        );
      }
    });
  }, []);

  if (!stats) return <Layout crumb={<b>Dashboard</b>}><Spinner /></Layout>;

  const pct = stats.totalKpis ? Math.round((stats.measured / stats.totalKpis) * 100) : 0;

  return (
    <Layout crumb={<b>Dashboard</b>}>
      <div className="page-head">
        <div>
          <h1>KPI overview</h1>
          <p>Real-time RAG status across all {stats.totalKpis} KPIs · FY2026-27</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat__label">Total KPIs</div>
          <div className="stat__value">{stats.totalKpis}</div>
          <div className="stat__sub">{stats.totalKras} KRA areas</div>
        </div>
        <div className="stat stat--ok">
          <div className="stat__label">Green</div>
          <div className="stat__value">{stats.green}</div>
          <div className="stat__sub">on or above target</div>
        </div>
        <div className="stat stat--warn">
          <div className="stat__label">Amber</div>
          <div className="stat__value">{stats.amber}</div>
          <div className="stat__sub">in warning band</div>
        </div>
        <div className="stat stat--bad">
          <div className="stat__label">Red / Critical</div>
          <div className="stat__value">{stats.red}</div>
          <div className="stat__sub">needs attention</div>
        </div>
        <div className="stat">
          <div className="stat__label">Measured this cycle</div>
          <div className="stat__value">{pct}%</div>
          <div className="stat__sub">{stats.measured} of {stats.totalKpis} KPIs</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1.1rem", marginBottom: "1.1rem" }}>
        <div className="card">
          <div className="card__head">
            <h3>Trend — {trendKpi?.name || "—"}</h3>
            {trendKpi && <span className="tag">target {trendKpi.target_value}{trendKpi.unit === "Percentage" ? "%" : ""}</span>}
          </div>
          <div className="card__body" style={{ height: 260 }}>
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#7d879c" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#7d879c" }} />
                  <Tooltip />
                  {trendKpi && <ReferenceLine y={trendKpi.target_value} stroke="#1f8a4c" strokeDasharray="4 4" />}
                  <Line type="monotone" dataKey="value" stroke="#3a5bd9" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="empty">No measurements yet for this KPI.</div>}
          </div>
        </div>

        <div className="card">
          <div className="card__head"><h3>KRA health</h3></div>
          <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {kras.map((kra) => {
              const areaKpis = kpis.filter((k) => Number(k.kra_area_id) === Number(kra.id));
              const counts = { green: 0, amber: 0, red: 0 };
              areaKpis.forEach((k) => {
                const m = stats.latestByKpi[k.id];
                const s = m?.status || "unknown";
                if (s === "green") counts.green++;
                else if (s === "amber") counts.amber++;
                else if (s === "red" || s === "critical") counts.red++;
              });
              const total = Math.max(areaKpis.length, 1);
              return (
                <div key={kra.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.86rem" }}>{kra.area_name}</span>
                    <span className="cell-sub">{areaKpis.length} KPIs</span>
                  </div>
                  <div className="health-bar">
                    <span className="h-green" style={{ width: `${(counts.green / total) * 100}%` }} />
                    <span className="h-amber" style={{ width: `${(counts.amber / total) * 100}%` }} />
                    <span className="h-red" style={{ width: `${(counts.red / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__head"><h3>KPIs needing attention</h3></div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>KPI</th><th>KRA area</th><th>Latest</th><th>Target</th><th>Status</th></tr>
            </thead>
            <tbody>
              {kpis
                .map((k) => ({ k, m: stats.latestByKpi[k.id] }))
                .filter(({ m }) => m && (m.status === "red" || m.status === "amber" || m.status === "critical"))
                .slice(0, 8)
                .map(({ k, m }) => (
                  <tr key={k.id}>
                    <td className="cell-strong">{k.name}</td>
                    <td>{kraName(k.kra_area_id)}</td>
                    <td className="mono">{m.measured_value ?? "—"}</td>
                    <td className="mono">{k.target_value}</td>
                    <td><StatusPill status={m.status} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
