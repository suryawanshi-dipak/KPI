import { useState } from "react";
import { 
  saveFeedbackAction, 
  deleteFeedbackAction, 
  refreshJiraStatus, 
  recordVerification 
} from "../lib/store";

/**
 * Slide-out drawer panel to log, edit, delete, sync, and override KPI feedback remediation actions.
 * Integrates directly with the running Spring Boot backend.
 */
export default function RemediationPanel({ 
  kpi, 
  currentUser, 
  allMeasurements = [], 
  allFeedbackActions = [], 
  onClose, 
  onRefreshData 
}) {
  // Determine role checks based on the logged-in user details
  const isHR = currentUser?.role === "hr";
  const isEmployee = currentUser?.role === "employee";
  const isAdmin = currentUser?.role === "admin";
  const isManager = currentUser?.role === "manager";

  // Check if current user is the assignee/owner of the KPI
  const isOwner = Number(kpi.employeeId) === Number(currentUser?.id);

  // Read-only logic: HR is always read-only, Employees can only write to their own assigned KPIs
  const isReadOnly = isHR || (isEmployee && !isOwner);

  // Edit / Delete authorization: Admin, Manager, or Employee (only for their own KPI)
  const canEditOrDelete = !isHR && (isAdmin || isManager || (isEmployee && isOwner));

  // local states for mode switching
  const [isEditing, setIsEditing] = useState(false);
  const [isReescalating, setIsReescalating] = useState(false);

  // Form input states (initialized directly from props, reset via component key)
  const [rootCause, setRootCause] = useState(() => {
    if (kpi.feedbackAction && !isReescalating) {
      return kpi.feedbackAction.rootCause || "";
    }
    return "";
  });
  const [jiraKey, setJiraKey] = useState(() => {
    if (kpi.feedbackAction && !isReescalating) {
      return kpi.feedbackAction.linkedJiraIssueKey || "";
    }
    return "";
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Jira Status states
  const [jiraStatus, setJiraStatus] = useState(() => {
    if (kpi.feedbackAction && !isReescalating) {
      return kpi.feedbackAction.jiraStatusSnapshot || null;
    }
    return null;
  });
  const [lastSynced, setLastSynced] = useState(() => {
    if (kpi.feedbackAction && !isReescalating) {
      return kpi.feedbackAction.jiraStatusLastSyncedAt || null;
    }
    return null;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Admin override mode (correct/unlink Jira key)
  const [isAdminOverride, setIsAdminOverride] = useState(false);
  const [adminJiraKey, setAdminJiraKey] = useState("");


  // Client-side Jira key validation helper matching the backend regex validation
  const validateJiraKey = (key) => {
    if (!key) return true; // Optional field
    return /^[A-Z]+-\d+$/.test(key.trim().toUpperCase());
  };

  // Submit handler (creates new feedback action, edits existing, or logs a re-escalation)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;

    // Validate mandatory root cause field
    if (!rootCause.trim()) {
      setError("Root cause explanation is mandatory.");
      return;
    }

    // Validate Jira key format pattern
    if (jiraKey && !validateJiraKey(jiraKey)) {
      setError("Jira issue key must match the format KEY-##### (e.g. CARIT-20456).");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Find the previous feedback action ID if we are doing a re-escalation
      let previousFeedbackId = null;
      if (isReescalating) {
        // Look up previous failed feedback actions for this KPI and employee
        const prevFb = allFeedbackActions.find(f => {
          const m = allMeasurements.find(meas => Number(meas.id) === Number(f.kpiMeasurementId));
          return m && 
            Number(m.kpi_metric_id) === Number(kpi.kpiMetricId) && 
            Number(m.subject_employee_id) === Number(kpi.employeeId) && 
            (f.verificationResult === "not_improved" || f.verificationResult === "not_verifiable");
        });
        previousFeedbackId = prevFb ? prevFb.id : (kpi.feedbackAction?.id || null);
      } else {
        previousFeedbackId = kpi.feedbackAction?.relatedPreviousFeedbackId || null;
      }

      // Prepare payload matching KpiFeedbackActionRequest.java DTO
      const payload = {
        kpiMeasurementId: kpi.id,
        rootCauseSummary: rootCause.trim(),
        linkedJiraIssueKey: jiraKey.trim() ? jiraKey.trim().toUpperCase() : null,
        submittedBy: currentUser?.id,
        jiraStatusSnapshot: jiraKey ? (jiraStatus || "To Do") : null,
        relatedPreviousFeedbackId: previousFeedbackId
      };

      // Set ID if editing an existing active feedback action
      if (!isReescalating && kpi.feedbackAction?.id) {
        payload.id = kpi.feedbackAction.id;
      }

      // Call store API to persist feedback action on the backend
      const result = await saveFeedbackAction(payload);

      // If a Jira key was added and status is Done/Rejected, update verification result
      if (payload.linkedJiraIssueKey) {
        let nextVerification = null;
        if (result.jiraStatusSnapshot === "Done") {
          nextVerification = "pending";
        } else if (result.jiraStatusSnapshot === "Rejected" || result.jiraStatusSnapshot === "Won't Fix" || result.jiraStatusSnapshot === "Won't Do") {
          nextVerification = "not_verifiable";
        }

        if (nextVerification) {
          await recordVerification(result.id, {
            verificationResult: nextVerification,
            verificationKpiMeasurementId: kpi.id
          });
        }
      }

      alert(isReescalating ? "Re-escalation feedback successfully logged!" : "Remediation feedback successfully saved!");
      setIsEditing(false);
      setIsReescalating(false);
      
      // Notify parent component to reload state
      onRefreshData();
    } catch (err) {
      setError(err.message || "Failed to save feedback action. Check for duplicate active feedback.");
    } finally {
      setSaving(false);
    }
  };

  // Delete handler for feedback actions
  const handleDelete = async () => {
    if (!canEditOrDelete) return;
    if (window.confirm("Are you sure you want to delete this remediation feedback? This will completely clear all feedback and reset verification status.")) {
      try {
        await deleteFeedbackAction(kpi.feedbackAction.id);
        setIsEditing(false);
        setIsReescalating(false);
        setRootCause("");
        setJiraKey("");
        setJiraStatus(null);
        setLastSynced(null);
        alert("Remediation feedback deleted.");
        onRefreshData();
      } catch (err) {
        alert(err.message || "Failed to delete feedback action.");
      }
    }
  };

  // Sync Jira Status using the real outbound Jira endpoint or mock configuration in backend
  const handleJiraRefresh = async () => {
    setIsRefreshing(true);
    try {
      const updatedAction = await refreshJiraStatus(kpi.feedbackAction.id);
      setJiraStatus(updatedAction.jiraStatusSnapshot);
      setLastSynced(updatedAction.jiraStatusLastSyncedAt);
      
      // If the Jira status changes to Done/Rejected, record verification outcome
      let nextVerification = null;
      if (updatedAction.jiraStatusSnapshot === "Done") {
        nextVerification = "pending";
      } else if (updatedAction.jiraResolutionCategory === "not_fixed") {
        nextVerification = "not_verifiable";
      }

      if (nextVerification) {
        await recordVerification(updatedAction.id, {
          verificationResult: nextVerification,
          verificationKpiMeasurementId: kpi.id
        });
      }

      alert(`Jira ticket status synchronized successfully. Current status: ${updatedAction.jiraStatusSnapshot}`);
      onRefreshData();
    } catch (err) {
      alert(err.message || "Failed to synchronize Jira status.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Administrative override handler (unlink or correct Jira issue key)
  const handleAdminOverrideSubmit = async () => {
    if (!isAdmin) return;

    if (adminJiraKey && !validateJiraKey(adminJiraKey)) {
      alert("Invalid Jira key format. Use KEY-##### (must be capitalized).");
      return;
    }

    try {
      const newKey = adminJiraKey.trim() ? adminJiraKey.trim().toUpperCase() : null;

      // Admin updates the linked key using the PUT endpoint
      const payload = {
        id: kpi.feedbackAction.id,
        kpiMeasurementId: kpi.id,
        rootCauseSummary: rootCause,
        linkedJiraIssueKey: newKey,
        submittedBy: kpi.feedbackAction.submittedById || currentUser?.id,
        jiraStatusSnapshot: newKey ? "To Do" : null,
        relatedPreviousFeedbackId: kpi.feedbackAction.relatedPreviousFeedbackId
      };

      await saveFeedbackAction(payload);
      
      alert("Administrative override saved successfully.");
      setIsAdminOverride(false);
      onRefreshData();
    } catch (err) {
      alert(err.message || "Failed to apply administrative override.");
    }
  };

  // Trigger re-escalation input form
  const handleInitiateReescalate = () => {
    setIsReescalating(true);
    setRootCause("");
    setJiraKey("");
    setJiraStatus(null);
    setLastSynced(null);
  };

  // Compute the historical list of measurements for this KPI and assignee
  const historyRows = allMeasurements
    .filter(
      (m) =>
        Number(m.kpi_metric_id) === Number(kpi.kpiMetricId) &&
        Number(m.subject_employee_id) === Number(kpi.employeeId) &&
        Number(m.id) !== Number(kpi.id) &&
        !m.is_deleted &&
        !m.is_corrected
    )
    .sort((a, b) => String(b.period_start_date).localeCompare(String(a.period_start_date)))
    .map((m) => {
      // Find matching feedback action for the historical measurement
      const fb = allFeedbackActions.find((f) => Number(f.kpiMeasurementId) === Number(m.id));
      return {
        id: m.id,
        period: m.measurement_period_label,
        value: m.measured_value,
        ragStatus: m.status,
        verificationResult: fb ? fb.verificationResult : null,
        verifiedAfterIssueKey: fb ? fb.linkedJiraIssueKey : null,
      };
    });

  // Highlight if previous attempt failed or was marked closed unfixed
  const isFailedRemediation = kpi.verificationResult === "not_improved" || kpi.verificationResult === "not_verifiable";

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        
        {/* Drawer Header */}
        <div className="drawer__head">
          <div className="drawer__title">
            <h2>Link Remediation</h2>
            <span>Feedback Loop for Non-Green KPI</span>
          </div>
          <button className="drawer__close" onClick={onClose} aria-label="Close panel">✕</button>
        </div>

        {/* Drawer Body */}
        <div className="drawer__body">
          
          {/* KPI Summary Banner */}
          <div className="drawer-kpi-summary">
            <div className="drawer-kpi-summary__info">
              <span className="drawer-kpi-summary__name">{kpi.kpiName}</span>
              <span className="drawer-kpi-summary__owner">
                Assigned: <strong>{kpi.employeeName}</strong> · Period: {kpi.period}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="mono" style={{ fontSize: "1.05rem", fontWeight: 700 }}>
                {kpi.value} <span style={{ color: "var(--muted)", fontSize: "0.74rem" }}>vs {kpi.target}</span>
              </span>
              <span className={`rag-dot rag-dot--${kpi.ragStatus}`}></span>
            </div>
          </div>

          {/* Access Warning Banner */}
          {isReadOnly && (
            <div style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", color: "#475569", padding: "0.6rem 0.85rem", borderRadius: "var(--r-sm)", fontSize: "0.78rem" }}>
              ℹ️ <strong>Read-only View:</strong> {isHR ? "HR role has read-only auditor access" : "You are not the assignee or manager for this KPI"}.
            </div>
          )}

          {/* Re-escalation Failure Notice */}
          {isFailedRemediation && !isReescalating && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", color: "#c2410c", padding: "0.8rem 1rem", borderRadius: "var(--r)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div>
                <strong>⚠️ Remediation Loop Flagged for Re-escalation:</strong> The previous attempt was marked as{" "}
                <strong>{kpi.verificationResult === "not_improved" ? "Not Improved" : "Closed Unfixed (Jira Rejected)"}</strong>. A new feedback loop should be initiated.
              </div>
              {!isReadOnly && (
                <button
                  type="button"
                  className="btn btn--primary"
                  style={{ alignSelf: "flex-start", background: "#ea580c", borderColor: "#ea580c", fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}
                  onClick={handleInitiateReescalate}
                >
                  🚀 Initiate Re-escalation Feedback
                </button>
              )}
            </div>
          )}

          {/* CASE 1: Form is shown (creating new, editing, or writing re-escalation feedback) */}
          {(!kpi.feedbackAction || isEditing || isReescalating) ? (
            <div className="card">
              <div className="card__head">
                <h3>
                  {isReescalating
                    ? "Log Re-escalation Feedback (Iterative Loop)"
                    : isEditing
                    ? "Edit Remediation Feedback"
                    : "Log Remediation Feedback"}
                </h3>
                {isReescalating && (
                  <span className="pill pill--red" style={{ fontSize: "0.68rem", padding: "0.1rem 0.4rem" }}>
                    Iteration 2+
                  </span>
                )}
              </div>
              <div className="card__body">
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
                  <div className="field">
                    <label htmlFor="root-cause-textarea">
                      Root Cause Explanation <span className="req">*</span>
                    </label>
                    <textarea
                      id="root-cause-textarea"
                      className={`textarea ${error && !rootCause.trim() ? "invalid" : ""}`}
                      placeholder="Describe why this KPI target was missed (required)..."
                      value={rootCause}
                      onChange={(e) => setRootCause(e.target.value)}
                      disabled={isReadOnly || saving}
                    />
                    <span className="hint">Describe exact technical or operational failure points.</span>
                  </div>

                  <div className="field">
                    <label htmlFor="jira-key-input">Linked Jira Issue Key (Optional)</label>
                    <input
                      id="jira-key-input"
                      type="text"
                      className={`input input--mono ${error && jiraKey && !validateJiraKey(jiraKey) ? "invalid" : ""}`}
                      placeholder="e.g. CARIT-12345"
                      value={jiraKey}
                      onChange={(e) => setJiraKey(e.target.value)}
                      disabled={isReadOnly || saving}
                    />
                    <span className="hint">Format: KEY-##### (e.g. CARIT-20456 or KPI-101).</span>
                  </div>

                  {error && (
                    <div className="field-error" style={{ marginTop: "-0.5rem" }}>
                      ⚠️ {error}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <button type="submit" className="btn btn--primary" disabled={saving}>
                      {saving ? "Saving..." : isReescalating ? "Submit Re-escalation" : isEditing ? "Save Changes" : "Save Remediation"}
                    </button>
                    {isEditing && (
                      <button type="button" className="btn" onClick={() => setIsEditing(false)} disabled={saving}>
                        Cancel Edit
                      </button>
                    )}
                    {isReescalating && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setIsReescalating(false);
                          setError(null);
                        }}
                        disabled={saving}
                      >
                        Cancel Re-escalation
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          ) : (
            /* CASE 2: Feedback is logged and not in edit/reescalation form, show summary card */
            <div className="card" style={{ borderLeft: "4px solid var(--primary)" }}>
              <div className="card__head" style={{ padding: "0.85rem 1.25rem" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <h3 style={{ fontWeight: 600 }}>Logged Remediation Feedback</h3>
                  <span style={{ fontSize: "0.74rem", color: "var(--muted)" }}>
                    Logged by {kpi.feedbackAction.submittedBy}
                  </span>
                </div>
                {canEditOrDelete && (
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      className="btn"
                      style={{ padding: "0.2rem 0.5rem", fontSize: "0.76rem", display: "flex", alignItems: "center", gap: "0.2rem" }}
                      onClick={() => {
                        setIsEditing(true);
                        setError(null);
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn--danger"
                      style={{ padding: "0.2rem 0.5rem", fontSize: "0.76rem", display: "flex", alignItems: "center", gap: "0.2rem" }}
                      onClick={handleDelete}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                )}
              </div>
              <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div>
                  <strong style={{ fontSize: "0.8rem", color: "var(--ink-soft)", display: "block", marginBottom: "0.2rem" }}>
                    Root Cause:
                  </strong>
                  <p style={{ fontSize: "0.86rem", lineHeight: "1.4", whiteSpace: "pre-wrap", color: "var(--ink)" }}>
                    {kpi.feedbackAction.rootCause}
                  </p>
                </div>
                
                <div>
                  <strong style={{ fontSize: "0.8rem", color: "var(--ink-soft)", display: "block", marginBottom: "0.2rem" }}>
                    Jira Issue Link:
                  </strong>
                  {kpi.feedbackAction.linkedJiraIssueKey ? (
                    <span className="mono" style={{ fontWeight: 600, fontSize: "0.86rem", color: "var(--primary)" }}>
                      {kpi.feedbackAction.linkedJiraIssueKey}
                    </span>
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: "0.82rem", fontStyle: "italic" }}>
                      No Jira issue tracked (Root cause only)
                    </span>
                  )}
                </div>

                {kpi.feedbackAction.relatedPreviousFeedbackId && (
                  <div style={{ background: "var(--surface-2)", padding: "0.4rem 0.6rem", borderRadius: "4px", borderLeft: "2px solid #ea580c", fontSize: "0.74rem" }}>
                    🔄 <strong>Iterative Loop:</strong> This feedback was logged as a re-escalation referencing previous attempt ID <code>{kpi.feedbackAction.relatedPreviousFeedbackId}</code>.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Jira Status Strip - only when there is a linked issue and not in re-escalation entry mode */}
          {kpi.feedbackAction && kpi.feedbackAction.linkedJiraIssueKey && !isReescalating && (
            <div className="jira-strip">
              <div className="jira-strip__header">
                <span>Linked Jira Issue</span>
                <span className="mono">{kpi.feedbackAction.linkedJiraIssueKey}</span>
              </div>
              <div className="jira-strip__main">
                <div>
                  <span className="jira-strip__sync" style={{ display: "block", marginBottom: "0.2rem" }}>Status Snapshot:</span>
                  <span className={`jira-strip__badge ${
                    jiraStatus === "To Do" || jiraStatus === "To Do" ? "jira-strip__badge--todo" :
                    jiraStatus === "In Progress" ? "jira-strip__badge--progress" :
                    jiraStatus === "Done" || jiraStatus === "Closed" || jiraStatus === "Resolved" ? "jira-strip__badge--done" :
                    "jira-strip__badge--rejected"
                  }`}>
                    {jiraStatus || "Loading..."}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="jira-strip__sync" style={{ display: "block" }}>
                    Synced: {lastSynced ? new Date(lastSynced).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Never"}
                  </span>
                  <div className="jira-strip__actions" style={{ marginTop: "0.2rem" }}>
                    {!isHR && (
                      <button
                        className="jira-strip__btn-sync"
                        onClick={handleJiraRefresh}
                        disabled={isRefreshing}
                      >
                        {isRefreshing ? "Syncing..." : "🔄 Refresh"}
                      </button>
                    )}
                    <a
                      href={`https://vivekanandtechnologies2018.atlassian.net/browse/${kpi.feedbackAction.linkedJiraIssueKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="jira-strip__link"
                    >
                      View in Jira ↗
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Admin Override panel */}
          {isAdmin && kpi.feedbackAction && !isReescalating && (
            <div className="admin-audit-section">
              <div className="admin-audit-section__title">🛡️ Admin Controls</div>
              
              {!isAdminOverride ? (
                <button
                  type="button"
                  className="btn btn--danger btn--ghost"
                  style={{ alignSelf: "flex-start", padding: "0.3rem 0.6rem", fontSize: "0.78rem" }}
                  onClick={() => {
                    setIsAdminOverride(true);
                    setAdminJiraKey(jiraKey);
                  }}
                >
                  Correct / Unlink Jira Key
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.4rem" }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <input
                      type="text"
                      className="input input--mono"
                      placeholder="Enter corrected key, or leave blank to unlink"
                      value={adminJiraKey}
                      onChange={(e) => setAdminJiraKey(e.target.value)}
                    />
                    <span className="hint">Leave empty to completely remove the Jira link (unlink).</span>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="btn btn--primary"
                      style={{ padding: "0.3rem 0.6rem", fontSize: "0.78rem" }}
                      onClick={handleAdminOverrideSubmit}
                    >
                      Apply Override
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: "0.3rem 0.6rem", fontSize: "0.78rem" }}
                      onClick={() => setIsAdminOverride(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Past Measurements Section */}
          <div className="past-measurements-section">
            <h4>Measurement History & Verification</h4>
            {historyRows.length === 0 ? (
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}>No historical measurements recorded for this KPI.</p>
            ) : (
              <div className="past-table-wrap">
                <table className="past-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Value</th>
                      <th>RAG</th>
                      <th>Remediation Link / Verification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Render the current verified row if applicable */}
                    {kpi.verificationResult && kpi.feedbackAction && (
                      <tr style={{ background: "var(--primary-bg)" }}>
                        <td className="cell-strong">{kpi.period}</td>
                        <td className="mono">{kpi.value}</td>
                        <td><span className={`rag-dot rag-dot--${kpi.ragStatus}`}></span></td>
                        <td>
                          {kpi.verificationResult === "improved" && (
                            <span className="verification-marker verification-marker--improved">
                              ✅ Improved after {kpi.verifiedAfterIssueKey}
                            </span>
                          )}
                          {kpi.verificationResult === "not_improved" && (
                            <span className="verification-marker verification-marker--not-improved">
                              ⚠️ Not improved after {kpi.verifiedAfterIssueKey}
                            </span>
                          )}
                          {kpi.verificationResult === "not_verifiable" && (
                            <span className="verification-marker verification-marker--closed-unfixed">
                              🛑 Closed unfixed after {kpi.verifiedAfterIssueKey}
                            </span>
                          )}
                          {kpi.verificationResult === "pending" && (
                            <span className="verification-marker verification-marker--pending">
                              ⌛ Resolved: awaiting verification
                            </span>
                          )}
                        </td>
                      </tr>
                    )}
                    {historyRows.map((row) => (
                      <tr key={row.id}>
                        <td className="cell-strong">{row.period}</td>
                        <td className="mono">{row.value}</td>
                        <td><span className={`rag-dot rag-dot--${row.ragStatus}`}></span></td>
                        <td>
                          {row.verificationResult ? (
                            row.verificationResult === "improved" ? (
                              <span className="verification-marker verification-marker--improved">
                                ✅ Improved after {row.verifiedAfterIssueKey}
                              </span>
                            ) : row.verificationResult === "not_improved" ? (
                              <span className="verification-marker verification-marker--not-improved">
                                ⚠️ Not improved after {row.verifiedAfterIssueKey}
                              </span>
                            ) : row.verificationResult === "not_verifiable" ? (
                              <span className="verification-marker verification-marker--closed-unfixed">
                                🛑 Closed unfixed after {row.verifiedAfterIssueKey}
                              </span>
                            ) : (
                              <span className="verification-marker verification-marker--pending">
                                ⌛ Resolved: awaiting verification
                              </span>
                            )
                          ) : (
                            <span style={{ color: "var(--muted)", fontSize: "0.74rem" }}>
                              No verification marker (Green or no linked issue)
                            </span>
                          )}
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
}
