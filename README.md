# KPI Monitoring System

A centralised web application for tracking KPI and KRA performance across the Product Development & Maintenance team. Replaces fragmented spreadsheets, Jira filters, and manual notes with a single source of truth.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Modules](#modules)
- [Data Model](#data-model)
- [Status Computation Logic](#status-computation-logic)
- [API Endpoints](#api-endpoints)
- [Roles & Permissions](#roles--permissions)
- [Dashboard Features](#dashboard-features)
- [Roadmap](#roadmap)
- [Development Effort](#development-effort)
- [Risks](#risks)

---

## Overview

**Business Problem:** KPI data is scattered across Jira, SharePoint, Zendesk, and personal notes. 7 of 18 KPIs have "unknown" status. Critical issues (e.g. 26 production defects vs a target of <3/quarter) go without automated alerting. The team spends ~2 days per month just gathering data.

**Solution:** A guided, role-based web app that:
- Pre-fills measurement forms with source references and instructions (no more "Ask Peter/Ask Dipesh")
- Auto-computes RAG status (Green / Amber / Red / Critical) from defined thresholds
- Shows all 18 KPIs on a single dashboard
- Builds a time-series trend history for evidence-based performance reviews

**Success Target:** Reduce monthly KPI collection time from ~2 days to under 2 hours.

---

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React 18 + TypeScript + Recharts  |
| API         | Spring Boot 3.x (Java 17)         |
| Database    | MySQL 8.x                         |
| Auth        | Spring Security + JWT             |
| Deployment  | Docker Compose (MVP) → Kubernetes |

---

## Getting Started

### Prerequisites

- Java 17+
- Node.js 18+
- Docker & Docker Compose
- MySQL 8.x (or use the provided Docker Compose service)

### Local Setup

```bash
# Clone the repository
git clone <repo-url>
cd kpi-monitoring-system

# Start all services (API + DB + Frontend)
docker-compose up --build

# Seed the database with 18 KPIs, 4 KRA areas, and 6 employees
./scripts/seed.sh
```

The app will be available at `http://localhost:3000`.  
API runs at `http://localhost:8080`.

### Default Accounts (Seed Data)

| Name         | Role         | Email                        |
|--------------|--------------|------------------------------|
| Admin User   | ROLE_ADMIN   | admin@company.com            |
| Atul Jadhav  | ROLE_MANAGER | atul.jadhav@company.com      |
| Nikhil More  | ROLE_TEAM_MEMBER | nikhil.more@company.com  |
| Dipesh       | ROLE_TEAM_MEMBER | dipesh@company.com       |
| Peter        | ROLE_TEAM_MEMBER | peter@company.com        |

Default password for all seed accounts: `Change@123` (force-change on first login).

---

## Project Structure

```
kpi-monitoring-system/
├── backend/                        # Spring Boot application
│   └── src/main/java/com/company/kpi/
│       ├── auth/                   # JWT auth, login endpoints
│       ├── config/                 # KPI & KRA CRUD APIs
│       ├── measurement/            # Measurement entry & history
│       ├── engine/                 # StatusComputationService
│       ├── employee/               # Employee & team management
│       ├── review/                 # Quarterly/annual review
│       ├── dashboard/              # Aggregated dashboard APIs
│       └── notification/           # Period-end reminders & alerts
├── frontend/                       # React + TypeScript app
│   └── src/
│       ├── pages/
│       │   ├── Dashboard/          # Team RAG grid
│       │   ├── KpiDetail/          # Trend chart + measurement log
│       │   ├── MeasurementEntry/   # Guided entry form
│       │   ├── Admin/              # KPI config (Admin only)
│       │   └── Review/             # Quarterly review (Manager)
│       └── components/
├── scripts/
│   ├── seed.sql                    # 18 KPIs + 4 KRA areas seed data
│   └── seed.sh
└── docker-compose.yml
```

---

## Modules

### 1. KPI Measurement Entry *(Core — MVP)*
- Guided form per KPI, pre-filled with source reference, instructions, last value, and target
- Fields: `measured_value`, `period`, `measurement_note`, `raw_payload`, `post_action`
- Auto-computes status on save — no manual RAG colouring
- Supports marking as "Data Pending" with a reason (replaces blank cells)
- Period locked after save; Admin can unlock with audit trail

### 2. KPI Definition & Configuration
- CRUD for all KPI metrics: name, thresholds, direction, unit, frequency, source system
- Links KPIs to KRA areas and assigns responsible employees
- Supports target version history (old measurements remain valid against their original target)

### 3. KRA Area Management
- Four KRA areas: Quality Engineering & Reliability, Production Stability & Support, Delivery Predictability, Team Management & Process Discipline
- Completion percentage per area for review readiness

### 4. Dashboard & Analytics
- **Team RAG Grid:** all KPIs × current status, grouped by KRA area
- **Trend Chart:** 12-period line chart with target line and warn/critical bands (Recharts)
- **Completeness Indicator:** `14/18 KPIs measured this period`
- **RED/CRITICAL Alert Banner:** shown on login when any KPI breaches threshold

### 5. Employee & Team Management
- Employee master with role and team assignment
- Role-based access: Admin / Manager / Team Member
- Annual KRA assignment per employee

### 6. Performance Review *(Phase 2)*
- Quarterly review form: aggregated KPI results + qualitative commentary per KRA area
- Annual review summary with KPI achievement % per area
- Sign-off workflow: submit → manager review → approve/send back

---

## Data Model

### Core Entities

```
kra_area          → kpi_metric → kpi_employee_assignment → employee
                       ↓
                  kpi_measurement
                       ↓
                  performance_review
```

### Key Table: `kpi_measurement`

| Column                  | Type                          | Notes                                      |
|-------------------------|-------------------------------|--------------------------------------------|
| `id`                    | BIGINT PK                     |                                            |
| `kpi_metric_id`         | INT FK                        | Indexed with `period_start_date`           |
| `measured_value`        | DECIMAL(12,4) NULL            | Null = pending                             |
| `measurement_period_type` | ENUM                        | weekly / bi-weekly / monthly / quarterly   |
| `measurement_period_label` | VARCHAR(50)                | e.g. `Apr-2026`, `Q1-FY2026`              |
| `status`                | ENUM                          | green / amber / red / critical / unknown   |
| `measurement_note`      | TEXT                          | Structured notes (replaces freeform column)|
| `raw_payload`           | MEDIUMTEXT                    | Jira/Zendesk export paste                  |
| `post_action`           | TEXT                          | Remediation taken                          |
| `measured_by`           | INT FK → employee             |                                            |
| `is_pending`            | BOOLEAN                       | Explicit "data not available" flag         |
| `is_corrected`          | BOOLEAN                       | True if this replaces a prior entry        |
| `corrected_from_id`     | BIGINT FK → kpi_measurement   | Self-referencing for correction chain      |

All tables include `is_deleted`, `created_at`, `updated_at`, `created_by`, `updated_by` for soft-delete and full audit trail.

---

## Status Computation Logic

Handled by `StatusComputationService` — computed server-side before persisting, never set manually by users.

| Direction      | Green                          | Amber                                          | Red                                              | Critical                    |
|----------------|-------------------------------|------------------------------------------------|--------------------------------------------------|-----------------------------|
| `lower_better` | value ≤ target                | target < value ≤ warn_threshold                | warn_threshold < value ≤ critical_threshold       | value > critical_threshold  |
| `higher_better`| value ≥ target                | warn_threshold ≤ value < target                | critical_threshold ≤ value < warn_threshold       | value < critical_threshold  |
| `target`       | \|value − target\| = 0        | \|value − target\| ≤ 1                         | \|value − target\| ≤ 3                            | \|value − target\| > 3      |

> When `warn_threshold` and `critical_threshold` are null, only Green and Red statuses are computed.

---

## API Endpoints

| Method | Endpoint                          | Role Required  | Description                         |
|--------|-----------------------------------|----------------|-------------------------------------|
| POST   | `/api/auth/login`                 | Public         | Get JWT token                       |
| GET    | `/api/dashboard`                  | Any            | Team RAG status grid                |
| GET    | `/api/kpi-metrics`                | Any            | List all active KPIs                |
| POST   | `/api/kpi-metrics`                | Admin          | Create KPI definition               |
| PUT    | `/api/kpi-metrics/{id}`           | Admin          | Update KPI definition               |
| GET    | `/api/measurements?kpiId=&period=`| Any            | Measurement history for a KPI       |
| POST   | `/api/measurements`               | Team Member+   | Submit a new measurement            |
| GET    | `/api/measurements/trend/{kpiId}` | Any            | Trend data for chart (last N periods)|
| GET    | `/api/employees`                  | Manager+       | List employees                      |
| POST   | `/api/reviews`                    | Manager        | Create quarterly review             |

All endpoints require a valid JWT bearer token. Token expiry: 8 hours. Refresh token expiry: 7 days.

---

## Roles & Permissions

| Action                          | Team Member | Manager | Admin |
|---------------------------------|-------------|---------|-------|
| View team dashboard             | ✅           | ✅       | ✅     |
| Enter own KPI measurements      | ✅           | ✅       | ✅     |
| Enter any team member's measurement |         | ✅       | ✅     |
| View trend charts               | ✅           | ✅       | ✅     |
| Create/edit KPI definitions     |             |         | ✅     |
| Manage employees & roles        |             |         | ✅     |
| Unlock a locked measurement period |          |         | ✅     |
| View quarterly review forms     | ✅ (own)     | ✅       | ✅     |
| Submit quarterly review         |             | ✅       | ✅     |

---

## Dashboard Features

### Team KPI Dashboard
- RAG status grid grouped by KRA area
- Measurement completeness progress bar (`14/18 KPIs measured`)
- Dismissible RED/CRITICAL alert banner
- Last updated timestamp

### KPI Trend Detail Page
- Line chart — last 12 periods, target line, warn/critical threshold bands
- Colour-coded status history timeline
- Measurement log table (value, note, post_action, measured_by, measured_at)

### Manager Overview *(Phase 2)*
- Stacked bar: team member KPI count by status
- List of KPIs pending measurement with responsible employee
- Trend direction indicators (↑ improving / → stable / ↓ worsening)

---

## Roadmap

| Phase   | Timeline   | Theme                      | Key Deliverables                                                   |
|---------|------------|----------------------------|--------------------------------------------------------------------|
| MVP     | Weeks 1–3  | Core measurement loop      | KPI config, guided entry form, RAG dashboard, trend charts, login  |
| Phase 2 | Weeks 4–6  | Review & collaboration     | Notifications, quarterly review, correction workflow, export       |
| Phase 3 | Month 3+   | Automation & scale         | Jira/Zendesk API integration, annual review, attachments, heatmap  |

**Out of scope for Phase 1:** SSO/Azure AD, automated Jira/Zendesk metric pulling, 360-degree feedback, salary linkage.

---

## Development Effort

### MVP (Weeks 1–3) — ~13.5 days

| Feature                                    | Story Points |
|--------------------------------------------|--------------|
| Project setup (Spring Boot, React, Docker) | 3 SP         |
| Employee & Auth module                     | 5 SP         |
| KPI & KRA configuration (Admin CRUD)       | 8 SP         |
| Measurement entry form + status engine     | 13 SP        |
| Team RAG dashboard                         | 8 SP         |
| KPI trend chart (Recharts)                 | 5 SP         |
| Data seeding: 18 KPIs                      | 3 SP         |
| Testing, bug fixes, deployment             | 8 SP         |
| **Total**                                  | **53 SP**    |

Team: 1 Senior Developer + AI assistance. Part-time BA for requirement clarification.

---

## Risks

| ID   | Risk                                                              | Likelihood | Impact | Mitigation                                                                          |
|------|-------------------------------------------------------------------|------------|--------|-------------------------------------------------------------------------------------|
| R-01 | Spreadsheet data is incomplete ("?" / "unknown" values)           | High       | Medium | Seed only known-good data; leave blanks as "pending"                                |
| R-02 | Team continues using spreadsheet in parallel                      | Medium     | High   | Management mandate + retire spreadsheet access on go-live                           |
| R-03 | Source references for 5+ KPIs still TBD ("Ask Peter/Dipesh")     | High       | Medium | Pre-go-live workshop with KPI owners to document all source_references              |
| R-04 | Status computation edge cases (null thresholds, target direction) | Medium     | High   | Unit test `StatusComputationService` against all 18 KPIs before frontend integration|
| R-05 | 3-week MVP timeline aggressive for greenfield project             | Medium     | Medium | Use Spring Boot starter + Vite template; defer auth complexity; no microservices    |
| R-06 | 7 KPIs with "unknown" status may stay unknown                     | Medium     | High   | Build "data pending" workflow early to at least track *why* data is missing         |

---

## Pre-Go-Live Checklist

- [ ] All 18 KPIs configured with `source_reference` and `measurement_instruction`
- [ ] All 6 employees have login accounts with correct role assignments
- [ ] Historical data for April 2026 and May 2026 entered as seed measurements
- [ ] KPI owners workshop completed — no remaining "Ask Peter/Ask Dipesh" gaps
- [ ] `warn_threshold` and `critical_threshold` agreed for all KPIs
- [ ] 30-minute team walkthrough / demo completed
- [ ] Spreadsheet access revoked (or set to read-only)

---

*Version 1.0 | Product Development & Maintenance Team | June 2026*
