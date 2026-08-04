import { useState, useEffect, Fragment } from "react";
import Layout from "../components/Layout";
import { Icon } from "../components/Icon";
import { Spinner, StatusPill } from "../components/UI";
import { 
  getReportPeriods, 
  getExecutiveSummaryReport, 
  getKpiHealthReport 
} from "../lib/store";
import { STATUS_META } from "../lib/status";

// The four standard report templates.
const REPORT_TEMPLATES = [
  { id: "executive-summary", title: "Executive summary", desc: "High-level overview of organizational KPI health.", enabled: true },
  { id: "kpi-health", title: "KPI health report", desc: "Detailed analysis of all KPI statuses and trends.", enabled: true },
  { id: "performance-trends", title: "Performance trends", desc: "Historical performance analysis and forecasting.", enabled: false },
  { id: "team-comparison", title: "Team comparison", desc: "Compare performance across teams and members.", enabled: false },
];

/**
 * Utility function to trigger a browser download of a CSV file.
 */
function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Compiles and exports the KPI Health Report data to a CSV spreadsheet.
 */
function exportKpiHealthCsv(kraHealths, period) {
  // Column headers
  let csv = "KRA Area,KPI Metric Name,Source System,Target Expression,Unit,Assignments Count,Overall Score,Overall Status,Assignee Name,Measured Value,Assignee Status,Notes/Reasons\n";
  
  kraHealths.forEach((kra) => {
    kra.kpiHealths.forEach((kpi) => {
      if (kpi.measurements && kpi.measurements.length > 0) {
        kpi.measurements.forEach((m) => {
          const row = [
            `"${kra.kraAreaName.replace(/"/g, '""')}"`,
            `"${kpi.kpiName.replace(/"/g, '""')}"`,
            `"${(kpi.sourceSystem || "").replace(/"/g, '""')}"`,
            `"${(kpi.targetExpression || "").replace(/"/g, '""')}"`,
            `"${(kpi.unit || "").replace(/"/g, '""')}"`,
            kpi.assigneeCount,
            kpi.overallScore ? Number(kpi.overallScore).toFixed(2) : "—",
            kpi.overallStatus,
            `"${(m.assigneeName || "").replace(/"/g, '""')}"`,
            m.isPending ? "Pending" : (m.measuredValue ? Number(m.measuredValue).toFixed(2) : "—"),
            m.isPending ? "Pending" : m.status,
            `"${(m.isPending ? m.pendingReason : m.measurementNote || "").replace(/"/g, '""')}"`
          ];
          csv += row.join(",") + "\n";
        });
      } else {
        const row = [
          `"${kra.kraAreaName.replace(/"/g, '""')}"`,
          `"${kpi.kpiName.replace(/"/g, '""')}"`,
          `"${(kpi.sourceSystem || "").replace(/"/g, '""')}"`,
          `"${(kpi.targetExpression || "").replace(/"/g, '""')}"`,
          `"${(kpi.unit || "").replace(/"/g, '""')}"`,
          kpi.assigneeCount,
          kpi.overallScore ? Number(kpi.overallScore).toFixed(2) : "—",
          kpi.overallStatus,
          "No assignee measurements logged",
          "—",
          "—",
          ""
        ];
        csv += row.join(",") + "\n";
      }
    });
  });

  downloadCsv(csv, `KPI_Health_Report_${period}.csv`);
}

/**
 * Compiles and exports the Executive Summary Report data to a CSV spreadsheet.
 */
