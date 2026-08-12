import { useState, useEffect } from 'react';
import type { KpiMeasurement, Employee, KpiFeedbackAction, AuditEntry, JiraStatus } from '../types';
import { MOCK_HISTORY } from '../mockData';

interface RemediationPanelProps {
  kpi: KpiMeasurement;
  activeUser: Employee;
  onClose: () => void;
  onSubmitFeedback: (kpiId: string, feedback: KpiFeedbackAction, verificationUpdate?: any) => void;
}

const JIRA_STATUS_CYCLE: JiraStatus[] = ['To Do', 'In Progress', 'Done', 'Rejected'];

export default function RemediationPanel({ kpi, activeUser, onClose, onSubmitFeedback }: RemediationPanelProps) {
  const isHR = activeUser.role === 'ROLE_HR';
  const isEmployee = activeUser.role === 'ROLE_EMPLOYEE';
  const isAdmin = activeUser.role === 'ROLE_ADMIN';

  // Check if Employee can edit (only their own KPIs)
  const isOwner = kpi.employeeId === activeUser.id;
  const isReadOnly = isHR || (isEmployee && !isOwner);

  // Form State
  const [rootCause, setRootCause] = useState('');
  const [jiraKey, setJiraKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Jira Strip State
  const [jiraStatus, setJiraStatus] = useState<JiraStatus | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Admin override mode
  const [isAdminOverride, setIsAdminOverride] = useState(false);
  const [adminJiraKey, setAdminJiraKey] = useState('');
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  // Load existing feedback if present
  useEffect(() => {
    if (kpi.feedbackAction) {
      setRootCause(kpi.feedbackAction.rootCause);
      setJiraKey(kpi.feedbackAction.linkedJiraIssueKey || '');
      setJiraStatus(kpi.feedbackAction.jiraStatusSnapshot);
      setLastSynced(kpi.feedbackAction.jiraStatusLastSyncedAt);
      setAuditLog(kpi.feedbackAction.auditTrail || []);
    } else {
      setRootCause('');
      setJiraKey('');
      setJiraStatus(null);
      setLastSynced(null);
      setAuditLog([]);
    }
    setError(null);
    setIsAdminOverride(false);
  }, [kpi]);

  // Form validation
  const validateJiraKey = (key: string): boolean => {
    if (!key) return true; // Optional
    return /^CARIT-\d+$/i.test(key);
  };

  // Submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    if (!rootCause.trim()) {
      setError('Root cause explanation is mandatory.');
      return;
    }

    if (jiraKey && !validateJiraKey(jiraKey)) {
      setError('Jira issue key must match the format CARIT-##### (e.g. CARIT-20456).');
      return;
    }

    // Determine initial Jira status if issue key is provided
    let statusSnapshot: JiraStatus | null = null;
    let syncedAt: string | null = null;
    if (jiraKey) {
      statusSnapshot = jiraStatus || 'To Do';
      syncedAt = lastSynced || new Date().toISOString();
    }

    // Determine verification state update (FR-FB-04)
    // If there is a Jira key, and it goes to terminal status, we will set verification_result to 'pending' or 'improved'
    // To keep it simple, if they link a Jira key, it starts 'In progress' unless the status is terminal.
    let verificationUpdate: any = {};
    if (jiraKey) {
      if (statusSnapshot === 'Done') {
        verificationUpdate = { verificationResult: 'pending' };
      } else if (statusSnapshot === 'Rejected') {
        verificationUpdate = { verificationResult: 'not_verifiable' };
      } else {
        verificationUpdate = { verificationResult: undefined };
      }
    } else {
      // If root cause logged with no Jira key, it is 'no fix tracked' terminal state, which does not run verification
      verificationUpdate = { verificationResult: undefined };
    }

    const feedback: KpiFeedbackAction = {
      id: kpi.feedbackAction?.id || `fb-${Date.now()}`,
      kpiMeasurementId: kpi.id,
      rootCause: rootCause.trim(),
      linkedJiraIssueKey: jiraKey.trim() ? jiraKey.trim().toUpperCase() : null,
      jiraStatusSnapshot: statusSnapshot,
      jiraStatusLastSyncedAt: syncedAt,
      submittedBy: kpi.feedbackAction?.submittedBy || activeUser.name.split(' (')[0],
      submittedRole: kpi.feedbackAction?.submittedRole || activeUser.role,
      auditTrail: auditLog,
      relatedPreviousFeedbackId: kpi.feedbackAction?.relatedPreviousFeedbackId,
    };

    onSubmitFeedback(kpi.id, feedback, verificationUpdate);
    setError(null);
    alert('Remediation feedback successfully logged!');
  };

  // Sync Jira Status simulator (FR-FB-03)
  const handleJiraRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      // Find next status in cycle
      const currentIdx = jiraStatus ? JIRA_STATUS_CYCLE.indexOf(jiraStatus) : -1;
      const nextIdx = (currentIdx + 1) % JIRA_STATUS_CYCLE.length;
      const nextStatus = JIRA_STATUS_CYCLE[nextIdx];
      const nextSyncedAt = new Date().toISOString();

      setJiraStatus(nextStatus);
      setLastSynced(nextSyncedAt);
      setIsRefreshing(false);

      // Trigger state change in parent to persist the refresh status
      if (kpi.feedbackAction) {
        let updatedVerificationResult = kpi.verificationResult;
        if (nextStatus === 'Done') {
          updatedVerificationResult = 'pending'; // Awaiting verification
        } else if (nextStatus === 'Rejected') {
          updatedVerificationResult = 'not_verifiable'; // Closed unfixed
        } else {
          updatedVerificationResult = undefined; // Clear verification if moved back to To Do / In Progress
        }

        const updatedFeedback: KpiFeedbackAction = {
          ...kpi.feedbackAction,
          jiraStatusSnapshot: nextStatus,
          jiraStatusLastSyncedAt: nextSyncedAt,
        };
        onSubmitFeedback(kpi.id, updatedFeedback, { verificationResult: updatedVerificationResult });
      }
    }, 800); // Small delay to feel realistic
  };

  // Administrative correct/unlink Jira key (FR-FB-09)
  const handleAdminOverrideSubmit = () => {
    if (!isAdmin) return;

    if (adminJiraKey && !validateJiraKey(adminJiraKey)) {
      alert('Invalid Jira key format. Use CARIT-#####.');
      return;
    }

    const previousKey = jiraKey;
    const newKey = adminJiraKey.trim() ? adminJiraKey.trim().toUpperCase() : null;
    
    // Create audit trail entry
    const auditEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      adminName: activeUser.name.split(' (')[0],
      action: newKey ? 'CORRECT_JIRA_KEY' : 'UNLINK_JIRA_KEY',
      details: newKey
        ? `Corrected Jira issue key from [${previousKey || 'NULL'}] to [${newKey}]`
        : `Unlinked Jira issue key [${previousKey || 'NULL'}]`,
    };

    const updatedAuditTrail = [...auditLog, auditEntry];
    setAuditLog(updatedAuditTrail);
    setJiraKey(newKey || '');
    
    if (newKey) {
      setJiraStatus('To Do');
      setLastSynced(new Date().toISOString());
    } else {
      setJiraStatus(null);
      setLastSynced(null);
    }

    // Submit right away
    if (kpi.feedbackAction) {
      const updatedFeedback: KpiFeedbackAction = {
        ...kpi.feedbackAction,
        linkedJiraIssueKey: newKey,
        jiraStatusSnapshot: newKey ? 'To Do' : null,
        jiraStatusLastSyncedAt: newKey ? new Date().toISOString() : null,
        auditTrail: updatedAuditTrail,
      };
      
      let verificationUpdate: any = {};
      if (!newKey) {
        verificationUpdate = { verificationResult: undefined };
      }

      onSubmitFeedback(kpi.id, updatedFeedback, verificationUpdate);
      alert('Administrative override saved and audited!');
    }
    
    setIsAdminOverride(false);
  };

  // Get historical measurements for the table
  const historyRows = MOCK_HISTORY[kpi.id] || [];

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="mono" style={{ fontSize: '1rem', fontWeight: 700 }}>
                {kpi.value} <span style={{ color: 'var(--muted)', fontSize: '0.74rem' }}>vs {kpi.target}</span>
              </span>
              <span className={`rag-dot rag-dot--${kpi.ragStatus}`}></span>
            </div>
          </div>

          {/* Access Banner */}
          {isReadOnly && (
            <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', padding: '0.6rem 0.85rem', borderRadius: 'var(--r-sm)', fontSize: '0.78rem' }}>
              ℹ️ <strong>Read-only View:</strong> {isHR ? 'HR role has read-only auditor access' : 'You are not the assignee or manager for this KPI'}.
            </div>
          )}

          {/* Root Cause Logging Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div className="field">
              <label htmlFor="root-cause-textarea">
                Root Cause Explanation <span className="req">*</span>
              </label>
              <textarea
                id="root-cause-textarea"
                className={`textarea ${error && !rootCause.trim() ? 'invalid' : ''}`}
                placeholder="Describe why this KPI target was missed (required)..."
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                disabled={isReadOnly}
              />
              <span className="hint">Describe exact technical or operational failure points.</span>
            </div>

            <div className="field">
              <label htmlFor="jira-key-input">Linked CarIT Issue Key (Optional)</label>
              <input
                id="jira-key-input"
                type="text"
                className={`input input--mono ${error && jiraKey && !validateJiraKey(jiraKey) ? 'invalid' : ''}`}
                placeholder="e.g. CARIT-12345"
                value={jiraKey}
                onChange={(e) => setJiraKey(e.target.value)}
                disabled={isReadOnly || (!!kpi.feedbackAction?.linkedJiraIssueKey && !isAdminOverride)}
              />
              <span className="hint">Format: CARIT-##### (must be capitalized).</span>
            </div>

            {error && (
              <div className="field-error" style={{ marginTop: '-0.5rem' }}>
                ⚠️ {error}
              </div>
            )}

            {!isReadOnly && (!kpi.feedbackAction || isAdminOverride) && (
              <button type="submit" className="btn btn--primary" style={{ alignSelf: 'flex-start' }}>
                Save Remediation Record
              </button>
            )}
          </form>

          {/* Jira Status Strip (FR-FB-03) */}
          {kpi.feedbackAction && kpi.feedbackAction.linkedJiraIssueKey && (
            <div className="jira-strip">
              <div className="jira-strip__header">
                <span>Linked Jira Issue</span>
                <span className="mono">{kpi.feedbackAction.linkedJiraIssueKey}</span>
              </div>
              <div className="jira-strip__main">
                <div>
                  <span className="jira-strip__sync" style={{ display: 'block', marginBottom: '0.2rem' }}>Status Snapshot:</span>
                  <span className={`jira-strip__badge ${
                    jiraStatus === 'To Do' ? 'jira-strip__badge--todo' :
                    jiraStatus === 'In Progress' ? 'jira-strip__badge--progress' :
                    jiraStatus === 'Done' ? 'jira-strip__badge--done' :
                    'jira-strip__badge--rejected'
                  }`}>
                    {jiraStatus || 'Loading...'}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="jira-strip__sync" style={{ display: 'block' }}>
                    Synced: {lastSynced ? new Date(lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                  </span>
                  <div className="jira-strip__actions" style={{ marginTop: '0.2rem' }}>
                    {!isHR && (
                      <button
                        className="jira-strip__btn-sync"
                        onClick={handleJiraRefresh}
                        disabled={isRefreshing}
                      >
                        {isRefreshing ? 'Syncing...' : '🔄 Refresh'}
                      </button>
                    )}
                    <a
                      href={`https://jira.vitec.internal/browse/${kpi.feedbackAction.linkedJiraIssueKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="jira-strip__link"
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`Opening Jira ticket ${kpi.feedbackAction?.linkedJiraIssueKey} in deep link simulated view...`);
                      }}
                    >
                      View in Jira ↗
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Admin Unlink / Correct Panel (FR-FB-09) */}
          {isAdmin && kpi.feedbackAction && (
            <div className="admin-audit-section">
              <div className="admin-audit-section__title">🛡️ Admin Controls (FR-FB-09)</div>
              
              {!isAdminOverride ? (
                <button
                  type="button"
                  className="btn btn--danger btn--ghost"
                  style={{ alignSelf: 'flex-start', padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                  onClick={() => {
                    setIsAdminOverride(true);
                    setAdminJiraKey(jiraKey);
                  }}
                >
                  Correct / Unlink Jira Key
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.4rem' }}>
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
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn--primary"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                      onClick={handleAdminOverrideSubmit}
                    >
                      Apply Override
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                      onClick={() => setIsAdminOverride(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Audit trail log */}
              {auditLog.length > 0 && (
                <div style={{ marginTop: '0.4rem' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '0.2rem' }}>
                    Audit Trail:
                  </span>
                  <div className="admin-audit-log">
                    {auditLog.map((log, idx) => (
                      <div key={idx} style={{ marginBottom: '0.2rem', borderBottom: idx < auditLog.length - 1 ? '1px solid var(--rule)' : '0', paddingBottom: '0.15rem' }}>
                        [{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] {log.adminName}: {log.details}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Past Measurements Section & Verification outcome marker (FR-FB-04) */}
          <div className="past-measurements-section">
            <h4>Measurement History & Verification (FR-FB-04)</h4>
            {historyRows.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic' }}>No historical measurements recorded for this KPI.</p>
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
                    {/* Render a current verification result row to display verification marker */}
                    {kpi.verificationResult && kpi.feedbackAction && (
                      <tr style={{ background: 'var(--primary-bg)' }}>
                        <td className="cell-strong">{kpi.period}</td>
                        <td className="mono">{kpi.value}</td>
                        <td><span className={`rag-dot rag-dot--${kpi.ragStatus}`}></span></td>
                        <td>
                          {kpi.verificationResult === 'improved' && (
                            <span className="verification-marker verification-marker--improved">
                              ✅ Improved after {kpi.verifiedAfterIssueKey || 'CARIT-20456'}
                            </span>
                          )}
                          {kpi.verificationResult === 'not_improved' && (
                            <span className="verification-marker verification-marker--not-improved">
                              ⚠️ Not improved after {kpi.verifiedAfterIssueKey || 'CARIT-40212'}
                            </span>
                          )}
                          {kpi.verificationResult === 'not_verifiable' && (
                            <span className="verification-marker verification-marker--closed-unfixed">
                              🛑 Closed unfixed after {kpi.verifiedAfterIssueKey || 'CARIT-50882'}
                            </span>
                          )}
                          {kpi.verificationResult === 'pending' && (
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
                            row.verificationResult === 'improved' ? (
                              <span className="verification-marker verification-marker--improved">
                                ✅ Improved after {row.verifiedAfterIssueKey || 'CARIT-20456'}
                              </span>
                            ) : (
                              <span className="verification-marker verification-marker--not-improved">
                                ⚠️ Not improved after {row.verifiedAfterIssueKey}
                              </span>
                            )
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: '0.74rem' }}>
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
