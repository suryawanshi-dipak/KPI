import { useState, useEffect, useMemo } from "react";
import { Field, StatusPill } from "../components/UI";
import { ENUMS, listKpis, listEmployees, kraName, getCurrentUser, listAssignments } from "../lib/store";
import { computeStatus } from "../lib/status";

const BLANK = {
  kpi_metric_id: "",
  measured_value: "",
  measurement_period_type: "monthly",
  measurement_period_label: "",
  period_start_date: "",
  period_end_date: "",
  measurement_note: "",
  raw_payload: "",
  post_action: "",
  measured_by: "",
  is_pending: 0,
  pending_reason: "",
};

export default function MeasurementForm({ initial, lockedKpiId, onSubmit, onCancel, saving }) {
  const [form, setForm] = useState({ ...BLANK, ...initial, kpi_metric_id: lockedKpiId || initial?.kpi_metric_id || "" });
  const [errors, setErrors] = useState({});
  const [kpis, setKpis] = useState([]);
  const [people, setPeople] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    listKpis().then(setKpis);
    listEmployees().then(setPeople);
    getCurrentUser().then(setCurrentUser);
    listAssignments().then(setAssignments);
  }, []);

  // Default the "Recorded by" (measured_by) selector to the logged-in user once loaded.
  useEffect(() => {
    if (currentUser && !form.measured_by) {
      setForm((f) => ({ ...f, measured_by: currentUser.id }));
    }
  }, [currentUser]);

  // Filter KPIs list: if the user is an employee/manager, only show KPIs assigned to them/their team.
  const filteredKpis = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === "employee") {
      const myKpiIds = new Set(
        assignments
          .filter((a) => Number(a.employee_id) === Number(currentUser.id))
          .map((a) => Number(a.kpi_metric_id))
      );
      return kpis.filter((k) => myKpiIds.has(Number(k.id)));
    }
    if (currentUser.role === "manager") {
      const myTeamEmployeeIds = new Set(
        people
          .filter((p) => Number(p.managerId) === Number(currentUser.id) || Number(p.id) === Number(currentUser.id))
          .map((p) => Number(p.id))
      );
      const myTeamKpiIds = new Set(
        assignments
          .filter((a) => myTeamEmployeeIds.has(Number(a.employee_id)))
          .map((a) => Number(a.kpi_metric_id))
      );
      return kpis.filter((k) => myTeamKpiIds.has(Number(k.id)));
    }
    return kpis;
  }, [kpis, currentUser, assignments, people]);

  const filteredPeople = useMemo(() => {
    if (!currentUser) return people;
    if (currentUser.role === "manager") {
      return people.filter(
        (p) => Number(p.id) === Number(currentUser.id) || Number(p.managerId) === Number(currentUser.id)
      );
    }
    return people;
  }, [people, currentUser]);

  const kpi = useMemo(
    () => filteredKpis.find((k) => Number(k.id) === Number(form.kpi_metric_id)),
    [filteredKpis, form.kpi_metric_id]
  );

  // Live status preview (frontend mirror of backend rule)
  const previewStatus = useMemo(() => {
    if (!kpi) return "unknown";
    return computeStatus({
      value: form.measured_value,
      direction: kpi.direction,
      target: kpi.target_value,
      warn: kpi.warn_threshold,
      critical: kpi.critical_threshold,
    });
  }, [kpi, form.measured_value]);

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? (e.target.checked ? 1 : 0) : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  // When KPI changes, default the period type to its frequency
  useEffect(() => {
    if (kpi && !initial) {
      const freq = ENUMS.periodType.includes(kpi.frequency) ? kpi.frequency : "monthly";
      setForm((f) => ({ ...f, measurement_period_type: freq }));
    }
  }, [kpi]); // eslint-disable-line

  const isPersonDisabledForKpi = (personId) => {
    if (!currentUser || currentUser.role !== "manager") return false;
    if (!form.kpi_metric_id) return true; // disable if no KPI selected
    return !assignments.some(
      (a) => Number(a.employee_id) === Number(personId) && Number(a.kpi_metric_id) === Number(form.kpi_metric_id)
    );
  };

  function validate() {
    const e = {};
    if (!form.kpi_metric_id) e.kpi_metric_id = "Choose the KPI you're measuring.";
    if (!form.is_pending) {
      if (form.measured_value === "" || isNaN(Number(form.measured_value)))
        e.measured_value = "Enter the measured value.";
    } else if (!form.pending_reason.trim()) {
      e.pending_reason = "Give a reason this period is pending.";
    }
    if (!form.measurement_period_label.trim()) e.measurement_period_label = "Add a period label (e.g. WK22, May-2026).";
    if (!form.period_start_date) e.period_start_date = "Pick the period start date.";
    if (!form.period_end_date) e.period_end_date = "Pick the period end date.";
    if (form.period_start_date && form.period_end_date && form.period_end_date < form.period_start_date)
      e.period_end_date = "End date can't be before start date.";
    
    if (!form.measured_by) {
      e.measured_by = "Select who recorded this.";
    } else if (currentUser?.role === "manager") {
      const isAssigned = assignments.some(
        (a) => Number(a.employee_id) === Number(form.measured_by) && Number(a.kpi_metric_id) === Number(form.kpi_metric_id)
      );
      if (!isAssigned) {
        e.measured_by = "The selected person is not assigned to this KPI.";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    onSubmit({
      ...form,
      kpi_metric_id: Number(form.kpi_metric_id),
      kpi_metric_version: kpi?.version ?? 1,
      measured_value: form.is_pending ? null : Number(form.measured_value),
      measured_by: Number(form.measured_by),
      status: form.is_pending ? "unknown" : previewStatus,
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="KPI" required error={errors.kpi_metric_id} full>
          <select className={`select ${errors.kpi_metric_id ? "invalid" : ""}`}
            value={form.kpi_metric_id} onChange={set("kpi_metric_id")} disabled={!!lockedKpiId}>
            <option value="">Select the KPI to measure…</option>
            {filteredKpis.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </Field>
      </div>

      {/* Guided context panel — pulled from the KPI definition */}
      {kpi && (
        <div className="preview-panel" style={{ marginTop: "1.1rem" }}>
          <div className="preview-panel__row">
            <span className="k">KRA area</span>
            <span className="v">{kraName(kpi.kra_area_id)}</span>
          </div>
          <div className="preview-panel__row">
            <span className="k">Target</span>
            <span className="v mono">
              {kpi.direction === "higher_better" ? "≥ " : "≤ "}{kpi.target_value} {kpi.unit}
            </span>
          </div>
          {kpi.source_reference && (
            <div className="preview-panel__row">
              <span className="k">Source reference</span>
              <span className="v mono" style={{ fontSize: "0.78rem", maxWidth: "62%", textAlign: "right", wordBreak: "break-word" }}>
                {kpi.source_reference}
              </span>
            </div>
          )}
          {kpi.measurement_instruction && (
            <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--rule)" }}>
              <div className="k" style={{ color: "var(--muted)", fontSize: "0.76rem", marginBottom: "0.2rem" }}>How to measure</div>
              <div style={{ fontSize: "0.84rem", color: "var(--ink-soft)" }}>{kpi.measurement_instruction}</div>
            </div>
          )}
        </div>
      )}

      <div className="form-grid" style={{ marginTop: "1.1rem" }}>
        <Field label="Measured value" required={!form.is_pending} error={errors.measured_value}
          hint={kpi ? kpi.unit : ""}>
          <input className={`input input--mono ${errors.measured_value ? "invalid" : ""}`}
            value={form.measured_value ?? ""} onChange={set("measured_value")} inputMode="decimal"
            disabled={!!form.is_pending} placeholder="e.g. 88.5" />
        </Field>

        {/* Live computed status */}
        <Field label="Computed status" hint="Auto from thresholds">
          <div style={{ display: "flex", alignItems: "center", height: 38, gap: "0.6rem" }}>
            <StatusPill status={form.is_pending ? "unknown" : previewStatus} />
            {!form.is_pending && kpi && (
              <span className="cell-sub">
                vs target {kpi.target_value}{kpi.unit === "Percentage" ? "%" : ""}
              </span>
            )}
          </div>
        </Field>

        <Field label="Period type" required>
          <select className="select" value={form.measurement_period_type} onChange={set("measurement_period_type")}>
            {ENUMS.periodType.map((p) => <option key={p} value={p}>{cap(p)}</option>)}
          </select>
        </Field>

        <Field label="Period label" required error={errors.measurement_period_label}
          hint="e.g. WK22 or May-2026">
          <input className={`input input--mono ${errors.measurement_period_label ? "invalid" : ""}`}
            value={form.measurement_period_label} onChange={set("measurement_period_label")} placeholder="WK22" />
        </Field>

        <Field label="Period start" required error={errors.period_start_date}>
          <input className="input" type="date" value={form.period_start_date || ""} onChange={set("period_start_date")} />
        </Field>

        <Field label="Period end" required error={errors.period_end_date}>
          <input className="input" type="date" value={form.period_end_date || ""} onChange={set("period_end_date")} />
        </Field>

        <Field label="Recorded by" required error={errors.measured_by}>
          <select className={`select ${errors.measured_by ? "invalid" : ""}`}
            value={form.measured_by} onChange={set("measured_by")}
            disabled={currentUser?.role === "employee"}>
            <option value="">Select person…</option>
            {filteredPeople.map((p) => {
              // Determine if this team member is unassigned to the current KPI being measured.
              // If they are not assigned, we disable their option to prevent managers from recording
              // measurements on their behalf, while keeping them visible in the list.
              const isDisabled = isPersonDisabledForKpi(p.id);
              return (
                <option key={p.id} value={p.id} disabled={isDisabled}>
                  {p.name}
                </option>
              );
            })}
          </select>
        </Field>

        <div className="field">
          <div className="check-row" style={{ margintop: "1.6rem", alignSelf: "end", height: 38 }}>
            <input id="m-pending" type="checkbox" checked={!!form.is_pending} onChange={set("is_pending")} />
            <label htmlFor="m-pending">Mark this period as data-pending</label>
          </div>
        </div>

        {form.is_pending ? (
          <Field label="Pending reason" required error={errors.pending_reason} full>
            <input className={`input ${errors.pending_reason ? "invalid" : ""}`}
              value={form.pending_reason} onChange={set("pending_reason")}
              placeholder="e.g. Source report not yet published for this period" />
          </Field>
        ) : (
          <>
            <Field label="Measurement note" hint="Plain-language explanation of the number" full>
              <textarea className="textarea" value={form.measurement_note} onChange={set("measurement_note")}
                placeholder="e.g. 32 of 36 planned hours delivered = 88.9%" />
            </Field>
            <Field label="Raw payload" hint="Underlying data / breakdown" full>
              <textarea className="textarea" value={form.raw_payload} onChange={set("raw_payload")}
                placeholder="Planned 36h, delivered 32h" />
            </Field>
            <Field label="Post-action" hint="Improvement action, if status is Amber/Red" full>
              <input className="input" value={form.post_action} onChange={set("post_action")}
                placeholder="e.g. Plan at task level" />
            </Field>
          </>
        )}
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? "Saving…" : "Save measurement"}
        </button>
      </div>
    </form>
  );
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
