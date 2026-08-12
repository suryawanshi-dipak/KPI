import { useState } from 'react';
import type { KpiMeasurement } from '../types';
import { getBadgeState, getBadgeStyleClass } from '../mockData';

interface DashboardViewProps {
  kpis: KpiMeasurement[];
  onKpiClick: (kpi: KpiMeasurement) => void;
}

export default function DashboardView({ kpis, onKpiClick }: DashboardViewProps) {
  const [alertDismissed, setAlertDismissed] = useState(false);

  // Group KPIs by KRA Area
  const groupedKpis = kpis.reduce<Record<string, KpiMeasurement[]>>((groups, kpi) => {
    const area = kpi.kraArea;
    if (!groups[area]) {
      groups[area] = [];
    }
    groups[area].push(kpi);
    return groups;
  }, {});

  // Calculations for KPI completeness widgets (Section 9.1)
  const totalKpis = kpis.length;
  const measuredKpis = kpis.filter((k) => k.value !== '').length;
  const greenCount = kpis.filter((k) => k.ragStatus === 'green').length;
  const nonGreenCount = totalKpis - greenCount;
  const completenessFraction = totalKpis > 0 ? (measuredKpis / totalKpis) * 100 : 0;

  // Red/Critical Alert list
  const criticalKpis = kpis.filter((k) => k.ragStatus === 'red' || k.ragStatus === 'critical');

  return (
    <div className="dashboard-view">
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1>Team KPI Dashboard</h1>
          <p>Real-time status overview of active operations console metrics.</p>
        </div>
      </div>

      {/* RAG & Completeness Stats Grid */}
      <div className="stat-grid">
        <div className="stat stat--ok">
          <div className="stat__label">GREEN STATUS KPI</div>
          <div className="stat__value">{greenCount}</div>
          <div className="stat__sub">Target met or exceeded</div>
        </div>
        <div className="stat stat--bad">
          <div className="stat__label">NON-GREEN / REMEDIATION</div>
          <div className="stat__value">{nonGreenCount}</div>
          <div className="stat__sub">Requires feedback actions</div>
        </div>
        <div className="stat">
          <div className="stat__label">MEASUREMENT COMPLETENESS</div>
          <div className="stat__value">
            {measuredKpis}/{totalKpis}
          </div>
          <div className="stat__sub">
            <div className="health-bar" style={{ marginTop: '0.4rem' }}>
              <span
                className="h-green"
                style={{ width: `${completenessFraction}%` }}
              ></span>
            </div>
            <span style={{ fontSize: '0.74rem', marginTop: '0.2rem', display: 'inline-block' }}>
              {Math.round(completenessFraction)}% measured for current period
            </span>
          </div>
        </div>
      </div>

      {/* Red/Critical Alert Banner (Section 9.1) */}
      {!alertDismissed && criticalKpis.length > 0 && (
        <div
          className="card"
          style={{
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#7f1d1d',
            borderRadius: 'var(--r)',
            marginBottom: '1.5rem',
            position: 'relative',
          }}
        >
          <div className="card__body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🚨</span>
              <div>
                <strong>Critical Operations Alert:</strong> {criticalKpis.length} KPIs are currently in Critical or Red state. Remediation feedback loops must be logged.
              </div>
            </div>
            <button
              onClick={() => setAlertDismissed(true)}
              className="btn btn--ghost"
              style={{ padding: '0.2rem 0.5rem', color: '#991b1b', fontWeight: 'bold' }}
              title="Dismiss Alert"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* RAG Grid Grouped by KRA Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
        {Object.entries(groupedKpis).map(([kraArea, areaKpis]) => (
          <div key={kraArea} className="kra-section">
            <h3
              style={{
                fontSize: '0.86rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--muted)',
                marginBottom: '0.75rem',
                borderBottom: '1px solid var(--rule)',
                paddingBottom: '0.3rem',
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
                    onClick={() => onKpiClick(kpi)}
                    title={`Click to view remediation details for ${kpi.kpiName}`}
                  >
                    <div className="kpi-tile__top">
                      <div className="kpi-tile__meta">
                        <div className="kpi-tile__name">{kpi.kpiName}</div>
                        <div className="kpi-tile__owner">Owner: {kpi.employeeName}</div>
                      </div>
                      <span
                        className={`rag-dot rag-dot--${kpi.ragStatus}`}
                        title={`RAG: ${kpi.ragStatus.toUpperCase()}`}
                      ></span>
                    </div>

                    <div className="kpi-tile__foot">
                      <div className="kpi-tile__value-container">
                        <span className="kpi-tile__value">{kpi.value}</span>
                        <span className="kpi-tile__target">/ {kpi.target}</span>
                      </div>
                      
                      {/* Badge (Non-green tiles or successfully verified green tiles only) */}
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
    </div>
  );
}
