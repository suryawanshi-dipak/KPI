import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import Layout from "../components/Layout";
import { Spinner, StatusPill } from "../components/UI";
import { getStats, listKpis, listKras, measurementsForKpi, kraName, listAssignments, listEmployees, getCurrentUser, listMeasurements, employeeName } from "../lib/store";

function buildViewOptions(currentUser, employeesList) {
  const options = [];

  if (!currentUser) return options;

  if (String(currentUser.role).toLowerCase() === "manager") {
    const reports = employeesList.filter(
      (employee) => Number(employee.managerId) === Number(currentUser.id)
    );

    options.push({
      id: Number(currentUser.id),
      name: currentUser.name || "Me",
      role: currentUser.role,
    });

    reports.forEach((employee) => {
      if (!options.some((option) => Number(option.id) === Number(employee.id))) {
        options.push({
          id: Number(employee.id),
          name: employee.name,
          role: employee.role,
        });
      }
    });
  } else if (String(currentUser.role).toLowerCase() === "admin") {
    const nonAdminUsers = employeesList.filter(
      (employee) => String(employee.role || "").toLowerCase() !== "admin"
    );

    options.push({
      id: Number(currentUser.id),
      name: currentUser.name || "Me",
      role: currentUser.role,
    });

    nonAdminUsers.forEach((employee) => {
      if (!options.some((option) => Number(option.id) === Number(employee.id))) {
        options.push({
          id: Number(employee.id),
          name: employee.name,
          role: employee.role,
        });
      }
    });
  }

  return options;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [viewOptions, setViewOptions] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [visibleKpis, setVisibleKpis] = useState([]);
  const [kras, setKras] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [trend, setTrend] = useState([]);
  const [trendKpi, setTrendKpi] = useState(null);
  const [yDomain, setYDomain] = useState(null);
  const [assignments, setAssignments] = useState([]);
  // Track total number of active KPIs in the system (same as appeared in KPI screen)
  const [systemKpisCount, setSystemKpisCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const user = await getCurrentUser();

        if (!isMounted) return;

        const [statsData, allKpis, allKras, assignments, employeesList, measurementsData] =
          await Promise.all([
            getStats(),
            listKpis(),
            listKras(),
            listAssignments(),
            listEmployees(),
            listMeasurements()
          ]);

        if (!isMounted) return;

        const options = buildViewOptions(user, employeesList);
        const effectiveViewUserId = options.some((option) => Number(option.id) === Number(selectedUserId ?? user.id))
          ? Number(selectedUserId ?? user.id)
          : Number(options[0]?.id ?? user.id);

        setCurrentUser(user);
        setEmployees(employeesList);
        setViewOptions(options);
        setSelectedUserId(effectiveViewUserId);
        setAssignments(assignments);
        // Store total active KPIs count from listKpis response
        setSystemKpisCount(allKpis.length);

        const isAdminSelf = String(user.role).toLowerCase() === "admin" && Number(effectiveViewUserId) === Number(user.id);
        let allowedKpiIds = [];

        if (isAdminSelf) {
          allowedKpiIds = allKpis.map((k) => Number(k.id));
        } else {
          allowedKpiIds = assignments
            .filter((a) => Number(a.employee_id) === Number(effectiveViewUserId))
            .map((a) => Number(a.kpi_metric_id));
        }

        const filteredKpis = allKpis.filter((k) => allowedKpiIds.includes(Number(k.id)));

        setStats(statsData);
        setKras(allKras);
        setMeasurements(measurementsData);
        setVisibleKpis(filteredKpis);

        if (filteredKpis.length) {
          const first = filteredKpis[0];
          await loadMeasurements(first, effectiveViewUserId, measurementsData, user, assignments);
        } else {
          setTrend([]);
          setTrendKpi(null);
          setYDomain(null);
        }
      } catch (err) {
        console.error(err);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [selectedUserId]);

// Loads measurements for a KPI and computes Y-axis domain for chart
async function loadMeasurements(kpi, userId, sourceMeasurements = [], activeUser = currentUser, activeAssignments = assignments) {
  if (!kpi) return;
  try {
    const ms = sourceMeasurements.length
      ? sourceMeasurements.filter(m => Number(m.kpi_metric_id) === Number(kpi.id))
      : await measurementsForKpi(kpi.id);

    const effUser = activeUser || currentUser;
    const isAggregated = effUser && String(effUser.role).toLowerCase() === "admin" && Number(userId) === Number(effUser.id);

    if (isAggregated) {
      // Filter out deleted measurements
      const activeMs = ms.filter(m => !m.is_deleted && !ms.some(other => Number(other.corrected_from_id) === Number(m.id)));
      const validMs = activeMs.filter(m => !m.is_pending && m.measured_value !== null && m.measured_value !== undefined);

      // Extract all unique periods and their start dates
      const periodMap = {};
      validMs.forEach(m => {
        if (m.measurement_period_label) {
          periodMap[m.measurement_period_label] = m.period_start_date || "";
        }
      });
      const sortedPeriods = Object.keys(periodMap).sort((a, b) => {
        return String(periodMap[a]).localeCompare(String(periodMap[b]));
      });

      // Build Recharts data with employee names as separate keys
      const filtered = sortedPeriods.map((periodLabel, idx) => {
        const dataPoint = { index: idx, period: periodLabel };
        const periodMs = validMs.filter(m => m.measurement_period_label === periodLabel);
        periodMs.forEach(m => {
          const empName = m.measured_by_name || employeeName(m.measured_by) || `Employee ${m.measured_by}`;
          dataPoint[empName] = Number(m.measured_value);
        });
        return dataPoint;
      });

      setTrend(filtered);
      setTrendKpi(kpi);

      // Compute dynamic domain
      const values = validMs.map(m => Number(m.measured_value));
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
    } else {
      const visibleMs = userId
        ? ms.filter(m => Number(m.measured_by) === Number(userId))
        : ms;

      const activeMs = visibleMs.filter(m => !visibleMs.some(other => Number(other.corrected_from_id) === Number(m.id)));

      // Sort chronologically ascending (oldest to newest, left to right reading)
      const sortedActiveMs = [...activeMs].sort((a, b) =>
        String(a.period_start_date).localeCompare(String(b.period_start_date))
      );

      const filtered = sortedActiveMs
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
    }
  } catch (err) {
    console.error("Failed loading measurements for KPI", err);
    setTrend([]);
    setYDomain(null);
  }
}

  if (!stats) return <Layout crumb={<b>Dashboard</b>}><Spinner /></Layout>;

const viewUserId = selectedUserId ?? currentUser?.id;
const selectedViewOption = viewOptions.find((option) => Number(option.id) === Number(viewUserId));
const canViewByEmployee = currentUser && ["manager", "admin"].includes(String(currentUser.role).toLowerCase());
const isAggregatedView = currentUser && String(currentUser.role).toLowerCase() === "admin" && Number(viewUserId) === Number(currentUser.id);

const dashboardLatestByKpi = {};
const aggregatedLatest = []; // list of { assignment, measurement, kpi }
const kraLatestMap = {}; // kra_area_id -> { green, amber, red, total }

let dashboardCounts = {
  totalKpis: 0,
  totalKras: 0,
  green: 0,
  amber: 0,
  red: 0,
  measured: 0
};

if (isAggregatedView) {
  // Sum of assignments for all active/visible KPIs on the KPI screen
  const activeAssignments = assignments.filter(a => visibleKpis.some(k => Number(k.id) === Number(a.kpi_metric_id)));
  
  activeAssignments.forEach(a => {
    const kpi = visibleKpis.find(k => Number(k.id) === Number(a.kpi_metric_id));
    if (!kpi) return;

    // Find all measurements recorded by the assigned employee for this KPI
    const msForAssign = (measurements || []).filter(m =>
      Number(m.kpi_metric_id) === Number(a.kpi_metric_id) &&
      Number(m.measured_by) === Number(a.employee_id) &&
      !m.is_deleted
    );

    // Filter out superseded measurements (i.e. those corrected by a newer record)
    const activeMs = msForAssign.filter(m =>
      !msForAssign.some(other => Number(other.corrected_from_id) === Number(m.id))
    );

    // Get the latest measurement by sorting by period start date descending
    const latestM = activeMs.sort((x, y) => String(y.period_start_date).localeCompare(String(x.period_start_date)))[0];

    let status = "unknown";
    if (latestM) {
      status = latestM.status;
      
      // Ignore measurements that are pending or have unknown status from the dashboard roll-ups
      if (!latestM.is_pending && status !== "unknown") {
        dashboardCounts.measured++;
        if (status === "green") dashboardCounts.green++;
        else if (status === "amber") dashboardCounts.amber++;
        else if (status === "red" || status === "critical") dashboardCounts.red++;
      }
    }

    // Aggregate KRA health (ignore pending/unknown statuses)
    const kraId = kpi.kra_area_id;
    if (!kraLatestMap[kraId]) {
      kraLatestMap[kraId] = { green: 0, amber: 0, red: 0, total: 0 };
    }
    
    if (latestM && !latestM.is_pending && status !== "unknown") {
      kraLatestMap[kraId].total++;
      if (status === "green") kraLatestMap[kraId].green++;
      else if (status === "amber") kraLatestMap[kraId].amber++;
      else if (status === "red" || status === "critical") kraLatestMap[kraId].red++;
    }

    aggregatedLatest.push({
      assignment: a,
      measurement: latestM,
      kpi
    });
  });

  // Calculate total active KPI assignments and active KRAs for Admin aggregated view
  dashboardCounts.totalKpis = activeAssignments.length;
  dashboardCounts.totalKras = new Set(activeAssignments.map(a => Number(a.kra_area_id))).size;

} else {
  // Non-aggregated view (Employee / Manager, or individual employee view)
  const userMeasurements = (measurements || []).filter((m) => {
    if (!viewUserId) return false;
    return Number(m.measured_by) === Number(viewUserId);
  });

  // Filter out superseded/corrected measurements first
  const activeUserMeasurements = userMeasurements.filter(m =>
    !m.is_deleted &&
    !userMeasurements.some(other => Number(other.corrected_from_id) === Number(m.id))
  );

  // Determine latest measurement per KPI metric
  activeUserMeasurements.forEach((m) => {
    const kpiId = m.kpi_metric_id;
    if (!dashboardLatestByKpi[kpiId] || String(m.period_start_date) > String(dashboardLatestByKpi[kpiId].period_start_date)) {
      dashboardLatestByKpi[kpiId] = m;
    }
  });

  dashboardCounts.totalKpis = visibleKpis.length;
  dashboardCounts.totalKras = new Set(
    visibleKpis.map(k => Number(k.kra_area_id))
  ).size;

  // Evaluate roll-up statuses for each assigned KPI
  visibleKpis.forEach((k) => {
    const m = dashboardLatestByKpi[k.id];
    if (!m) return;

    // Ignore measurements that are pending or have unknown status from dashboard measured calculations
    if (m.is_pending || m.status === "unknown") return;

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
}

const pct = dashboardCounts.totalKpis
  ? Math.round(
      (dashboardCounts.measured /
        dashboardCounts.totalKpis) * 100
    )
  : 0;

  return (
    <Layout crumb={<b>Dashboard</b>}>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1>KPI overview</h1>
          <p>
            Real-time RAG status across all {isAggregatedView ? systemKpisCount : dashboardCounts.totalKpis} KPIs · FY2026-27
          </p>
        </div>
        {canViewByEmployee && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', fontWeight: 600 }}>View by employee</label>
            <select
              className="select"
              value={viewUserId || ''}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
              style={{ minWidth: 220 }}
            >
              {viewOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}{option.role ? ` (${option.role})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat__label">Overview</div>
          <div style={{ marginTop: "0.25rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {/* KPI Assignments Count (per role/view context) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "0.76rem", color: "var(--muted)", fontWeight: 500 }}>
                {isAggregatedView ? "KPI Assignments:" : "Assigned KPIs:"}
              </span>
              <span className="mono" style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--ink)" }}>
                {isAggregatedView ? assignments.length : dashboardCounts.totalKpis}
              </span>
            </div>
            {/* Total Active KPIs Count (same as appeared in KPI screen) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "0.76rem", color: "var(--muted)", fontWeight: 500 }}>Active KPIs:</span>
              <span className="mono" style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--ink)" }}>
                {systemKpisCount}
              </span>
            </div>
            {/* Total Active KRAs Count (same as appeared in KRA area tab) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "0.76rem", color: "var(--muted)", fontWeight: 500 }}>Active KRAs:</span>
              <span className="mono" style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--ink)" }}>
                {kras.length}
              </span>
            </div>
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
          <div className="stat__sub">{dashboardCounts.measured} of {dashboardCounts.totalKpis} KPIs</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1.1rem", marginBottom: "1.1rem" }}>
        <div className="card">
          <div className="card__head" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Trend — {trendKpi?.name || "—"}</h3>
              {trendKpi && <span className="tag">target {trendKpi.target_value}{trendKpi.unit === "Percentage" ? "%" : ""}</span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>KPI</label>
                <select
                  className="select"
                  value={trendKpi?.id || ''}
                  onChange={async (e) => {
                    const id = e.target.value;
                    const sel = visibleKpis.find(k => String(k.id) === String(id));
                    if (sel) await loadMeasurements(sel, viewUserId, measurements);
                  }}
                  style={{ minWidth: 220 }}
                >
                  {visibleKpis.map(k => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="card__body" style={{ height: 260 }}>
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
                  <XAxis dataKey="index" tickFormatter={(tick) => trend[tick]?.period || ""} tick={{ fontSize: 11, fill: "#7d879c" }} />
                  <YAxis domain={yDomain || ['auto','auto']} tick={{ fontSize: 11, fill: "#7d879c" }} />
                  <Tooltip labelFormatter={(label) => trend[label]?.period || ""} />
                  {trendKpi && <ReferenceLine y={trendKpi.target_value} stroke="#1f8a4c" strokeDasharray="4 4" />}
                  {isAggregatedView ? (
                    <>
                      <Legend />
                      {Array.from(new Set(
                        assignments
                          .filter(a => Number(a.kpi_metric_id) === Number(trendKpi?.id))
                          .map(a => a.employee_name || employeeName(a.employee_id) || `Employee ${a.employee_id}`)
                      )).map((empName, index) => {
                        const colors = ["#3a5bd9", "#1f8a4c", "#d93a3a", "#d98a3a", "#8a3ad9", "#3ad9d9", "#d93ad9"];
                        const strokeColor = colors[index % colors.length];
                        return (
                          <Line
                            key={empName}
                            type="monotone"
                            dataKey={empName}
                            stroke={strokeColor}
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                        );
                      })}
                    </>
                  ) : (
                    <Line type="monotone" dataKey="value" stroke="#3a5bd9" strokeWidth={2.5} dot={{ r: 3 }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="empty">No measurements yet for this KPI.</div>}
          </div>
        </div>

        <div className="card">
          <div className="card__head"><h3>KRA health</h3></div>
          <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {kras.map((kra) => {
              let counts = { green: 0, amber: 0, red: 0 };
              let total = 0;
              let kraKpisCount = 0;

              if (isAggregatedView) {
                const kraData = kraLatestMap[kra.id];
                if (!kraData) return null;
                counts = { green: kraData.green, amber: kraData.amber, red: kraData.red };
                total = kraData.total;
                kraKpisCount = assignments.filter(a => Number(a.kra_area_id) === Number(kra.id)).length;
              } else {
                const areaKpis = visibleKpis.filter((k) => Number(k.kra_area_id) === Number(kra.id));
                if (areaKpis.length === 0) return null;
                areaKpis.forEach((k) => {
                  const m = dashboardLatestByKpi[k.id];
                  const s = m?.status || "unknown";
                  if (s === "green") counts.green++;
                  else if (s === "amber") counts.amber++;
                  else if (s === "red" || s === "critical") counts.red++;
                });
                total = areaKpis.length;
                kraKpisCount = areaKpis.length;
              }

              if (total === 0) return null;
              const totalVal = Math.max(total, 1);

              return (
                <div key={kra.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.86rem" }}>{kra.area_name}</span>
                    <span className="cell-sub">{kraKpisCount} KPIs</span>
                  </div>
                  <div className="health-bar">
                    <span className="h-green" style={{ width: `${(counts.green / totalVal) * 100}%` }} />
                    <span className="h-amber" style={{ width: `${(counts.amber / totalVal) * 100}%` }} />
                    <span className="h-red" style={{ width: `${(counts.red / totalVal) * 100}%` }} />
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
            {isAggregatedView ? (
              <>
                <thead>
                  <tr><th>Employee</th><th>KPI</th><th>KRA area</th><th>Latest</th><th>Target</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {aggregatedLatest
                    .filter(({ measurement }) => measurement && (measurement.status === "red" || measurement.status === "amber" || measurement.status === "critical"))
                    .slice(0, 15)
                    .map(({ assignment, measurement, kpi }) => (
                      <tr key={`${assignment.id}-${measurement.id}`}>
                        <td className="cell-strong">{assignment.employee_name || employeeName(assignment.employee_id)}</td>
                        <td className="cell-strong">{assignment.kpi_metric_name}</td>
                        <td>{kraName(assignment.kra_area_id)}</td>
                        <td className="mono">{measurement.measured_value ?? "—"}</td>
                        <td className="mono">{assignment.target_value || kpi?.target_value}</td>
                        <td><StatusPill status={measurement.status} /></td>
                      </tr>
                    ))}
                </tbody>
              </>
            ) : (
              <>
                <thead>
                  <tr><th>KPI</th><th>KRA area</th><th>Latest</th><th>Target</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {visibleKpis
                    .map((k) => ({ k, m: dashboardLatestByKpi[k.id] }))
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
              </>
            )}
          </table>
        </div>
      </div>
    </Layout>
  );
}
