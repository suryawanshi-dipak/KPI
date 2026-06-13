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
- [API Reference](#api-reference)
- [Enum Reference](#enum-reference)
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
| API         | Spring Boot 3.2.x (Java 17)       |
| Database    | MySQL 8.x                         |
| Auth        | Spring Security + JWT (HS256)     |
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

# Seed the database with KPIs, KRA areas, and employees
./scripts/seed.sh
```

The app will be available at `http://localhost:3000`.  
API runs at `http://localhost:8080/kpi`.

### Default Accounts (Seed Data)

| Name         | Role    | Email                        |
|--------------|---------|------------------------------|
| Admin User   | admin   | admin@company.com            |
| Atul Jadhav  | manager | atul.jadhav@company.com      |
| Nikhil More  | employee| nikhil.more@company.com      |
| Dipesh       | employee| dipesh@company.com           |
| Peter        | employee| peter@company.com            |

Default password for all seed accounts: `Change@123`

---

## Project Structure

```
KPI/
└── src/main/java/com/kpi/
    ├── config/                   # SecurityConfig, CorsConfig
    ├── controller/               # REST controllers
    │   ├── AuthController.java
    │   ├── EmployeeController.java
    │   ├── KraAreaController.java
    │   ├── KpiMetricController.java
    │   ├── KpiAssignmentController.java
    │   ├── KpiMeasurementController.java
    │   └── PerformanceReviewController.java
    ├── dto/
    │   ├── request/              # Validated request bodies
    │   └── response/             # API response shapes
    ├── entity/
    │   ├── enums/                # Direction, Frequency, MeasurementStatus, ReviewType, ReviewStatus, Role, EmployeeStatus
    │   ├── Employee.java
    │   ├── KraArea.java
    │   ├── KpiMetric.java
    │   ├── KpiEmployeeAssignment.java
    │   ├── KpiMeasurement.java
    │   └── PerformanceReview.java
    ├── exception/                # GlobalExceptionHandler, ResourceNotFoundException, BadRequestException
    ├── repository/               # Spring Data JPA repos with JOIN FETCH queries
    ├── security/                 # JwtService, JwtAuthenticationFilter, CustomUserDetailsService
    └── service/
        ├── impl/                 # Service implementations
        └── *.java                # Service interfaces
```

---

## Modules

### 1. KPI Measurement Entry *(Core — MVP)*
- Guided form per KPI, pre-filled with source reference, instructions, last value, and target
- Fields: `measured_value`, `period`, `measurement_note`, `raw_payload`, `post_action`
- Supports marking as "Data Pending" with a reason (replaces blank cells)
- Correction workflow: link a new measurement to the one it corrects via `corrected_from_id`

### 2. KPI Definition & Configuration
- CRUD for all KPI metrics: name, thresholds, direction, unit, frequency, source system
- Links KPIs to KRA areas (`kra_area_id`)
- Supports target version history (`version` field — bump on threshold change)

### 3. KRA Area Management
- Four KRA areas: Quality Engineering & Reliability, Production Stability & Support, Delivery Predictability, Team Management & Process Discipline
- Ordered by `sort_order`; supports active/inactive toggling

### 4. KPI Employee Assignment
- Maps employees to KPI metrics with `is_primary` flag, `team`, and date range
- Filtered lookups by metric or by employee

### 5. Performance Review
- Quarterly/annual review form with per-KRA commentary and overall score
- Status lifecycle: `draft` → `submitted` → `approved`
- Approved reviews are immutable (no edit or delete)

### 6. Dashboard & Analytics *(Frontend — Phase 2)*
- **Team RAG Grid:** all KPIs × current status, grouped by KRA area
- **Trend Chart:** 12-period line chart with target line and warn/critical bands
- **Completeness Indicator:** `14/18 KPIs measured this period`
- **Pending Alert Banner:** shown when any measurement is in `unknown`/`pending` state

---

## Data Model

```
kra_area
  └── kpi_metric
        ├── kpi_employee_assignment → employee
        └── kpi_measurement         → employee (measured_by)
                                      kpi_measurement (corrected_from_id, self-ref)

employee
  └── performance_review (as reviewee and reviewer)
```

### Entity Summary

| Table                    | PK Type   | Key Relationships                              |
|--------------------------|-----------|------------------------------------------------|
| `kra_area`               | INT       | —                                              |
| `kpi_metric`             | INT       | FK → kra_area                                  |
| `kpi_employee_assignment`| INT       | FK → kpi_metric, employee                      |
| `kpi_measurement`        | BIGINT    | FK → kpi_metric, employee (measuredBy), self   |
| `performance_review`     | INT       | FK → employee (×2: reviewee, reviewer)         |
| `employees`              | INT       | FK → self (manager_id)                         |

All tables include `is_deleted` (soft-delete), `created_at`, `updated_at`, `created_by`, `updated_by`.

---

## Status Computation Logic

| Direction      | Green                          | Amber                                          | Red                                              | Critical                    |
|----------------|-------------------------------|------------------------------------------------|--------------------------------------------------|-----------------------------|
| `lower_better` | value ≤ target                | target < value ≤ warn_threshold                | warn_threshold < value ≤ critical_threshold       | value > critical_threshold  |
| `higher_better`| value ≥ target                | warn_threshold ≤ value < target                | critical_threshold ≤ value < warn_threshold       | value < critical_threshold  |
| `target`       | \|value − target\| = 0        | \|value − target\| ≤ 1                         | \|value − target\| ≤ 3                            | \|value − target\| > 3      |

> When `warn_threshold` and `critical_threshold` are null, only Green and Red statuses are used.

---

## API Reference

Base URL: `http://localhost:8080/kpi`  
All endpoints except `POST /api/auth/login` require `Authorization: Bearer <token>`.  
Token expiry: **24 hours**.

Import `KPI.postman_collection.json` into Postman for a ready-to-use collection with example bodies and saved responses.

---

### Auth

| Method | Path               | Auth     | Description                        |
|--------|--------------------|----------|------------------------------------|
| POST   | `/api/auth/login`  | Public   | Get JWT token                      |

**Request body:**
```json
{ "email": "admin@kpi.com", "password": "admin123" }
```

---

### Employees

| Method | Path                    | Description          |
|--------|-------------------------|----------------------|
| GET    | `/api/v1/employees`     | List all employees   |
| GET    | `/api/v1/employees/{id}`| Get employee by ID   |

---

### KRA Areas

| Method | Path                       | Description                                |
|--------|----------------------------|--------------------------------------------|
| GET    | `/api/v1/kra-areas`        | List all (add `?activeOnly=true` to filter)|
| GET    | `/api/v1/kra-areas/{id}`   | Get by ID                                  |
| POST   | `/api/v1/kra-areas`        | Create                                     |
| PUT    | `/api/v1/kra-areas/{id}`   | Update                                     |
| DELETE | `/api/v1/kra-areas/{id}`   | Soft delete                                |

**Create/Update body:**
```json
{
  "areaName": "Quality Engineering & Reliability",
  "sortOrder": 1,
  "financialYear": "2025-26",
  "isActive": true
}
```

---

### KPI Metrics

| Method | Path                         | Description                                |
|--------|------------------------------|--------------------------------------------|
| GET    | `/api/v1/kpi-metrics`        | List all (add `?activeOnly=true` to filter)|
| GET    | `/api/v1/kpi-metrics/{id}`   | Get by ID                                  |
| POST   | `/api/v1/kpi-metrics`        | Create                                     |
| PUT    | `/api/v1/kpi-metrics/{id}`   | Update                                     |
| DELETE | `/api/v1/kpi-metrics/{id}`   | Soft delete                                |

**Required fields:** `kraAreaId`, `name`, `direction`, `frequency`

**Create/Update body:**
```json
{
  "kraAreaId": 1,
  "name": "Production Defect Rate",
  "targetExpression": "< 3 per quarter",
  "direction": "lower_better",
  "targetValue": 3.00,
  "warnThreshold": 5.00,
  "criticalThreshold": 10.00,
  "unit": "defects",
  "frequency": "quarterly",
  "sourceSystem": "Jira",
  "sourceReference": "Jira: project=PROD AND type=Bug AND priority=High",
  "measurementInstruction": "Run the saved Jira filter and count open bugs.",
  "isActive": true
}
```

---

### KPI Assignments

| Method | Path                                        | Description                          |
|--------|---------------------------------------------|--------------------------------------|
| GET    | `/api/v1/kpi-assignments`                   | List all assignments                 |
| GET    | `/api/v1/kpi-assignments/{id}`              | Get by ID                            |
| GET    | `/api/v1/kpi-assignments/metric/{metricId}` | All employees assigned to a metric   |
| GET    | `/api/v1/kpi-assignments/employee/{empId}`  | All metrics assigned to an employee  |
| POST   | `/api/v1/kpi-assignments`                   | Create assignment                    |
| PUT    | `/api/v1/kpi-assignments/{id}`              | Update assignment                    |
| DELETE | `/api/v1/kpi-assignments/{id}`              | Soft delete                          |

**Required fields:** `kpiMetricId`, `employeeId`

**Create/Update body:**
```json
{
  "kpiMetricId": 1,
  "employeeId": 2,
  "team": "Backend",
  "isPrimary": true,
  "assignedFrom": "2026-04-01",
  "assignedTo": "2027-03-31"
}
```

---

### KPI Measurements

| Method | Path                              | Description                                       |
|--------|-----------------------------------|---------------------------------------------------|
| GET    | `/api/v1/kpi-measurements`        | List all (optional `?metricId=` or `?status=`)    |
| GET    | `/api/v1/kpi-measurements/{id}`   | Get by ID                                         |
| GET    | `/api/v1/kpi-measurements/pending`| All measurements with `isPending=true`            |
| POST   | `/api/v1/kpi-measurements`        | Record a measurement                              |
| PUT    | `/api/v1/kpi-measurements/{id}`   | Update a measurement                              |
| DELETE | `/api/v1/kpi-measurements/{id}`   | Soft delete                                       |

**Required fields:** `kpiMetricId`, `measurementPeriodType`, `measurementPeriodLabel`, `periodStartDate`, `periodEndDate`, `status`, `measuredById`

**Record measurement body:**
```json
{
  "kpiMetricId": 1,
  "measuredValue": 7.00,
  "measurementPeriodType": "quarterly",
  "measurementPeriodLabel": "Q1-FY2026",
  "periodStartDate": "2026-04-01",
  "periodEndDate": "2026-06-30",
  "status": "red",
  "measurementNote": "High defect count due to rushed release.",
  "rawPayload": "Jira CSV export...",
  "postAction": "Added regression suite to CI pipeline.",
  "measuredById": 2,
  "isSystemGenerated": false,
  "isPending": false
}
```

**Record pending entry** (data not yet available):
```json
{
  "kpiMetricId": 1,
  "measuredValue": null,
  "measurementPeriodType": "quarterly",
  "measurementPeriodLabel": "Q1-FY2026",
  "periodStartDate": "2026-04-01",
  "periodEndDate": "2026-06-30",
  "status": "unknown",
  "isPending": true,
  "pendingReason": "Jira data not available yet — check back Monday",
  "measuredById": 2
}
```

**Record a correction** (link to the original measurement):
```json
{
  "kpiMetricId": 1,
  "measuredValue": 6.00,
  "measurementPeriodType": "quarterly",
  "measurementPeriodLabel": "Q1-FY2026",
  "periodStartDate": "2026-04-01",
  "periodEndDate": "2026-06-30",
  "status": "red",
  "measuredById": 2,
  "correctedFromId": 1
}
```
`isCorrected` is set to `true` automatically when `correctedFromId` is provided.

---

### Performance Reviews

| Method | Path                                        | Description                                      |
|--------|---------------------------------------------|--------------------------------------------------|
| GET    | `/api/v1/performance-reviews`               | List all (optional `?employeeId=` or `?status=`) |
| GET    | `/api/v1/performance-reviews/{id}`          | Get by ID                                        |
| POST   | `/api/v1/performance-reviews`               | Create (defaults to `draft`)                     |
| PUT    | `/api/v1/performance-reviews/{id}`          | Update (blocked if `approved`)                   |
| PATCH  | `/api/v1/performance-reviews/{id}/submit`   | `draft` → `submitted`                            |
| PATCH  | `/api/v1/performance-reviews/{id}/approve`  | `submitted` → `approved`                         |
| DELETE | `/api/v1/performance-reviews/{id}`          | Soft delete (blocked if `approved`)              |

**Required fields:** `employeeId`

**Create/Update body:**
```json
{
  "employeeId": 2,
  "reviewerId": 1,
  "reviewType": "quarterly",
  "periodLabel": "Q1-FY2026",
  "periodStart": "2026-04-01",
  "periodEnd": "2026-06-30",
  "kraComments": "[{\"kraAreaId\": 1, \"comments\": \"Solid performance.\", \"score\": 4.0}]",
  "overallScore": 3.80
}
```

**Review lifecycle:**
```
draft  →  (submit)  →  submitted  →  (approve)  →  approved (immutable)
```

---

## Enum Reference

| Enum              | Values                                                              |
|-------------------|---------------------------------------------------------------------|
| `direction`       | `higher_better`, `lower_better`, `target`                           |
| `frequency`       | `weekly`, `bi_weekly`, `monthly`, `quarterly`, `per_release`, `per_commit` |
| `measurementStatus` | `green`, `amber`, `red`, `critical`, `unknown`                    |
| `reviewType`      | `quarterly`, `annual`                                               |
| `reviewStatus`    | `draft`, `submitted`, `approved`                                    |
| `role`            | `admin`, `manager`, `employee`, `hr`                                |
| `employeeStatus`  | `active`, `inactive`                                                |

---

## Roles & Permissions

| Action                            | Employee | Manager | Admin |
|-----------------------------------|----------|---------|-------|
| View all KPIs and KRA areas       | ✅        | ✅       | ✅     |
| Record own KPI measurements       | ✅        | ✅       | ✅     |
| Record any team member's measurement |       | ✅       | ✅     |
| View KPI assignments              | ✅        | ✅       | ✅     |
| Create/edit KPI definitions       |          |         | ✅     |
| Create/edit KRA areas             |          |         | ✅     |
| Manage assignments                |          | ✅       | ✅     |
| View own performance reviews      | ✅        | ✅       | ✅     |
| Create/submit performance review  |          | ✅       | ✅     |
| Approve performance review        |          | ✅       | ✅     |
| Manage employees                  |          |         | ✅     |

> Role enforcement is planned for a future sprint. All authenticated endpoints currently accept any valid JWT.

---

## Dashboard Features

### Team KPI Dashboard
- RAG status grid grouped by KRA area
- Measurement completeness progress bar (`14/18 KPIs measured`)
- Pending measurements indicator
- Last updated timestamp

### KPI Trend Detail Page
- Line chart — last 12 periods, target line, warn/critical threshold bands
- Colour-coded status history timeline
- Measurement log table (value, note, post_action, measured_by, measured_at)

### Manager Overview *(Phase 2)*
- Stacked bar: team member KPI count by status
- List of KPIs pending measurement with responsible employee

---

## Roadmap

| Phase   | Timeline   | Theme                      | Key Deliverables                                                   |
|---------|------------|----------------------------|--------------------------------------------------------------------|
| MVP     | Weeks 1–3  | Core measurement loop      | KPI config, guided entry form, RAG dashboard, trend charts, login  |
| Phase 2 | Weeks 4–6  | Review & collaboration     | Notifications, quarterly review workflow, correction chain, export |
| Phase 3 | Month 3+   | Automation & scale         | Jira/Zendesk API integration, annual review, attachments, heatmap  |

**Out of scope for Phase 1:** SSO/Azure AD, automated metric pulling, 360-degree feedback, salary linkage.

---

## Development Effort

### MVP (Weeks 1–3) — ~13.5 days

| Feature                                    | Story Points |
|--------------------------------------------|--------------|
| Project setup (Spring Boot, React, Docker) | 3 SP         |
| Employee & Auth module                     | 5 SP         |
| KPI & KRA configuration (Admin CRUD)       | 8 SP         |
| KPI Assignment management                  | 3 SP         |
| Measurement entry form + status engine     | 13 SP        |
| Performance Review workflow                | 8 SP         |
| Team RAG dashboard                         | 8 SP         |
| KPI trend chart (Recharts)                 | 5 SP         |
| Data seeding: 18 KPIs                      | 3 SP         |
| Testing, bug fixes, deployment             | 8 SP         |
| **Total**                                  | **64 SP**    |

Team: 1 Senior Developer + AI assistance.

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
- [ ] All employees have login accounts with correct role assignments
- [ ] Historical data for at least 2 periods entered as seed measurements
- [ ] KPI owners workshop completed — no remaining "Ask Peter/Ask Dipesh" gaps
- [ ] `warn_threshold` and `critical_threshold` agreed for all KPIs
- [ ] All KPIs assigned to at least one employee (`is_primary = true`)
- [ ] 30-minute team walkthrough / demo completed
- [ ] Spreadsheet access revoked (or set to read-only)

---

*Version 2.0 | Product Development & Maintenance Team | June 2026*
