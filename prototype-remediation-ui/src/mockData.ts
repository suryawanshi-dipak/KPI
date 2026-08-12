import type { Employee, KpiMeasurement, BadgeState } from './types';

export const SIMULATED_USERS: Employee[] = [
  { id: 'emp-sarah', name: 'Sarah Jenkins (Manager)', role: 'ROLE_MANAGER' },
  { id: 'emp-david', name: 'David Miller (Admin)', role: 'ROLE_ADMIN' },
  { id: 'emp-john', name: 'John Doe (Developer)', role: 'ROLE_EMPLOYEE' },
  { id: 'emp-alice', name: 'Alice Smith (DBA)', role: 'ROLE_EMPLOYEE' },
  { id: 'emp-bob', name: 'Bob Johnson (API Dev)', role: 'ROLE_EMPLOYEE' },
  { id: 'emp-charlie', name: 'Charlie Brown (FE Dev)', role: 'ROLE_EMPLOYEE' },
  { id: 'emp-emma', name: 'Emma Watson (HR)', role: 'ROLE_HR' },
];

export const INITIAL_KPIS: KpiMeasurement[] = [
  // 1. Feedback needed (Red, no feedback logged)
  {
    id: 'kpi-server-uptime',
    kpiName: 'Server Uptime SLA',
    employeeName: 'John Doe',
    employeeId: 'emp-john',
    value: '98.20%',
    target: '99.90%',
    unit: '%',
    ragStatus: 'critical',
    period: 'July 2026',
    kraArea: 'Infrastructure',
  },
  // 2. Root cause logged — no fix tracked (Amber, feedback logged, Jira is NULL)
  {
    id: 'kpi-db-latency',
    kpiName: 'Database Query Latency',
    employeeName: 'Alice Smith',
    employeeId: 'emp-alice',
    value: '350ms',
    target: '200ms',
    unit: 'ms',
    ragStatus: 'amber',
    period: 'July 2026',
    kraArea: 'Database Performance',
    feedbackAction: {
      id: 'fb-db-latency',
      kpiMeasurementId: 'kpi-db-latency',
      rootCause: 'High read/write contention on transaction tables due to missing composite indexes. Running manual vacuums weekly, but requires structural optimization.',
      linkedJiraIssueKey: null,
      jiraStatusSnapshot: null,
      jiraStatusLastSyncedAt: null,
      submittedBy: 'Alice Smith',
      submittedRole: 'ROLE_EMPLOYEE',
    },
  },
  // 3. In progress — CARIT-30456 (Red, Jira ticket not terminal)
  {
    id: 'kpi-api-response',
    kpiName: 'API Response Time (P95)',
    employeeName: 'Bob Johnson',
    employeeId: 'emp-bob',
    value: '820ms',
    target: '400ms',
    unit: 'ms',
    ragStatus: 'red',
    period: 'July 2026',
    kraArea: 'Backend API',
    feedbackAction: {
      id: 'fb-api-response',
      kpiMeasurementId: 'kpi-api-response',
      rootCause: 'Redis caching layer memory exhaustion is causing all calls to fallback to the relational database under peak loads.',
      linkedJiraIssueKey: 'CARIT-30456',
      jiraStatusSnapshot: 'In Progress',
      jiraStatusLastSyncedAt: '2026-08-12T18:10:00Z',
      submittedBy: 'Bob Johnson',
      submittedRole: 'ROLE_EMPLOYEE',
    },
  },
  // 4. Resolved in Jira — awaiting verification (Amber, Jira status Done, verification pending)
  {
    id: 'kpi-bug-resolution',
    kpiName: 'Bug Resolution Rate',
    employeeName: 'John Doe',
    employeeId: 'emp-john',
    value: '64.0%',
    target: '85.0%',
    unit: '%',
    ragStatus: 'amber',
    period: 'July 2026',
    kraArea: 'Quality Assurance',
    feedbackAction: {
      id: 'fb-bug-resolution',
      kpiMeasurementId: 'kpi-bug-resolution',
      rootCause: 'Critical shortage of QA testing environments delayed approvals for resolved issues.',
      linkedJiraIssueKey: 'CARIT-10992',
      jiraStatusSnapshot: 'Done',
      jiraStatusLastSyncedAt: '2026-08-12T17:30:00Z',
      submittedBy: 'Sarah Jenkins',
      submittedRole: 'ROLE_MANAGER',
    },
    verificationResult: 'pending',
  },
  // 5. Improved (Green, verification result: improved)
  {
    id: 'kpi-fe-build',
    kpiName: 'Frontend Build Duration',
    employeeName: 'Charlie Brown',
    employeeId: 'emp-charlie',
    value: '3.2m',
    target: '5.0m',
    unit: 'm',
    ragStatus: 'green',
    period: 'July 2026',
    kraArea: 'Development Ops',
    feedbackAction: {
      id: 'fb-fe-build',
      kpiMeasurementId: 'kpi-fe-build',
      rootCause: 'Large bundle sizes caused by missing asset-splitting and excessive source maps in production settings.',
      linkedJiraIssueKey: 'CARIT-20456',
      jiraStatusSnapshot: 'Done',
      jiraStatusLastSyncedAt: '2026-07-28T09:15:00Z',
      submittedBy: 'Charlie Brown',
      submittedRole: 'ROLE_EMPLOYEE',
    },
    verificationResult: 'improved',
    verifiedAfterIssueKey: 'CARIT-20456',
  },
  // 6. Not improved — re-escalate (Red, verification result: not_improved)
  {
    id: 'kpi-support-sla',
    kpiName: 'Customer Support SLA',
    employeeName: 'Alice Smith',
    employeeId: 'emp-alice',
    value: '71.5%',
    target: '90.0%',
    unit: '%',
    ragStatus: 'red',
    period: 'July 2026',
    kraArea: 'Customer Success',
    feedbackAction: {
      id: 'fb-support-sla',
      kpiMeasurementId: 'kpi-support-sla',
      rootCause: 'Sudden ticket surge following the API version deprecation, coupled with understaffing in the European shift.',
      linkedJiraIssueKey: 'CARIT-40212',
      jiraStatusSnapshot: 'Done',
      jiraStatusLastSyncedAt: '2026-08-10T14:22:00Z',
      submittedBy: 'Sarah Jenkins',
      submittedRole: 'ROLE_MANAGER',
    },
    verificationResult: 'not_improved',
    verifiedAfterIssueKey: 'CARIT-40212',
  },
  // 7. Closed unfixed — re-escalate (Red, verification result: not_verifiable, Jira status Rejected)
  {
    id: 'kpi-app-crash',
    kpiName: 'Mobile App Crash Rate',
    employeeName: 'Charlie Brown',
    employeeId: 'emp-charlie',
    value: '2.80%',
    target: '1.00%',
    unit: '%',
    ragStatus: 'red',
    period: 'July 2026',
    kraArea: 'Mobile Quality',
    feedbackAction: {
      id: 'fb-app-crash',
      kpiMeasurementId: 'kpi-app-crash',
      rootCause: 'Intermittent crash caused by thread deadlock in native audio wrapper.',
      linkedJiraIssueKey: 'CARIT-50882',
      jiraStatusSnapshot: 'Rejected',
      jiraStatusLastSyncedAt: '2026-08-11T12:00:00Z',
      submittedBy: 'Charlie Brown',
      submittedRole: 'ROLE_EMPLOYEE',
    },
    verificationResult: 'not_verifiable',
    verifiedAfterIssueKey: 'CARIT-50882',
  },
  // Normal Green KPIs (No feedback)
  {
    id: 'kpi-code-coverage',
    kpiName: 'Code Test Coverage',
    employeeName: 'Bob Johnson',
    employeeId: 'emp-bob',
    value: '88.5%',
    target: '80.0%',
    unit: '%',
    ragStatus: 'green',
    period: 'July 2026',
    kraArea: 'Development Ops',
  },
  {
    id: 'kpi-security-audit',
    kpiName: 'Security Vulnerabilities Resolved',
    employeeName: 'John Doe',
    employeeId: 'emp-john',
    value: '15',
    target: '10',
    unit: '',
    ragStatus: 'green',
    period: 'July 2026',
    kraArea: 'Security',
  },
];

