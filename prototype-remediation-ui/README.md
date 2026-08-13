# KPI Remediation Feedback Loop — UI Prototype

Frontend-only visual prototype for **Section 3.7 / 3.7.1 / 9** of the KPI Monitoring System BRD (V3). No backend, migrations, or real API calls — all data and interactions are mocked in local React state.

## Stack

- React 19 + TypeScript + Vite
- Plain CSS matching the main KPI Monitor design system (`frontend/src/index.css`)

## Quick start

```bash
cd prototype-remediation-ui
npm install
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

## What's included

### 1. Team Dashboard — KPI tiles (Section 9.1)

- RAG color dot, KPI name, employee name, value vs target
- Remediation badges on non-green tiles (and **Improved** on verified green)
- Grouped by KRA area with summary stat cards
- Click any tile to open the remediation panel

### 2. Link Remediation panel (Section 9.2)

Slide-out drawer with:

- Mandatory root-cause textarea + optional `CARIT-#####` issue key (format validated)
- Submit / Edit / Delete feedback (role-aware permissions)
- Jira status strip — cached status, last-synced time, **Refresh** (cycles fake statuses), **View in Jira**
- Measurement history table with verification markers (e.g. *Improved after CARIT-20456*)
- Re-escalation flow for *Not improved* / *Closed unfixed* states
- Admin override panel with audit trail (switch role to David Miller / Admin)

### 3. Manager Overview — Remediation board (Section 9.3)

- Non-green KPIs grouped by employee
- Filter: **All Non-Green** vs **Re-escalate Only** (*Not improved* / *Closed unfixed*)

## Mock data — all 7 badge states

| Badge | Example KPI |
|-------|---------------|
| Feedback needed | Server Uptime SLA |
| Root cause logged — no fix tracked | Database Query Latency |
| In progress — CARIT-30456 | API Response Time (P95) |
| Resolved in Jira — awaiting verification | Bug Resolution Rate |
| Improved | Frontend Build Duration |
| Not improved — re-escalate | Customer Support SLA |
| Closed unfixed — re-escalate | Mobile App Crash Rate |

## Role switcher

Use the **Simulated Role** dropdown in the top bar to test:

- **Manager** — full edit access on team KPIs
- **Admin** — admin Jira key override + audit trail
- **Employee** — edit own KPIs only
- **HR** — read-only view

## Build

```bash
npm run build
npm run preview
```

## Isolation

This folder is self-contained. It does not modify the Spring Boot backend or the main `frontend/` app.
