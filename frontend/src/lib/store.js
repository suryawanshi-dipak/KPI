/**
 * store.js — the single data layer for the whole app.
 *
 * Right now it's an in-memory store seeded from the spreadsheet export.
 * When the backend is ready, replace the function bodies here with fetch()
 * calls — every component already goes through these functions, so nothing
 * else has to change.
 *
 * Each function returns a Promise to mimic real async I/O, so swapping in
 * fetch() later won't require touching component code.
 */
import seed from "../data/seed.json";

// Deep-clone so edits in the session don't mutate the imported module.
let db = JSON.parse(JSON.stringify(seed));

// Normalise: ensure arrays exist
db.kra_area ||= [];
db.kpi_metric ||= [];
db.employees ||= [];
db.kpi_employee_assignment ||= [];
db.kpi_measurement ||= [];

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const clone = (x) => JSON.parse(JSON.stringify(x));

function nextId(table) {
  const ids = db[table].map((r) => Number(r.id) || 0);
  return (ids.length ? Math.max(...ids) : 0) + 1;
}

/* ── ENUMS (from the seed data's distinct values) ──────────── */
export const ENUMS = {
  direction: ["higher_better", "lower_better"],
  unit: ["Percentage", "Count", "Hours", "Days"],
  frequency: ["weekly", "bi-weekly", "monthly", "quarterly", "per release", "per commit"],
  role: ["admin", "manager", "employee", "hr"],
  department: ["IT", "HR", "Management", "Operations", "Release"],
  status: ["active", "inactive"],
  gender: ["Male", "Female", "Other"],
  periodType: ["weekly", "bi-weekly", "monthly", "per release"],
  team: ["Scrum", "Kanban", "Operations"],
  measurementStatus: ["green", "amber", "red", "critical", "unknown"],
};

/* ── KRA AREAS ─────────────────────────────────────────────── */
export async function listKras() {
  await delay();
  return clone(db.kra_area.filter((k) => !k.is_deleted));
}
export async function getKra(id) {
  await delay();
  return clone(db.kra_area.find((k) => Number(k.id) === Number(id)) || null);
}
export async function saveKra(payload) {
  await delay();
  if (payload.id) {
    const i = db.kra_area.findIndex((k) => Number(k.id) === Number(payload.id));
    db.kra_area[i] = { ...db.kra_area[i], ...payload };
    return clone(db.kra_area[i]);
  }
  const rec = {
    id: nextId("kra_area"),
    sort_order: db.kra_area.length + 1,
    is_active: 1,
    created_at: new Date().toISOString(),
    ...payload,
  };
  db.kra_area.push(rec);
  return clone(rec);
}

/* ── KPI METRICS ───────────────────────────────────────────── */
export async function listKpis() {
  await delay();
  return clone(db.kpi_metric.filter((k) => !k.is_deleted));
}
export async function getKpi(id) {
  await delay();
  return clone(db.kpi_metric.find((k) => Number(k.id) === Number(id)) || null);
}
export async function saveKpi(payload) {
  await delay();
  if (payload.id) {
    const i = db.kpi_metric.findIndex((k) => Number(k.id) === Number(payload.id));
    db.kpi_metric[i] = { ...db.kpi_metric[i], ...payload };
    return clone(db.kpi_metric[i]);
  }
  const rec = {
    id: nextId("kpi_metric"),
    is_active: 1,
    version: 1,
    created_at: new Date().toISOString(),
    ...payload,
  };
  db.kpi_metric.push(rec);
  return clone(rec);
}

/* ── EMPLOYEES ─────────────────────────────────────────────── */
export async function listEmployees() {
  await delay();
  return clone(db.employees.filter((e) => !e.is_deleted));
}
export async function getEmployee(id) {
  await delay();
  return clone(db.employees.find((e) => Number(e.id) === Number(id)) || null);
}
export async function saveEmployee(payload) {
  await delay();
  if (payload.id) {
    const i = db.employees.findIndex((e) => Number(e.id) === Number(payload.id));
    db.employees[i] = { ...db.employees[i], ...payload };
    return clone(db.employees[i]);
  }
  const rec = {
    id: nextId("employees"),
    status: "active",
    created_at: new Date().toISOString(),
    ...payload,
  };
  db.employees.push(rec);
  return clone(rec);
}

/* ── ASSIGNMENTS ───────────────────────────────────────────── */
export async function listAssignments() {
  await delay();
  return clone(db.kpi_employee_assignment);
}
export async function assignmentsForKpi(kpiId) {
  await delay();
  return clone(db.kpi_employee_assignment.filter((a) => Number(a.kpi_metric_id) === Number(kpiId)));
}

/* ── MEASUREMENTS ──────────────────────────────────────────── */
export async function listMeasurements() {
  await delay();
  return clone(db.kpi_measurement.filter((m) => !m.is_deleted));
}
export async function measurementsForKpi(kpiId) {
  await delay();
  return clone(
    db.kpi_measurement
      .filter((m) => Number(m.kpi_metric_id) === Number(kpiId) && !m.is_deleted)
      .sort((a, b) => String(a.period_start_date).localeCompare(String(b.period_start_date)))
  );
}
export async function saveMeasurement(payload) {
  await delay();
  const rec = {
    id: nextId("kpi_measurement"),
    is_system_generated: 0,
    is_pending: 0,
    is_corrected: 0,
    measured_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...payload,
  };
  db.kpi_measurement.push(rec);
  return clone(rec);
}

/* ── DERIVED HELPERS ───────────────────────────────────────── */
export async function getStats() {
  await delay();
  const kpis = db.kpi_metric.filter((k) => !k.is_deleted);
  // latest measurement per kpi
  const latestByKpi = {};
  db.kpi_measurement
    .filter((m) => !m.is_deleted)
    .forEach((m) => {
      const k = m.kpi_metric_id;
      if (!latestByKpi[k] || String(m.period_start_date) > String(latestByKpi[k].period_start_date)) {
        latestByKpi[k] = m;
      }
    });
  const statuses = Object.values(latestByKpi).map((m) => m.status);
  return {
    totalKpis: kpis.length,
    totalKras: db.kra_area.filter((k) => !k.is_deleted).length,
    totalEmployees: db.employees.filter((e) => !e.is_deleted).length,
    green: statuses.filter((s) => s === "green").length,
    amber: statuses.filter((s) => s === "amber").length,
    red: statuses.filter((s) => s === "red" || s === "critical").length,
    unknown: statuses.filter((s) => s === "unknown").length,
    measured: Object.keys(latestByKpi).length,
    latestByKpi: clone(latestByKpi),
  };
}

export function kraName(id) {
  const k = db.kra_area.find((x) => Number(x.id) === Number(id));
  return k ? k.area_name : "—";
}
export function employeeName(id) {
  const e = db.employees.find((x) => Number(x.id) === Number(id));
  return e ? e.name : "—";
}