// Historical measurement log for drill-down tables
export const MOCK_HISTORY: Record<string, Omit<KpiMeasurement, 'feedbackAction'>[]> = {
  'kpi-server-uptime': [
    { id: 'h-server-1', kpiName: 'Server Uptime SLA', employeeName: 'John Doe', employeeId: 'emp-john', value: '99.95%', target: '99.90%', unit: '%', ragStatus: 'green', period: 'June 2026', kraArea: 'Infrastructure' },
    { id: 'h-server-2', kpiName: 'Server Uptime SLA', employeeName: 'John Doe', employeeId: 'emp-john', value: '99.92%', target: '99.90%', unit: '%', ragStatus: 'green', period: 'May 2026', kraArea: 'Infrastructure' },
  ],
  'kpi-db-latency': [
    { id: 'h-db-1', kpiName: 'Database Query Latency', employeeName: 'Alice Smith', employeeId: 'emp-alice', value: '180ms', target: '200ms', unit: 'ms', ragStatus: 'green', period: 'June 2026', kraArea: 'Database Performance' },
    { id: 'h-db-2', kpiName: 'Database Query Latency', employeeName: 'Alice Smith', employeeId: 'emp-alice', value: '310ms', target: '200ms', unit: 'ms', ragStatus: 'amber', period: 'May 2026', kraArea: 'Database Performance' },
  ],
  'kpi-api-response': [
    { id: 'h-api-1', kpiName: 'API Response Time (P95)', employeeName: 'Bob Johnson', employeeId: 'emp-bob', value: '390ms', target: '400ms', unit: 'ms', ragStatus: 'green', period: 'June 2026', kraArea: 'Backend API' },
    { id: 'h-api-2', kpiName: 'API Response Time (P95)', employeeName: 'Bob Johnson', employeeId: 'emp-bob', value: '620ms', target: '400ms', unit: 'ms', ragStatus: 'red', period: 'May 2026', kraArea: 'Backend API' },
  ],
  'kpi-bug-resolution': [
    { id: 'h-bug-1', kpiName: 'Bug Resolution Rate', employeeName: 'John Doe', employeeId: 'emp-john', value: '86.0%', target: '85.0%', unit: '%', ragStatus: 'green', period: 'June 2026', kraArea: 'Quality Assurance' },
    { id: 'h-bug-2', kpiName: 'Bug Resolution Rate', employeeName: 'John Doe', employeeId: 'emp-john', value: '72.0%', target: '85.0%', unit: '%', ragStatus: 'amber', period: 'May 2026', kraArea: 'Quality Assurance' },
  ],
  'kpi-fe-build': [
    { id: 'h-fe-1', kpiName: 'Frontend Build Duration', employeeName: 'Charlie Brown', employeeId: 'emp-charlie', value: '6.1m', target: '5.0m', unit: 'm', ragStatus: 'red', period: 'June 2026', kraArea: 'Development Ops', verificationResult: 'pending' },
    { id: 'h-fe-2', kpiName: 'Frontend Build Duration', employeeName: 'Charlie Brown', employeeId: 'emp-charlie', value: '5.8m', target: '5.0m', unit: 'm', ragStatus: 'amber', period: 'May 2026', kraArea: 'Development Ops' },
  ],
  'kpi-support-sla': [
    { id: 'h-support-1', kpiName: 'Customer Support SLA', employeeName: 'Alice Smith', employeeId: 'emp-alice', value: '75.2%', target: '90.0%', unit: '%', ragStatus: 'red', period: 'June 2026', kraArea: 'Customer Success', verificationResult: 'pending' },
    { id: 'h-support-2', kpiName: 'Customer Support SLA', employeeName: 'Alice Smith', employeeId: 'emp-alice', value: '92.1%', target: '90.0%', unit: '%', ragStatus: 'green', period: 'May 2026', kraArea: 'Customer Success' },
  ],
  'kpi-app-crash': [
    { id: 'h-crash-1', kpiName: 'Mobile App Crash Rate', employeeName: 'Charlie Brown', employeeId: 'emp-charlie', value: '2.50%', target: '1.00%', unit: '%', ragStatus: 'red', period: 'June 2026', kraArea: 'Mobile Quality', verificationResult: 'pending' },
    { id: 'h-crash-2', kpiName: 'Mobile App Crash Rate', employeeName: 'Charlie Brown', employeeId: 'emp-charlie', value: '0.90%', target: '1.00%', unit: '%', ragStatus: 'green', period: 'May 2026', kraArea: 'Mobile Quality' },
  ],
};

