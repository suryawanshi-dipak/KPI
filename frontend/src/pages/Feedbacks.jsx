import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Spinner } from "../components/UI";
import RemediationPanel from "../components/RemediationPanel";
import { 
  getCurrentUser, 
  listEmployees, 
  listKpis, 
  listAssignments, 
  listMeasurements, 
  listFeedbackActions,
  kraName
} from "../lib/store";

/**
 * Helper to determine the text and badge style for a given KPI status and verification result.
 * Matches the badge rules in the prototype remediation UI.
 */
function getBadgeState(kpi) {
  // If green, only carry a badge if verified improved
  if (kpi.ragStatus === "green") {
    if (kpi.verificationResult === "improved") {
      return "Improved";
    }
    return null;
  }

  // Handle explicit verification results on non-green KPIs
  if (kpi.verificationResult === "improved") {
    return "Improved";
  } else if (kpi.verificationResult === "not_improved") {
    return "Not improved — re-escalate";
  } else if (kpi.verificationResult === "not_verifiable") {
    return "Closed unfixed — re-escalate";
  }

  const fb = kpi.feedbackAction;
  if (!fb) {
    return "Feedback needed";
  }

  if (!fb.linkedJiraIssueKey) {
    return "Root cause logged — no fix tracked";
  }

  // Fix: use jiraResolvedAt instead of hardcoded Done/Closed/Resolved status text strings
  if (fb.jiraResolvedAt) {
    return "Resolved in Jira — awaiting verification";
  }

  // Fix: add distinct state for linked but never synced
  if (!fb.jiraStatusSnapshot) {
    return `Linked but never synced — ${fb.linkedJiraIssueKey}`;
  }

  // Fix: show the actual jiraStatusSnapshot value instead of always saying "In progress"
  return `${fb.jiraStatusSnapshot} — ${fb.linkedJiraIssueKey}`;
}

/**
 * Helper to resolve CSS class for remediation badges.
 * Matches styling classes defined in the prototype.
 */
function getBadgeStyleClass(badgeState) {
  if (!badgeState) return "";
  
  if (badgeState === "Feedback needed") return "rem-badge--feedback-needed";
  if (badgeState === "Root cause logged — no fix tracked") return "rem-badge--no-fix-tracked";
  if (badgeState === "Resolved in Jira — awaiting verification") return "rem-badge--resolved-jira";
  if (badgeState === "Improved") return "rem-badge--improved";
  if (badgeState === "Not improved — re-escalate") return "rem-badge--not-improved";
  if (badgeState === "Closed unfixed — re-escalate") return "rem-badge--closed-unfixed";
  
  // Fix: style any unresolved Jira status (includes a separator) with in-progress style
  if (badgeState.includes(" — ")) return "rem-badge--in-progress";
  
  return "";
}

/**
 * Shared helper to map measurements, assignments, employees, metrics and feedback actions
 * into a single flat array of KPI objects, filtered by role access.
 */
