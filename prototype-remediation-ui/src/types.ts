export type UserRole = 'ROLE_ADMIN' | 'ROLE_MANAGER' | 'ROLE_EMPLOYEE' | 'ROLE_HR';

export type RagStatus = 'green' | 'amber' | 'red' | 'critical';

export type BadgeState =
  | 'Feedback needed'
  | 'Root cause logged — no fix tracked'
  | 'In progress — CARIT-#####'
  | 'Resolved in Jira — awaiting verification'
  | 'Improved'
  | 'Not improved — re-escalate'
  | 'Closed unfixed — re-escalate';

export type VerificationResult = 'improved' | 'not_improved' | 'not_verifiable' | 'pending';

export type JiraStatus = 'To Do' | 'In Progress' | 'Done' | 'Rejected';

export interface AuditEntry {
  timestamp: string;
  adminName: string;
  action: string;
  details: string;
}

export interface KpiFeedbackAction {
  id: string;
  kpiMeasurementId: string;
  rootCause: string;
  linkedJiraIssueKey: string | null; // e.g. "CARIT-12345"
  jiraStatusSnapshot: JiraStatus | null;
  jiraStatusLastSyncedAt: string | null;
  relatedPreviousFeedbackId?: string;
  submittedBy: string;
  submittedRole: UserRole;
  auditTrail?: AuditEntry[];
}

export interface KpiMeasurement {
  id: string;
  kpiName: string;
  employeeName: string;
  employeeId: string;
  value: string;
  target: string;
  unit: string;
  ragStatus: RagStatus;
  period: string; // e.g., "July 2026", "June 2026", "May 2026"
  feedbackAction?: KpiFeedbackAction;
  verificationResult?: VerificationResult;
  verifyingMeasurementId?: string; // ID of the measurement that verified this one
  verifiedAfterIssueKey?: string; // The issue key linked to the verification
  kraArea: string; // e.g. "Infrastructure", "Quality Assurance", "Customer Success", "Database"
}

export interface Employee {
  id: string;
  name: string;
  role: UserRole;
}