export function getBadgeState(kpi: KpiMeasurement): BadgeState | null {
  // Green measurements carry no badge unless they are verified 'Improved'
  if (kpi.ragStatus === 'green') {
    if (kpi.verificationResult === 'improved') {
      return 'Improved';
    }
    return null;
  }

  // Handle explicit verification results on non-green KPIs
  if (kpi.verificationResult === 'improved') {
    return 'Improved';
  } else if (kpi.verificationResult === 'not_improved') {
    return 'Not improved — re-escalate';
  } else if (kpi.verificationResult === 'not_verifiable') {
    return 'Closed unfixed — re-escalate';
  }

  const fb = kpi.feedbackAction;
  if (!fb) {
    return 'Feedback needed';
  }

  if (!fb.linkedJiraIssueKey) {
    return 'Root cause logged — no fix tracked';
  }

  if (fb.jiraStatusSnapshot === 'Done') {
    return 'Resolved in Jira — awaiting verification';
  }

  return `In progress — ${fb.linkedJiraIssueKey}` as BadgeState;
}

export function getBadgeStyleClass(badgeState: BadgeState | null): string {
  if (!badgeState) return '';
  
  if (badgeState === 'Feedback needed') return 'rem-badge--feedback-needed';
  if (badgeState === 'Root cause logged — no fix tracked') return 'rem-badge--no-fix-tracked';
  if (badgeState.startsWith('In progress')) return 'rem-badge--in-progress';
  if (badgeState === 'Resolved in Jira — awaiting verification') return 'rem-badge--resolved-jira';
  if (badgeState === 'Improved') return 'rem-badge--improved';
  if (badgeState === 'Not improved — re-escalate') return 'rem-badge--not-improved';
  if (badgeState === 'Closed unfixed — re-escalate') return 'rem-badge--closed-unfixed';
  
  return '';
}
