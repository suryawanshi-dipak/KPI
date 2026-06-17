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

/* ── JWT AUTH & MAPPING HELPERS ────────────────────────────── */

// Cache the token in memory once loaded so we don't repeat file system reads/fetches unnecessarily.
let cachedToken = null;

/**
 * Helper to strip optional prefixes like "token =", "token=", "bearer " etc.
 * that may be present in the Token.txt file or localStorage.
 */
function cleanToken(rawText) {
  if (!rawText) return "";
  let cleaned = rawText.trim();
  // Strip starting "token =" or "token=" or "Token =" or "Token=" or "bearer " (case-insensitive)
  cleaned = cleaned.replace(/^(token\s*=\s*|bearer\s+)/i, "");
  return cleaned;
}

/**
 * Retrieves the JWT token for backend API authentication.
 * Looks up the token sequentially from:
 * 1. An in-memory cache
 * 2. Public served files: /Token.txt or /token.txt
 * 3. Browser local storage (key: 'token')
 */
async function getToken() {
  if (cachedToken) return cachedToken;
  try {
    const res = await fetch("/Token.txt");
    if (res.ok) {
      const text = await res.text();
      cachedToken = cleanToken(text);
      return cachedToken;
    }
  } catch (e) {
    // Ignore and proceed to try lowercase token.txt
  }
  try {
    const res = await fetch("/token.txt");
    if (res.ok) {
      const text = await res.text();
      cachedToken = cleanToken(text);
      return cachedToken;
    }
  } catch (e) {
    // Ignore and fall back to localStorage
  }
  const localVal = localStorage.getItem("token") || "";
  cachedToken = cleanToken(localVal);
  return cachedToken;
}

/**
 * Maps a KRA Area database response (camelCase) to frontend's expected format (snake_case).
 */
function mapKraToFrontend(b) {
  if (!b) return null;
  return {
    id: b.id,
    area_name: b.areaName,
    financial_year: b.financialYear,
    sort_order: b.sortOrder,
    is_active: b.isActive ? 1 : 0, // Frontend uses numeric 1/0 for boolean flags
    created_at: b.createdAt,
    updated_at: b.updatedAt,
  };
}

/**
 * Maps frontend KRA Area form model (snake_case) to backend request payload (camelCase).
 */
function mapKraToBackend(f) {
  if (!f) return null;
  return {
    areaName: f.area_name,
    financialYear: f.financial_year,
    sortOrder: f.sort_order === "" || f.sort_order === null || f.sort_order === undefined ? null : Number(f.sort_order),
    isActive: f.is_active === 1 || f.is_active === true,
  };
}

/* ── KRA AREAS ─────────────────────────────────────────────── */

/**
 * Retrieves all KRA Areas from the backend API.
 * Updates local db.kra_area state to keep dependent pages and helpers in sync.
 */
export async function listKras() {
  try {
    const token = await getToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const res = await fetch("http://localhost:8080/kpi/api/v1/kra-areas", { headers });
    if (!res.ok) throw new Error("Failed to fetch KRA Areas");
    
    const json = await res.json();
    const list = (json.data || []).map(mapKraToFrontend);
    
    // Sync local DB cache
    db.kra_area = list;
    return list;
  } catch (err) {
    console.error("listKras error:", err);
    // Fall back to current mock seed data/in-memory list if API is unreachable
    return clone(db.kra_area.filter((k) => !k.is_deleted));
  }
}

/**
 * Retrieves a single KRA Area by its ID from the backend API.
 * Updates local db.kra_area array with the fresh data.
 */
export async function getKra(id) {
  try {
    const token = await getToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const res = await fetch(`http://localhost:8080/kpi/api/v1/kra-areas/${id}`, { headers });
    if (!res.ok) throw new Error(`Failed to fetch KRA Area ${id}`);
    
    const json = await res.json();
    const item = mapKraToFrontend(json.data);
    
    // Sync local DB cache
    const idx = db.kra_area.findIndex((k) => Number(k.id) === Number(id));
    if (idx !== -1) {
      db.kra_area[idx] = item;
    } else {
      db.kra_area.push(item);
    }
    return item;
  } catch (err) {
    console.error(`getKra(${id}) error:`, err);
    // Fallback to local cache lookup
    return clone(db.kra_area.find((k) => Number(k.id) === Number(id)) || null);
  }
}

/**
 * Saves (creates or updates) a KRA Area by calling the backend API.
 * POSTs to /kra-areas for new areas; PUTs to /kra-areas/{id} for edits.
 * Updates local db.kra_area array with the persisted backend state.
 */
export async function saveKra(payload) {
  try {
    const token = await getToken();
    const headers = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const isEdit = !!payload.id;
    const url = isEdit
      ? `http://localhost:8080/kpi/api/v1/kra-areas/${payload.id}`
      : "http://localhost:8080/kpi/api/v1/kra-areas";
    const method = isEdit ? "PUT" : "POST";
    
    const res = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(mapKraToBackend(payload)),
    });
    
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.message || "Failed to save KRA Area");
    }
    
    const json = await res.json();
    const item = mapKraToFrontend(json.data);
    
    // Sync local DB cache
    const idx = db.kra_area.findIndex((k) => Number(k.id) === Number(item.id));
    if (idx !== -1) {
      db.kra_area[idx] = item;
    } else {
      db.kra_area.push(item);
    }
    return item;
  } catch (err) {
    console.error("saveKra error:", err);
    throw err;
  }
}

/**
 * Deletes a KRA Area by calling the backend API (soft delete).
 * Updates local db.kra_area state by removing it to keep the UI in sync.
 */
export async function deleteKra(id) {
  try {
    const token = await getToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const res = await fetch(`http://localhost:8080/kpi/api/v1/kra-areas/${id}`, {
      method: "DELETE",
      headers,
    });
    
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.message || "Failed to delete KRA Area");
    }
    
    // Sync local DB cache by removing the deleted KRA Area
    const idx = db.kra_area.findIndex((k) => Number(k.id) === Number(id));
    if (idx !== -1) {
      db.kra_area.splice(idx, 1);
    }
    return true;
  } catch (err) {
    console.error("deleteKra error:", err);
    throw err;
  }
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
