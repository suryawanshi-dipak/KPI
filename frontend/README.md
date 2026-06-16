# KPI Monitoring System — React Frontend

Frontend-only React app for the KPI Monitoring System (Vitec, FY2026-27).
Built from the BRD and the seed data export. The backend connects later by
editing a single file.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

## What's included

**Pages**
- **Dashboard** — RAG stat tiles, trend chart, KRA health bars, and a
  KPIs-needing-attention table.
- **KPIs** — searchable list; each row can create / edit / measure / view trend.
- **KPI detail** — trend chart against the target line + full measurement history.
- **KRA Areas** — card grid showing per-area KPI health.
- **Measurements** — the full measurement log.
- **Team** — per-member KPI health.
- **Employees** — admin table with add / edit.
- **Reports** — Phase-2 placeholder.

**Forms (the core deliverable)** — in `src/forms/`
- `KpiForm.jsx` — KPI definition with direction toggle and threshold validation.
- `KraForm.jsx` — KRA area.
- `EmployeeForm.jsx` — employee with role and reporting line.
- `MeasurementForm.jsx` — the **guided measurement entry** form. It shows a
  context panel (KRA, target, source reference, measurement instruction pulled
  from the KPI definition) and computes the Green/Amber/Red status live as you
  type, mirroring BRD §7.2.

## Connecting your backend

Everything goes through **`src/lib/store.js`**. Each function currently reads
from an in-memory copy of the seed data. To connect the real API, replace the
body of each function with a `fetch()` call — component code never changes.

```js
// Before (mock)
export async function listKpis() {
  await delay();
  return clone(db.kpi_metric.filter((k) => !k.is_deleted));
}

// After (real API)
export async function listKpis() {
  const res = await fetch("/api/kpis");
  return res.json();
}
```

Form field names match the spreadsheet columns exactly (`kpi_metric`,
`kra_area`, `employees`, `kpi_measurement`), so the payloads map straight onto
the Spring Boot entities.

## Status computation

`src/lib/status.js` implements the Green/Amber/Red logic from BRD §7.2 as a
frontend preview, so the measurement form can show status instantly. The
backend remains the source of truth on save.

## Notes

- Seed data lives in `src/data/seed.json` (exported from KPI_Seed_Data_V3.xlsx).
- No auth yet — wire it in when the backend JWT is ready.
- Stack: Vite + React + React Router + Recharts.