function processKpiData(user, employees, kpisList, assignments, measurements, feedbackActions) {
  // Collect the current user's team memberships based on their active assignments
  const myTeams = new Set(
    assignments
      .filter((a) => Number(a.employee_id) === Number(user?.id))
      .map((a) => a.team)
      .filter(Boolean)
  );

  const items = [];

  // Loop through all assignments to build latest measurement details
  assignments.forEach((assign) => {
    const emp = employees.find((e) => Number(e.id) === Number(assign.employee_id));
    const kpiMetric = kpisList.find((k) => Number(k.id) === Number(assign.kpi_metric_id));
    
    if (!emp || !kpiMetric || !kpiMetric.is_active) return;

    // Find measurements for this specific assignment
    const assignmentMs = measurements.filter(
      (m) =>
        Number(m.kpi_metric_id) === Number(kpiMetric.id) &&
        Number(m.subject_employee_id) === Number(emp.id) &&
        !m.is_deleted &&
        !m.is_corrected
    );

    if (assignmentMs.length === 0) return;

    // Sort to identify the latest measurement chronologically
    const latestM = [...assignmentMs].sort((a, b) =>
      String(b.period_start_date).localeCompare(String(a.period_start_date))
    )[0];

    // Check if latest measurement is non-green
    const isNonGreen = latestM.status !== "green";

    // Retrieve corresponding active feedback action for this measurement
    const matchedFb = feedbackActions.find(
      (f) => Number(f.kpiMeasurementId) === Number(latestM.id) && !f.isDeleted
    );

    // Find if this measurement verified a prior action as not_improved / not_verifiable (failed remediation)
    const priorFailedFb = !matchedFb ? feedbackActions.find(
      (f) => Number(f.verificationKpiMeasurementId) === Number(latestM.id) &&
             !f.isDeleted &&
             (f.verificationResult === "not_improved" || f.verificationResult === "not_verifiable")
    ) : null;

    // Find if this measurement verified a prior action as improved
    const priorImprovedFb = !matchedFb && !priorFailedFb ? feedbackActions.find(
      (f) => Number(f.verificationKpiMeasurementId) === Number(latestM.id) &&
             !f.isDeleted &&
             f.verificationResult === "improved"
    ) : null;

    // Resolve active feedback action record to link
    const activeFb = matchedFb || priorFailedFb || priorImprovedFb;

    const isImproved = !!priorImprovedFb || (matchedFb && matchedFb.verificationResult === "improved");

    // Skip if KPI is green AND has no improved remediation marker (we only track non-green or improved remediation)
    if (!isNonGreen && !isImproved) return;

    items.push({
      id: latestM.id, // measurement ID
      kpiMetricId: kpiMetric.id,
      kpiName: kpiMetric.name,
      employeeId: emp.id,
      employeeName: emp.name,
      managerId: emp.managerId,
      value: latestM.measured_value,
      target: kpiMetric.target_value,
      unit: kpiMetric.unit === "Percentage" ? "%" : (kpiMetric.unit || ""),
      ragStatus: latestM.status,
      period: latestM.measurement_period_label,
      kraAreaId: kpiMetric.kra_area_id,
      kraArea: kraName(kpiMetric.kra_area_id),
      isTeamKpi: !!kpiMetric.isTeamKpi,
      team: assign.team,
      feedbackAction: activeFb ? {
        id: activeFb.id,
        kpiMeasurementId: activeFb.kpiMeasurementId,
        rootCause: activeFb.rootCauseSummary,
        linkedJiraIssueKey: activeFb.linkedJiraIssueKey,
        jiraStatusSnapshot: activeFb.jiraStatusSnapshot,
        jiraStatusLastSyncedAt: activeFb.jiraStatusLastSyncedAt,
        jiraResolvedAt: activeFb.jiraResolvedAt,
        jiraResolutionCategory: activeFb.jiraResolutionCategory,
        submittedBy: activeFb.submittedByName || `Employee ID ${activeFb.submittedBy}`,
        submittedById: activeFb.submittedBy,
        relatedPreviousFeedbackId: activeFb.relatedPreviousFeedbackId,
      } : null,
      verificationResult: activeFb ? activeFb.verificationResult : null,
      verifiedAfterIssueKey: activeFb ? activeFb.linkedJiraIssueKey : null,
    });
  });

  // Role-based visibility filtering
  let roleFiltered = [];
  const userRole = String(user?.role).toLowerCase();

  if (userRole === "admin" || userRole === "hr") {
    // Admin and HR roles see all relevant KPIs across the entire system
    roleFiltered = items;
  } else if (userRole === "manager") {
    // Managers see their own KPIs + those of their direct reports
    roleFiltered = items.filter(
      (item) =>
        Number(item.employeeId) === Number(user.id) ||
        Number(item.managerId) === Number(user.id)
    );
  } else {
    // Employees see their own assigned KPIs + any Team KPIs in their assigned teams
    roleFiltered = items.filter(
      (item) =>
        Number(item.employeeId) === Number(user.id) ||
        (item.isTeamKpi && item.team && myTeams.has(item.team))
    );
  }

  return roleFiltered;
}

