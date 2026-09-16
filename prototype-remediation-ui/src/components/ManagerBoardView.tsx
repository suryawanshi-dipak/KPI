import { useState } from 'react';
import type { KpiMeasurement } from '../types';
import { getBadgeState, getBadgeStyleClass } from '../mockData';

interface ManagerBoardViewProps {
  kpis: KpiMeasurement[];
  onKpiClick: (kpi: KpiMeasurement) => void;
}

type FilterType = 'all' | 'reescalate';

export default function ManagerBoardView({ kpis, onKpiClick }: ManagerBoardViewProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  // Filter 1: Must be non-green (RAG status !== 'green')
  const nonGreenKpis = kpis.filter((k) => k.ragStatus !== 'green');

  // Filter 2: Apply segmented filter
  const filteredKpis = nonGreenKpis.filter((kpi) => {
    if (filter === 'all') return true;
    
    const badge = getBadgeState(kpi);
    return (
      badge === 'Not improved — re-escalate' ||
      badge === 'Closed unfixed — re-escalate'
    );
  });

  // Group KPIs by Employee Name
  const employeeGroups = filteredKpis.reduce<Record<string, KpiMeasurement[]>>((groups, kpi) => {
    const empName = kpi.employeeName;
    if (!groups[empName]) {
      groups[empName] = [];
    }
    groups[empName].push(kpi);
    return groups;
  }, {});

  const totalFilteredCount = filteredKpis.length;

  return (
    <div className="manager-board-view">
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1>Manager Overview: Remediation Board</h1>
          <p>Track progress of team remediation actions, Jira tickets, and verification loops.</p>
        </div>
      </div>

      {/* Filter Bar (Segmented Control) */}
      <div className="filter-bar" style={{ justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--ink-soft)' }}>Filter KPIs:</span>
          <div className="segmented">
            <button
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              All Non-Green ({nonGreenKpis.length})
            </button>
            <button
              className={filter === 'reescalate' ? 'active' : ''}
              onClick={() => setFilter('reescalate')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              ⚠️ Re-escalate Only ({
                nonGreenKpis.filter(k => {
                  const b = getBadgeState(k);
                  return b === 'Not improved — re-escalate' || b === 'Closed unfixed — re-escalate';
                }).length
              })
            </button>
          </div>
        </div>
        <div className="cell-sub">
          Showing <strong>{totalFilteredCount}</strong> KPIs requiring manager attention
        </div>
      </div>

      {/* Remediation Board grouped by Employee */}
      {totalFilteredCount === 0 ? (
        <div className="empty-board-message">
          <h3>No KPIs Found</h3>
          <p>
            {filter === 'reescalate'
              ? 'No KPIs are currently flagged as "Not Improved" or "Closed Unfixed" awaiting re-escalation.'
              : 'All team KPIs are green! No remediation feedback actions required.'}
          </p>
        </div>
      ) : (
        <div className="manager-board">
          {Object.entries(employeeGroups).map(([employeeName, employeeKpis]) => (
            <div key={employeeName} className="employee-row-card">
              
              <div className="employee-row-card__head">
                <span className="employee-row-card__name">
                  👤 {employeeName}
                </span>
                <span className="employee-row-card__count">
                  {employeeKpis.length} active {employeeKpis.length === 1 ? 'KPI' : 'KPIs'}
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
                      onClick={() => onKpiClick(kpi)}
                      title={`Click to view remediation for ${kpi.kpiName}`}
                      style={{ minHeight: '124px' }}
                    >
                      <div className="kpi-tile__top">
                        <div className="kpi-tile__meta">
                          <div className="kpi-tile__name" style={{ fontSize: '0.9rem' }}>{kpi.kpiName}</div>
                          <div className="cell-sub" style={{ fontSize: '0.74rem' }}>Area: {kpi.kraArea}</div>
                        </div>
                        <span className={`rag-dot rag-dot--${kpi.ragStatus}`}></span>
                      </div>

                      <div className="kpi-tile__foot">
                        <div className="kpi-tile__value-container">
                          <span className="kpi-tile__value" style={{ fontSize: '1.2rem' }}>{kpi.value}</span>
                          <span className="kpi-tile__target" style={{ fontSize: '0.7rem' }}>/ {kpi.target}</span>
                        </div>
                        
                        {badge && (
                          <span className={`remediation-badge ${badgeStyleClass}`} style={{ fontSize: '0.7rem' }}>
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
    </div>
  );
}
