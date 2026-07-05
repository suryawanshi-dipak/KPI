import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import Layout from "../components/Layout";
import { Spinner, StatusPill } from "../components/UI";
import { getStats, listKpis, listKras, measurementsForKpi, kraName , listAssignments , listEmployees , getCurrentUser } from "../lib/store";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [visibleKpis, setVisibleKpis] = useState([]);
  const [kras, setKras] = useState([]);
  const [trend, setTrend] = useState([]);
  const [trendKpi, setTrendKpi] = useState(null);
  const [yDomain, setYDomain] = useState(null);

  useEffect(() => {

  async function load() {

    try {

      const currentUser = await getCurrentUser();

      const [statsData, allKpis, allKras, assignments, employees] =
        await Promise.all([
          getStats(),
          listKpis(),
          listKras(),
          listAssignments(),
          listEmployees()
        ]);

      let allowedKpiIds = [];

      if (currentUser.role === "admin") {

        allowedKpiIds = allKpis.map(k => Number(k.id));

      }

      else if (currentUser.role === "employee") {

        allowedKpiIds = assignments
          .filter(
            a => Number(a.employee_id) === Number(currentUser.id)
          )
          .map(
            a => Number(a.kpi_metric_id)
          );

      }

      else if (currentUser.role === "manager") {

        // team members
        const teamMemberIds = employees
          .filter(
            e => Number(e.managerId) === Number(currentUser.id)
          )
          .map(
            e => Number(e.id)
          );

        // include manager himself
        teamMemberIds.push(Number(currentUser.id));

        allowedKpiIds = assignments
          .filter(
            a => teamMemberIds.includes(
              Number(a.employee_id)
            )
          )
          .map(
            a => Number(a.kpi_metric_id)
          );

      }

      const filteredKpis = allKpis.filter(
        k => allowedKpiIds.includes(Number(k.id))
      );

      setStats(statsData);
      setKras(allKras);
      setVisibleKpis(filteredKpis);

      if (filteredKpis.length) {
        const first = filteredKpis[0];
        // Use shared loader to populate trend and y-axis domain
        await loadMeasurements(first);
      }

    }

    catch (err) {

      console.error(err);

    }

  }

  load();

}, []);

// Loads measurements for a KPI and computes Y-axis domain for chart
async function loadMeasurements(kpi) {
  if (!kpi) return;
  try {
    const ms = await measurementsForKpi(kpi.id);
    const activeMs = ms.filter(m => !ms.some(other => Number(other.corrected_from_id) === Number(m.id)));

    const filtered = activeMs
      .filter(m => !m.is_pending && m.measured_value !== null && m.measured_value !== undefined)
      // Added index key to guarantee unique keys on XAxis, resolving the Recharts duplicate key tooltip bug
      .map((m, i) => ({ index: i, period: m.measurement_period_label, value: Number(m.measured_value) }));

    setTrend(filtered);
    setTrendKpi(kpi);

    // compute dynamic domain including target line
    const values = filtered.map(f => f.value);
    const target = kpi?.target_value !== undefined && kpi?.target_value !== null ? Number(kpi.target_value) : null;

    if (values.length || target !== null) {
      const all = values.concat(target !== null ? [target] : []);
      let min = Math.min(...all);
      let max = Math.max(...all);
      if (min === max) {
        min = min - Math.abs(min || 10) * 0.1 - 1;
        max = max + Math.abs(max || 10) * 0.1 + 1;
      } else {
        const pad = (max - min) * 0.15;
        min = Math.floor(min - pad);
        max = Math.ceil(max + pad);
      }
      setYDomain([min, max]);
    } else {
      setYDomain(null);
    }

  } catch (err) {
    console.error("Failed loading measurements for KPI", err);
    setTrend([]);
    setYDomain(null);
  }
}

  if (!stats) return <Layout crumb={<b>Dashboard</b>}><Spinner /></Layout>;

const dashboardCounts = {
  totalKpis: visibleKpis.length,
  totalKras: new Set(
    visibleKpis.map(k => Number(k.kra_area_id))
  ).size,
  green: 0,
  amber: 0,
  red: 0,
  measured: 0
};

visibleKpis.forEach((k) => {

  const m = stats.latestByKpi[k.id];

  if (!m)
    return;

  dashboardCounts.measured++;

  if (m.status === "green")
    dashboardCounts.green++;

  else if (m.status === "amber")
    dashboardCounts.amber++;

  else if (
    m.status === "red" ||
    m.status === "critical"
  )
    dashboardCounts.red++;

});


  const pct = dashboardCounts.totalKpis
  ? Math.round(
      (dashboardCounts.measured /
        dashboardCounts.totalKpis) * 100
    )
  : 0;

  return (
    <Layout crumb={<b>Dashboard</b>}>
      <div className="page-head">
        <div>
          <h1>KPI overview</h1>
          <p>
  Real-time RAG status across all
  {" "}
  {dashboardCounts.totalKpis}
  {" "}
  KPIs · FY2026-27
</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat__label">Total KPIs</div>
          <div className="stat__value">
  {dashboardCounts.totalKpis}
</div>

<div className="stat__sub">
  {dashboardCounts.totalKras} KRA areas
</div>
        </div>
        <div className="stat stat--ok">
          <div className="stat__label">Green</div>
          <div className="stat__value">{dashboardCounts.green}</div>
          <div className="stat__sub">on or above target</div>
        </div>
        <div className="stat stat--warn">
          <div className="stat__label">Amber</div>
          <div className="stat__value">{dashboardCounts.amber}</div>
          <div className="stat__sub">in warning band</div>
        </div>
        <div className="stat stat--bad">
          <div className="stat__label">Red / Critical</div>
          <div className="stat__value">{dashboardCounts.red}</div>
          <div className="stat__sub">needs attention</div>
        </div>
        <div className="stat">
          <div className="stat__label">Measured this cycle</div>
          <div className="stat__value">{pct}%</div>
          <div className="stat__sub">{dashboardCounts.measured}of{" "}{dashboardCounts.totalKpis} KPIs</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1.1rem", marginBottom: "1.1rem" }}>
        <div className="card">
          <div className="card__head" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Trend — {trendKpi?.name || "—"}</h3>
              {trendKpi && <span className="tag">target {trendKpi.target_value}{trendKpi.unit === "Percentage" ? "%" : ""}</span>}
            </div>

            {/* KPI selector: choose which KPI's trend to display. Options are already filtered by user's role */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}> </label>
              <select
                className="select"
                value={trendKpi?.id || ''}
                onChange={async (e) => {
                  const id = e.target.value;
                  const sel = visibleKpis.find(k => String(k.id) === String(id));
                  if (sel) await loadMeasurements(sel);
                }}
                style={{ minWidth: 220 }}
              >
                {visibleKpis.map(k => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="card__body" style={{ height: 260 }}>
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
                  {/* Using index as dataKey and tickFormatter to display period label cleanly, preventing hover index overlap */}
                  <XAxis dataKey="index" tickFormatter={(tick) => trend[tick]?.period || ""} tick={{ fontSize: 11, fill: "#7d879c" }} />
                  <YAxis domain={yDomain || ['auto','auto']} tick={{ fontSize: 11, fill: "#7d879c" }} />
                  {/* custom labelFormatter to map index back to the period name */}
                  <Tooltip labelFormatter={(label) => trend[label]?.period || ""} />
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
              const areaKpis = visibleKpis.filter((k) => Number(k.kra_area_id) === Number(kra.id));
              if (areaKpis.length === 0)
  return null; 
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
              {visibleKpis
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