export default function Feedbacks() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allMeasurements, setAllMeasurements] = useState([]);
  const [allFeedbackActions, setAllFeedbackActions] = useState([]);
  const [processedKpis, setProcessedKpis] = useState([]);
  
  // Segmented filter state: 'all' | 'reescalate' | 'improved'
  const [filter, setFilter] = useState("all");
  
  // Active selected KPI for slide-out drawer
  const [selectedKpiId, setSelectedKpiId] = useState(null);

  // Core data loading function wrapper inside useEffect to prevent cascading render warnings
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [
          user,
          employees,
          kpisList,
          assignments,
          measurements,
          feedbackActions
        ] = await Promise.all([
          getCurrentUser(),
          listEmployees(),
          listKpis(),
          listAssignments(),
          listMeasurements(),
          listFeedbackActions()
        ]);

        if (!isMounted) return;

        setCurrentUser(user);
        setAllMeasurements(measurements);
        setAllFeedbackActions(feedbackActions);

        // Process data using shared helper
        const roleFiltered = processKpiData(user, employees, kpisList, assignments, measurements, feedbackActions);
        setProcessedKpis(roleFiltered);
      } catch (err) {
        console.error("Failed to load feedbacks page data:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Reload data trigger called after any mutation in the slide drawer
  const handleReload = async () => {
    setLoading(true);
    try {
      const [
        employees,
        kpisList,
        assignments,
        measurements,
        feedbackActions
      ] = await Promise.all([
        listEmployees(),
        listKpis(),
        listAssignments(),
        listMeasurements(),
        listFeedbackActions()
      ]);

      // Process data using shared helper
      const roleFiltered = processKpiData(currentUser, employees, kpisList, assignments, measurements, feedbackActions);

      setProcessedKpis(roleFiltered);
      setAllMeasurements(measurements);
      setAllFeedbackActions(feedbackActions);
    } catch (err) {
      console.error("Failed to reload feedbacks:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout crumb={<b>KPI Feedbacks</b>}>
        <Spinner />
      </Layout>
    );
  }

  // Filter 2: Apply segmented filter ('all' vs 'reescalate' vs 'improved')
  const filteredKpis = processedKpis.filter((kpi) => {
    if (filter === "all") {
      // Show all non-green KPIs
      return kpi.ragStatus !== "green";
    }
    if (filter === "reescalate") {
      const badge = getBadgeState(kpi);
      return (
        badge === "Not improved — re-escalate" ||
        badge === "Closed unfixed — re-escalate"
      );
    }
    if (filter === "improved") {
      // Show improved KPIs (can be green or non-green)
      return kpi.verificationResult === "improved";
    }
    return true;
  });

  // Calculate dynamic counts for the segmented buttons
  const allCount = processedKpis.filter((k) => k.ragStatus !== "green").length;
  const reescalateCount = processedKpis.filter((kpi) => {
    const badge = getBadgeState(kpi);
    return (
      badge === "Not improved — re-escalate" ||
      badge === "Closed unfixed — re-escalate"
    );
  }).length;
  const improvedCount = processedKpis.filter((k) => k.verificationResult === "improved").length;

  // Identify selected KPI object for the slide-out panel
  const selectedKpiObj = filteredKpis.find((k) => k.id === selectedKpiId) || null;

  // Determine rendering layout based on role
  const userRole = String(currentUser?.role).toLowerCase();
  const isEmployeeRole = userRole === "employee";

  // Grouping logic:
  // For Employee: Group by KRA Area (matching prototype Team Dashboard)
  // For Manager/Admin/HR: Group by Employee (matching prototype Manager Overview)
  const groupedData = isEmployeeRole
    ? filteredKpis.reduce((groups, kpi) => {
        const kra = kpi.kraArea || "Other";
        if (!groups[kra]) groups[kra] = [];
        groups[kra].push(kpi);
        return groups;
      }, {})
    : filteredKpis.reduce((groups, kpi) => {
        const emp = kpi.employeeName || "Unassigned";
        if (!groups[emp]) groups[emp] = [];
        groups[emp].push(kpi);
        return groups;
      }, {});

  // Sort grouped entries so logged-in manager's own name is always displayed FIRST
  const sortedGroupEntries = isEmployeeRole
    ? Object.entries(groupedData)
    : Object.entries(groupedData).sort(([nameA], [nameB]) => {
        if (nameA === currentUser?.name) return -1;
        if (nameB === currentUser?.name) return 1;
        return nameA.localeCompare(nameB);
      });

  return (
    <Layout crumb={<b>KPI Feedbacks</b>}>
      
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1>
            {isEmployeeRole ? "Team KPI Dashboard" : "Manager Overview: Remediation Board"}
          </h1>
          <p>
            {isEmployeeRole 
              ? "Real-time status overview of active operations console metrics." 
              : "Track progress of team remediation actions, Jira tickets, and verification loops."}
          </p>
        </div>
      </div>

      {/* Filter Toggle Segmented Controls */}
      <div className="filter-bar" style={{ justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
          <span style={{ fontWeight: 600, color: "var(--ink-soft)" }}>Filter KPIs:</span>
          <div className="segmented">
            <button
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              All Non-Green ({allCount})
            </button>
            <button
              className={filter === "reescalate" ? "active" : ""}
              onClick={() => setFilter("reescalate")}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              ⚠️ Re-escalate Only ({reescalateCount})
            </button>
            <button
              className={filter === "improved" ? "active" : ""}
              onClick={() => setFilter("improved")}
            >
              ✅ Improved ({improvedCount})
            </button>
          </div>
        </div>
        <div className="cell-sub">
          Showing <strong>{filteredKpis.length}</strong> KPIs requiring attention
        </div>
      </div>

      {/* Main KPI Grid rendering */}
      {filteredKpis.length === 0 ? (
        <div className="empty-board-message">
          <h3>No KPIs Found</h3>
          <p>
            {filter === "reescalate"
              ? "No KPIs are currently flagged as 'Not Improved' or 'Closed Unfixed' awaiting re-escalation."
              : filter === "improved"
              ? "No KPIs are currently flagged as 'Improved'."
              : "All KPIs are green! No remediation feedback actions required."}
          </p>
        </div>
      ) : isEmployeeRole ? (
        /* Employee View - Grouped by KRA Area, separated by headings (exact same as prototype Team Dashboard) */
        <div style={{ display: "flex", flexDirection: "column", gap: "1.8rem" }}>
          {sortedGroupEntries.map(([kraArea, areaKpis]) => (
            <div key={kraArea} className="kra-section">
              <h3
                style={{
                  fontSize: "0.86rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--muted)",
                  marginBottom: "0.75rem",
                  borderBottom: "1px solid var(--rule)",
                  paddingBottom: "0.3rem",
                }}
              >
                {kraArea}
              </h3>
              <div className="kpi-grid">
                {areaKpis.map((kpi) => {
                  const badge = getBadgeState(kpi);
                  const badgeStyleClass = getBadgeStyleClass(badge);

                  return (
                    <div
                      key={kpi.id}
                      className="kpi-tile"
                      onClick={() => setSelectedKpiId(kpi.id)}
                      title={`Click to view remediation details for ${kpi.kpiName}`}
                    >
                      <div className="kpi-tile__top">
                        <div className="kpi-tile__meta">
                          <div className="kpi-tile__name">{kpi.kpiName}</div>
                          <div className="kpi-tile__owner">Owner: {kpi.employeeName}</div>
                        </div>
                        <span className={`rag-dot rag-dot--${kpi.ragStatus}`}></span>
                      </div>

                      <div className="kpi-tile__foot">
                        <div className="kpi-tile__value-container">
                          <span className="kpi-tile__value">{kpi.value}</span>
                          <span className="kpi-tile__target">/ {kpi.target}</span>
                        </div>
                        
                        {badge && (
                          <span className={`remediation-badge ${badgeStyleClass}`} title={badge}>
                            {badge}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Manager / Admin / HR View - Grouped by Employee, with Manager's name first */
        <div className="manager-board">
          {sortedGroupEntries.map(([employeeName, employeeKpis]) => (
            <div key={employeeName} className="employee-row-card">
              
              <div className="employee-row-card__head">
                <span className="employee-row-card__name">
                  👤 {employeeName} {employeeName === currentUser?.name ? "(You)" : ""}
                </span>
                <span className="employee-row-card__count">
                  {employeeKpis.length} active {employeeKpis.length === 1 ? "KPI" : "KPIs"}
                </span>
              </div>

              <div className="employee-row-card__grid">
                {employeeKpis.map((kpi) => {
                  const badge = getBadgeState(kpi);
                  const badgeStyleClass = getBadgeStyleClass(badge);

                  return (
                    <div
                      key={kpi.id}
                      className="kpi-tile"
                      onClick={() => setSelectedKpiId(kpi.id)}
                      title={`Click to view remediation details for ${kpi.kpiName}`}
                      style={{ minHeight: "124px" }}
                    >
                      <div className="kpi-tile__top">
                        <div className="kpi-tile__meta">
                          <div className="kpi-tile__name" style={{ fontSize: "0.9rem" }}>
                            {kpi.kpiName}
                          </div>
                          <div className="cell-sub" style={{ fontSize: "0.74rem" }}>
                            Area: {kpi.kraArea}
                          </div>
                        </div>
                        <span className={`rag-dot rag-dot--${kpi.ragStatus}`}></span>
                      </div>

                      <div className="kpi-tile__foot">
                        <div className="kpi-tile__value-container">
                          <span className="kpi-tile__value" style={{ fontSize: "1.2rem" }}>
                            {kpi.value}
                          </span>
                          <span className="kpi-tile__target" style={{ fontSize: "0.7rem" }}>
                            / {kpi.target}
                          </span>
                        </div>
                        
                        {badge && (
                          <span className={`remediation-badge ${badgeStyleClass}`} style={{ fontSize: "0.7rem" }}>
                            {badge}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Slide-out drawer panel */}
      {selectedKpiObj && (
        <RemediationPanel
          key={`${selectedKpiObj.id}-${selectedKpiObj.feedbackAction ? selectedKpiObj.feedbackAction.id : "none"}`}
          kpi={selectedKpiObj}
          currentUser={currentUser}
          allMeasurements={allMeasurements}
          allFeedbackActions={allFeedbackActions}
          onClose={() => setSelectedKpiId(null)}
          onRefreshData={handleReload}
        />
      )}

    </Layout>
  );
}