function exportExecutiveSummaryCsv(data, period) {
  let csv = "EXECUTIVE SUMMARY REPORT - " + period + "\n\n";
  
  // Status counts
  csv += "STATUS DISTRIBUTION\n";
  Object.entries(data.statusDistribution || {}).forEach(([status, count]) => {
    csv += `${status.toUpperCase()},${count}\n`;
  });
  csv += `TOTAL KPIs,${data.totalKpis}\n`;
  csv += `MEASURED KPIs,${data.measuredKpis}\n\n`;
  
  // KRA Area summaries
  csv += "KRA AREA SUMMARY\n";
  csv += "KRA Area,Total KPIs,Assignments,Overall KRA Score\n";
  data.kraSummaries.forEach((kra) => {
    csv += `"${kra.kraAreaName.replace(/"/g, '""')}",${kra.totalKpis},${kra.totalAssignees},${kra.overallScore ? Number(kra.overallScore).toFixed(2) : "—"}\n`;
  });
  csv += "\n";
  
  // Watchlist (Red/Critical)
  csv += "CRITICAL WATCHLIST\n";
  csv += "KPI Metric,Assignee Name,Measured Value,Target Value,Mitigation / Post-Action,Status\n";
  data.criticalWatchlist.forEach((item) => {
    csv += `"${item.kpiName.replace(/"/g, '""')}","${item.assigneeName.replace(/"/g, '""')}",${item.measuredValue},${item.targetValue},"${(item.postAction || "").replace(/"/g, '""')}",${item.status}\n`;
  });
  csv += "\n";
  
  // Pending items list
  csv += "PENDING & MISSING MEASUREMENTS\n";
  csv += "KPI Metric,Assignee Name,Reason\n";
  data.pendingMeasurements.forEach((item) => {
    csv += `"${item.kpiName.replace(/"/g, '""')}","${item.assigneeName.replace(/"/g, '""')}","${(item.reason || "").replace(/"/g, '""')}"\n`;
  });
  
  downloadCsv(csv, `Executive_Summary_Report_${period}.csv`);
}

