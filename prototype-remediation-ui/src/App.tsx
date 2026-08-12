import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import DashboardView from './components/DashboardView';
import ManagerBoardView from './components/ManagerBoardView';
import RemediationPanel from './components/RemediationPanel';
import type { KpiMeasurement, Employee, KpiFeedbackAction } from './types';
import { INITIAL_KPIS, SIMULATED_USERS } from './mockData';

export default function App() {
  // Navigation & Simulated Login State
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'manager'>('dashboard');
  const [activeUser, setActiveUser] = useState<Employee>(SIMULATED_USERS[0]); // Default to Manager (Sarah Jenkins)
  
  // KPI List State (frontend-only local store)
  const [kpis, setKpis] = useState<KpiMeasurement[]>(INITIAL_KPIS);
  
  // Slide-out Drawer selection
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null);

  // Find the currently selected KPI in state
  const selectedKpi = kpis.find((k) => k.id === selectedKpiId) || null;

  // Handler to save or update feedback records in local state
  const handleSubmitFeedback = (
    kpiId: string,
    feedback: KpiFeedbackAction,
    verificationUpdate?: Partial<KpiMeasurement>
  ) => {
    setKpis((prevKpis) =>
      prevKpis.map((kpi) => {
        if (kpi.id === kpiId) {
          // If the feedback has a linked Jira key and the verification outcome is empty,
          // check if it's the specific terminal cases to stamp the outcome.
          let nextVerification = kpi.verificationResult;
          if (verificationUpdate && 'verificationResult' in verificationUpdate) {
            nextVerification = verificationUpdate.verificationResult;
          }

          return {
            ...kpi,
            feedbackAction: feedback,
            verificationResult: nextVerification,
            // If the verification outcome is updated (e.g. improved/not improved), 
            // stamp the issue key for visual markers as well.
            verifiedAfterIssueKey: feedback.linkedJiraIssueKey || undefined,
            // If the verification changes to 'improved', make RAG green. If 'not_improved' or 'not_verifiable', keep red.
            ragStatus:
              nextVerification === 'improved'
                ? 'green'
                : kpi.id === 'kpi-fe-build' && nextVerification === undefined
                ? 'red' // toggle back if reset
                : kpi.ragStatus,
          };
        }
        return kpi;
      })
    );
  };

  const handleKpiClick = (kpi: KpiMeasurement) => {
    setSelectedKpiId(kpi.id);
  };

  return (
    <div className="app-container">
      {/* 1. Sidebar Navigation */}
      <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* 2. Main content container */}
      <div className="main-content">
        
        {/* 2a. Top Header Bar */}
        <Topbar
          currentTab={currentTab}
          activeUser={activeUser}
          onUserChange={setActiveUser}
        />

        {/* 2b. Dashboard Page or Manager Board Page */}
        <main className="content-body">
          {currentTab === 'dashboard' ? (
            <DashboardView kpis={kpis} onKpiClick={handleKpiClick} />
          ) : (
            <ManagerBoardView kpis={kpis} onKpiClick={handleKpiClick} />
          )}
        </main>

        {/* 3. Link Remediation Slide-out Panel */}
        {selectedKpi && (
          <RemediationPanel
            kpi={selectedKpi}
            activeUser={activeUser}
            onClose={() => setSelectedKpiId(null)}
            onSubmitFeedback={handleSubmitFeedback}
          />
        )}

      </div>
    </div>
  );
}