export default function Reports() {
  // Periods loaded from the backend
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [loadingPeriods, setLoadingPeriods] = useState(true);

  // Active report selection and loading states
  const [activeReport, setActiveReport] = useState(null); // "executive-summary" | "kpi-health" | null
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState(null);

  // State to track expanded KPIs in the KPI Health Report table (for showing assignee details)
  const [expandedKpiIds, setExpandedKpiIds] = useState(new Set());

  // On mount, fetch available period labels from backend measurements
  useEffect(() => {
    async function loadPeriods() {
      try {
        const fetchedPeriods = await getReportPeriods();
        if (fetchedPeriods && fetchedPeriods.length > 0) {
          setPeriods(fetchedPeriods);
          setSelectedPeriod(fetchedPeriods[0]); // Default to the latest period
        } else {
          // Fallback periods if database is empty
          const fallback = ["Q1-FY2026", "Q2-FY2026", "Q3-FY2026", "Q4-FY2026"];
          setPeriods(fallback);
          setSelectedPeriod(fallback[0]);
        }
      } catch (err) {
        console.error("Failed to load periods:", err);
        const fallback = ["Q1-FY2026", "Q2-FY2026", "Q3-FY2026", "Q4-FY2026"];
        setPeriods(fallback);
        setSelectedPeriod(fallback[0]);
      } finally {
        setLoadingPeriods(false);
      }
    }
    loadPeriods();
  }, []);

  // Fetch report data when active report type or selected period changes
  useEffect(() => {
    if (!activeReport || !selectedPeriod) {
      setReportData(null);
      return;
    }

    async function loadReportData() {
      setLoadingReport(true);
      setError(null);
      try {
        let data;
        if (activeReport === "executive-summary") {
          data = await getExecutiveSummaryReport(selectedPeriod);
        } else if (activeReport === "kpi-health") {
          data = await getKpiHealthReport(selectedPeriod);
        }
        setReportData(data);
      } catch (err) {
        console.error("Error fetching report data:", err);
        setError(err.message || "Failed to compile report. Please try again.");
      } finally {
        setLoadingReport(false);
      }
    }

    setExpandedKpiIds(new Set());
    loadReportData();
  }, [activeReport, selectedPeriod]);

  // Helper to toggle KPI expansion in the KPI Health report view
  const toggleKpiExpanded = (kpiId) => {
    const next = new Set(expandedKpiIds);
    if (next.has(kpiId)) {
      next.delete(kpiId);
    } else {
      next.add(kpiId);
    }
    setExpandedKpiIds(next);
  };

  // Renders the main grid of report templates (default view)
  const renderTemplateGrid = () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "1rem" }}>
      {REPORT_TEMPLATES.map((r) => (
        <div className={`card ${!r.enabled ? "card--disabled" : ""}`} key={r.title} style={{ opacity: r.enabled ? 1 : 0.65 }}>
          <div className="card__body">
            <div style={{ 
              width: 38, 
              height: 38, 
              borderRadius: 10, 
              background: r.enabled ? "var(--primary-bg)" : "var(--surface-2)", 
              color: r.enabled ? "var(--primary)" : "var(--muted)", 
              display: "grid", 
              placeItems: "center", 
              marginBottom: "0.8rem" 
            }}>
              <Icon.reports style={{ width: 19, height: 19 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ fontSize: "1rem", marginBottom: "0.3rem" }}>{r.title}</h3>
              {!r.enabled && <span className="tag" style={{ fontSize: "0.7rem", padding: "0.1rem 0.3rem" }}>Phase 2</span>}
            </div>
            <p className="cell-sub" style={{ marginBottom: "1.2rem" }}>{r.desc}</p>
            {r.enabled ? (
              <button 
                className="btn" 
                style={{ width: "100%" }}
                onClick={() => setActiveReport(r.id)}
                disabled={loadingPeriods}
              >
                Generate report
              </button>
            ) : (
              <button className="btn" style={{ width: "100%" }} disabled>
                Coming soon
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // Renders the color-coded horizontal status distribution bar for the Executive Summary
  const renderStatusDistributionBar = (dist) => {
    if (!dist) return null;

    const keys = ["green", "amber", "red", "critical", "unknown"];
    const total = keys.reduce((sum, key) => sum + (dist[key] || 0), 0);

    if (total === 0) return null;

    return (
      <div style={{ marginBottom: "2rem" }}>
        <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", fontWeight: "600" }}>Org-Wide KPI Status Distribution</h3>
        <div style={{ 
          display: "flex", 
          height: "24px", 
          width: "100%", 
          borderRadius: "6px", 
          overflow: "hidden", 
          background: "var(--surface-2)" 
        }}>
          {keys.map((key) => {
            const count = dist[key] || 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            if (pct === 0) return null;

            const meta = STATUS_META[key] || STATUS_META.unknown;
            return (
              <div 
                key={key} 
                style={{ 
                  width: `${pct}%`, 
                  background: meta.color, 
                  color: "#fff", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  fontSize: "0.75rem", 
                  fontWeight: "600",
                  transition: "width 0.3s ease" 
                }}
                title={`${meta.label}: ${count} (${pct.toFixed(0)}%)`}
              >
                {pct >= 8 ? count : ""}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
          {keys.map((key) => {
            const count = dist[key] || 0;
            const meta = STATUS_META[key] || STATUS_META.unknown;
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem" }}>
                <span style={{ 
                  width: "12px", 
                  height: "12px", 
                  borderRadius: "3px", 
                  background: meta.color, 
                  display: "inline-block" 
                }} />
                <span style={{ color: "var(--text-main)", fontWeight: "500" }}>{meta.label}</span>
                <span style={{ color: "var(--muted)" }}>({count})</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Renders the Executive Summary View
  const renderExecutiveSummary = () => {
    if (!reportData) return null;

    const { statusDistribution, totalKpis, measuredKpis, kraSummaries, pendingMeasurements, criticalWatchlist } = reportData;
    const completenessPct = totalKpis > 0 ? Math.round((measuredKpis / totalKpis) * 100) : 0;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        
        {renderStatusDistributionBar(statusDistribution)}

        <div className="card">
          <div className="card__body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "0.2rem" }}>KPI Reporting Completeness</h3>
              <p className="cell-sub">Percentage of active metrics logged by assignees for {selectedPeriod}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "1.8rem", fontWeight: "700", color: "var(--primary)" }}>{completenessPct}%</div>
              <div className="tag" style={{ display: "inline-block", marginTop: "0.2rem" }}>{measuredKpis} / {totalKpis} KPIs Measured</div>
            </div>
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.8rem", fontWeight: "600" }}>KRA Area Performance Cards</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            {kraSummaries.map((kra) => (
              <div className="card" key={kra.kraAreaId} style={{ borderLeft: "4px solid var(--primary)" }}>
                <div className="card__body" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", minHeight: "150px" }}>
                  <div>
                    <h3 style={{ fontSize: "0.95rem", marginBottom: "0.4rem", fontWeight: "600", color: "var(--text-main)" }}>
                      {kra.kraAreaName}
                    </h3>
                    <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                      <span className="tag">{kra.totalKpis} KPIs</span>
                      <span className="tag">{kra.totalAssignees} Assignments</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "0.8rem" }}>
                    <span className="cell-sub" style={{ fontSize: "0.8rem" }}>Overall KRA Score:</span>
                    <span style={{ fontSize: "1.4rem", fontWeight: "700", color: kra.overallScore ? "var(--text-main)" : "var(--muted)" }}>
                      {kra.overallScore ? Number(kra.overallScore).toFixed(2) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1.5rem" }}>
          
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card__body" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.8rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Icon.alert style={{ color: "var(--bad)", width: 18, height: 18 }} />
                <h3 style={{ fontSize: "1rem", fontWeight: "600" }}>Critical Watchlist</h3>
              </div>
              <p className="cell-sub" style={{ marginTop: "0.1rem" }}>Logged measurements in Red or Critical status</p>
            </div>
            <div style={{ padding: "1rem" }}>
              {criticalWatchlist.length === 0 ? (
                <div className="cell-sub" style={{ textAlign: "center", padding: "2rem" }}>
                  🎉 No critical or red KPI measurements recorded in this period.
                </div>
              ) : (
                <div className="table-wrap" style={{ margin: 0, boxShadow: "none" }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>KPI Metric</th>
                        <th>Assignee</th>
                        <th style={{ textAlign: "right" }}>Actual (Target)</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {criticalWatchlist.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <div className="cell-strong" style={{ fontSize: "0.85rem" }}>{item.kpiName}</div>
                            {item.postAction && (
                              <div className="cell-sub" style={{ marginTop: "0.3rem", fontStyle: "italic", fontSize: "0.75rem", background: "var(--surface-2)", padding: "0.4rem", borderRadius: "4px" }}>
                                <b>Action:</b> {item.postAction}
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: "0.85rem" }}>{item.assigneeName}</td>
                          <td style={{ textAlign: "right", fontSize: "0.85rem" }} className="mono">
                            {Number(item.measuredValue).toFixed(1)} <span className="cell-sub">({Number(item.targetValue).toFixed(1)})</span>
                          </td>
                          <td>
                            <StatusPill status={item.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card__body" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.8rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Icon.copy style={{ color: "var(--warn)", width: 18, height: 18 }} />
                <h3 style={{ fontSize: "1rem", fontWeight: "600" }}>Pending &amp; Missing Measurements</h3>
              </div>
              <p className="cell-sub" style={{ marginTop: "0.1rem" }}>Assignees who have not completed logging</p>
            </div>
            <div style={{ padding: "1rem" }}>
              {pendingMeasurements.length === 0 ? (
                <div className="cell-sub" style={{ textAlign: "center", padding: "2rem" }}>
                  ✅ All assigned measurements have been successfully submitted.
                </div>
              ) : (
                <div className="table-wrap" style={{ margin: 0, boxShadow: "none" }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>KPI Metric</th>
                        <th>Assignee Name</th>
                        <th>Status / Pending Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingMeasurements.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontSize: "0.85rem" }} className="cell-strong">{item.kpiName}</td>
                          <td style={{ fontSize: "0.85rem" }}>{item.assigneeName}</td>
                          <td>
                            <span 
                              className="tag" 
                              style={{ 
                                background: item.reason === "No measurement recorded yet" ? "var(--surface-2)" : "var(--warn-bg)",
                                color: item.reason === "No measurement recorded yet" ? "var(--muted)" : "var(--warn)",
                                fontSize: "0.8rem"
                              }}
                            >
                              {item.reason}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    );
  };

  // Renders the KPI Health Report View (grouped by KRA, with expandable assignees)
  const renderKpiHealthReport = () => {
    if (!reportData) return null;

    const { kraHealths } = reportData;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
        
        {kraHealths.map((kra) => (
          <div key={kra.kraAreaId}>
            <div style={{ 
              background: "var(--primary-bg)", 
              color: "var(--primary)", 
              padding: "0.6rem 1rem", 
              borderRadius: "6px 6px 0 0", 
              fontWeight: "600",
              fontSize: "0.9rem",
              borderLeft: "4px solid var(--primary)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span>{kra.kraAreaName}</span>
              <span className="tag" style={{ background: "#fff", color: "var(--primary)", fontWeight: "700" }}>{kra.kpiHealths.length} KPIs</span>
            </div>

            <div className="table-wrap" style={{ margin: 0, borderRadius: "0 0 6px 6px", borderTop: "none" }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>KPI Metric Name</th>
                    <th>Source</th>
                    <th style={{ textAlign: "center" }}>Assignments</th>
                    <th style={{ textAlign: "right" }}>Overall Score</th>
                    <th style={{ textAlign: "center" }}>Overall Status</th>
                    <th style={{ width: "100px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {kra.kpiHealths.map((kpi) => {
                    const isExpanded = expandedKpiIds.has(kpi.kpiId);
                    return (
                      // Using Fragment instead of optgroup so browser aligns columns correctly
                      <Fragment key={kpi.kpiId}>
                        <tr style={{ background: isExpanded ? "var(--surface-2)" : "inherit" }}>
                          <td>
                            <div className="cell-strong" style={{ fontSize: "0.9rem" }}>{kpi.kpiName}</div>
                            <div className="cell-sub" style={{ fontSize: "0.75rem", marginTop: "0.1rem" }}>
                              Target: {kpi.targetExpression || "—"} {kpi.unit ? `(${kpi.unit})` : ""}
                            </div>
                          </td>
                          <td style={{ fontSize: "0.85rem" }} className="cell-sub">{kpi.sourceSystem || "—"}</td>
                          <td style={{ textAlign: "center", fontSize: "0.85rem" }}>
                            <span className="tag" style={{ fontWeight: "600" }}>{kpi.assigneeCount} Assigned</span>
                          </td>
                          <td style={{ textAlign: "right", fontSize: "0.9rem" }} className="mono font-bold">
                            {kpi.overallScore ? Number(kpi.overallScore).toFixed(2) : "—"}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <StatusPill status={kpi.overallStatus} />
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button 
                              className="btn btn--sub" 
                              style={{ 
                                padding: "0.2rem 0.5rem", 
                                fontSize: "0.75rem",
                                background: isExpanded ? "var(--primary-bg)" : "var(--surface-2)",
                                color: isExpanded ? "var(--primary)" : "var(--text-main)",
                              }}
                              onClick={() => toggleKpiExpanded(kpi.kpiId)}
                            >
                              {isExpanded ? "Hide logs" : "View logs"}
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan="6" style={{ padding: "0.8rem 1.5rem", background: "var(--surface-1)" }}>
                              <div style={{ 
                                borderLeft: "3px solid var(--border)", 
                                paddingLeft: "1rem", 
                                display: "flex", 
                                flexDirection: "column", 
                                gap: "0.6rem" 
                              }}>
                                <h4 style={{ fontSize: "0.8rem", fontWeight: "600", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.5px" }}>
                                  Individual Assignee Submissions
                                </h4>
                                
                                {kpi.measurements.length === 0 ? (
                                  <div className="cell-sub" style={{ fontSize: "0.8rem", padding: "0.4rem 0" }}>
                                    ⚠️ No individual assignee measurements have been recorded for this KPI in this period.
                                  </div>
                                ) : (
                                  <div className="table-wrap" style={{ margin: 0, boxShadow: "none" }}>
                                    <table className="data" style={{ background: "transparent" }}>
                                      <thead>
                                        <tr style={{ background: "transparent" }}>
                                          <th style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>Assignee</th>
                                          <th style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", textAlign: "right" }}>Measured Value</th>
                                          <th style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", textAlign: "center" }}>Status</th>
                                          <th style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>Notes &amp; Post Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {kpi.measurements.map((m, mIdx) => (
                                          <tr key={mIdx} style={{ background: "transparent" }}>
                                            <td style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>
                                              <span style={{ fontWeight: "500" }}>{m.assigneeName}</span>
                                            </td>
                                            <td style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", textAlign: "right" }} className="mono">
                                              {m.isPending ? "—" : Number(m.measuredValue).toFixed(2)}
                                            </td>
                                            <td style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", textAlign: "center" }}>
                                              {m.isPending ? (
                                                <span className="tag" style={{ background: "var(--warn-bg)", color: "var(--warn)", fontSize: "0.75rem" }}>Pending</span>
                                              ) : (
                                                <StatusPill status={m.status} />
                                              )}
                                            </td>
                                            <td style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>
                                              {m.isPending ? (
                                                <div className="cell-sub"><b>Reason:</b> {m.pendingReason || "Data pending"}</div>
                                              ) : (
                                                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                                                  {m.measurementNote && <div className="cell-sub"><b>Note:</b> {m.measurementNote}</div>}
                                                  {m.postAction && <div className="cell-sub" style={{ color: "var(--primary)" }}><b>Action:</b> {m.postAction}</div>}
                                                  {!m.measurementNote && !m.postAction && <span className="cell-sub">—</span>}
                                                </div>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      </div>
    );
  };

  return (
    <Layout crumb={
      <>
        <span>Administration</span> · <b>Reports</b>
        {activeReport && (
          <>
            {" · "}
            <span style={{ textTransform: "capitalize" }}>
              {activeReport.replace("-", " ")}
            </span>
          </>
        )}
      </>
    }>
      {/* Styles injected specifically for clean printing to PDF */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }
          .sidebar, .topbar, .no-print, .btn, .select, select, button {
            display: none !important;
          }
          .main {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .content {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .card {
            box-shadow: none !important;
            border: 1px solid #ddd !important;
            background: #fff !important;
            page-break-inside: avoid;
          }
          table.data {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          table.data th, table.data td {
            border: 1px solid #ddd !important;
            padding: 6px !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem" }}>
        <div>
          {activeReport ? (
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }} className="no-print">
              <button 
                className="btn btn--sub" 
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.6rem" }}
                onClick={() => {
                  setActiveReport(null);
                  setReportData(null);
                }}
              >
                <span>← Back to Reports</span>
              </button>

              <button 
                className="btn btn--sub" 
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.6rem" }}
                onClick={() => window.print()}
                disabled={loadingReport || !reportData}
              >
                <span>Export to PDF</span>
              </button>

              <button 
                className="btn btn--sub" 
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.6rem" }}
                onClick={() => {
                  if (activeReport === "executive-summary") {
                    exportExecutiveSummaryCsv(reportData, selectedPeriod);
                  } else if (activeReport === "kpi-health") {
                    exportKpiHealthCsv(reportData.kraHealths, selectedPeriod);
                  }
                }}
                disabled={loadingReport || !reportData}
              >
                <span>Export to Excel (CSV)</span>
              </button>
            </div>
          ) : null}
          <h1 style={{ margin: 0 }}>Reports &amp; analytics</h1>
          <p className="cell-sub" style={{ margin: "0.2rem 0 0 0" }}>
            {activeReport 
              ? `Review details and operational audits for ${selectedPeriod}`
              : "Generate KPI reports for reviews and stakeholders."
            }
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--surface-1)", padding: "0.5rem 0.8rem", borderRadius: "6px", border: "1px solid var(--border)" }} className="no-print">
          <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-main)", margin: 0 }}>Report Period:</label>
          {loadingPeriods ? (
            <span className="cell-sub" style={{ fontSize: "0.8rem" }}>Loading...</span>
          ) : (
            <select 
              className="select" 
              style={{ padding: "0.25rem 0.5rem", minWidth: "130px", fontSize: "0.85rem", height: "auto", margin: 0 }}
              value={selectedPeriod} 
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              {periods.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: "4px solid var(--bad)", marginBottom: "1.5rem" }}>
          <div className="card__body" style={{ color: "var(--bad)" }}>
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {loadingReport ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "250px", gap: "1rem" }}>
          <Spinner />
          <span className="cell-sub">Compiling and averaging score cards...</span>
        </div>
      ) : activeReport ? (
        activeReport === "executive-summary" ? renderExecutiveSummary() : renderKpiHealthReport()
      ) : (
        renderTemplateGrid()
      )}
    </Layout>
  );
}
