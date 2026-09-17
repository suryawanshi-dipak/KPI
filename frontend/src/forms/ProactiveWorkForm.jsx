import { useEffect, useMemo, useState } from "react";
import { Field } from "../components/UI";
import { ENUMS, listEmployees, listMeasurements } from "../lib/store";

const CATEGORY_LABELS = {
  ATTENDANCE_PUNCTUALITY: "Attendance & Punctuality",
  TEAM_SUPPORT: "Team Support",
  INITIATIVE_IDEA: "Initiative / Idea",
  EXTRA_HOURS: "Extra Hours",
  RESOURCE_SAVING: "Resource Saving",
  PROCESS_IMPROVEMENT: "Process Improvement",
  OTHER: "Other",
};

const BLANK = {
  title: "",
  category: "",
  other_category_text: "",
  subject_employee_id: "",
  description: "",
  value_statement: "",
  effort_start_date: new Date().toISOString().slice(0, 10),
  effort_end_date: "",
  visibility: "ORGANISATION",
  kpi_measurement_id: "",
};

/**
 * `initial` (an existing entry) puts the form in edit mode: Credit to is never editable — that's
 * a bigger decision than fixing a typo — and title/category lock once endorsementCount > 0
 * unless the viewer is an admin (server enforces both regardless of what the UI shows).
 */
export default function ProactiveWorkForm({ currentUser, initial, lockedKpiMeasurementId, onSubmit, onCancel, saving }) {
  const [form, setForm] = useState(() => {
    if (initial) {
      return {
        title: initial.title,
        category: initial.category,
        other_category_text: initial.other_category_text || "",
        subject_employee_id: initial.subject_employee_id,
        description: initial.description,
        value_statement: initial.value_statement || "",
        effort_start_date: initial.effort_start_date,
        effort_end_date: initial.effort_end_date,
        visibility: initial.visibility || "ORGANISATION",
        kpi_measurement_id: initial.kpi_measurement_id || "",
      };
    }
    return {
      ...BLANK,
      subject_employee_id: currentUser?.id || "",
      kpi_measurement_id: lockedKpiMeasurementId || "",
    };
  });
  const [errors, setErrors] = useState({});
  const [multiDay, setMultiDay] = useState(
    !!initial && initial.effort_end_date && initial.effort_end_date !== initial.effort_start_date
  );
  const [employees, setEmployees] = useState([]);
  const [measurements, setMeasurements] = useState([]);

  useEffect(() => {
    listEmployees().then(setEmployees);
    listMeasurements().then(setMeasurements);
  }, []);

  const isEdit = !!initial;
  const isLocked = isEdit && (initial.endorsement_count || 0) > 0 && currentUser?.role !== "admin";

  // Credit-to defaults to self for every role, but is only restricted for Manager (self +
  // direct reports only, still enforced server-side). Employee and Admin can credit anyone.
  const creditOptions = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === "manager") {
      return employees
        .filter((e) => Number(e.id) === Number(currentUser.id) || Number(e.managerId) === Number(currentUser.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...employees].sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, currentUser]);

  // "Link to a KPI" lists the credited employee's recent measurements — filtered by whoever is
  // currently selected in "Credit to", so switching that selection re-scopes this dropdown.
  const kpiOptions = useMemo(() => {
    if (!form.subject_employee_id) return [];
    return measurements
      .filter((m) => Number(m.subject_employee_id) === Number(form.subject_employee_id) && !m.is_deleted)
      .sort((a, b) => String(b.period_start_date).localeCompare(String(a.period_start_date)))
      .slice(0, 25);
  }, [measurements, form.subject_employee_id]);

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  function validate() {
    const e = {};
    if (!form.title.trim()) e.title = "Tell us what you did.";
    else if (form.title.length > 200) e.title = "Keep it under 200 characters.";
    if (!form.category) e.category = "Pick a category.";
    if (form.category === "OTHER" && !form.other_category_text.trim())
      e.other_category_text = "Tell us what kind of work this was.";
    if (!form.subject_employee_id) e.subject_employee_id = "Choose who to credit this to.";
    if (!form.description.trim()) e.description = "Add a few details.";
    if (!form.value_statement.trim()) e.value_statement = "Tell us what changed as a result.";
    if (!form.effort_start_date) e.effort_start_date = "Pick a date.";
    if (multiDay) {
      if (!form.effort_end_date) e.effort_end_date = "Pick the last day.";
      else if (form.effort_end_date < form.effort_start_date) e.effort_end_date = "Last day can't be before the start date.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    onSubmit({
      ...form,
      id: initial?.id,
      other_category_text: form.category === "OTHER" ? form.other_category_text.trim() : null,
      value_statement: form.value_statement.trim() || null,
      effort_end_date: multiDay ? form.effort_end_date : form.effort_start_date,
      kpi_measurement_id: form.kpi_measurement_id || null,
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="What did you do?" required error={errors.title} full>
          <input className={`input ${errors.title ? "invalid" : ""}`} maxLength={200}
            value={form.title} onChange={set("title")} disabled={isLocked}
            placeholder="e.g. Covered the on-call rotation for a sick teammate" />
        </Field>

        <Field label="Category" required error={errors.category}
          hint={isLocked ? "locked — this entry has an endorsement" : undefined}>
          <select className={`select ${errors.category ? "invalid" : ""}`}
            value={form.category} onChange={set("category")} disabled={isLocked}>
            <option value="">Select a category…</option>
            {ENUMS.proactiveWorkCategory.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
            ))}
          </select>
        </Field>

        <Field label="Credit to" required error={errors.subject_employee_id}>
          <select className={`select ${errors.subject_employee_id ? "invalid" : ""}`}
            value={form.subject_employee_id} onChange={set("subject_employee_id")} disabled={isEdit}>
            {creditOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}{Number(e.id) === Number(currentUser?.id) ? " (Me)" : ""}
              </option>
            ))}
          </select>
        </Field>

        {form.category === "OTHER" && (
          <Field label="What kind of work was it?" required error={errors.other_category_text} full>
            <input className={`input ${errors.other_category_text ? "invalid" : ""}`}
              value={form.other_category_text} onChange={set("other_category_text")} disabled={isLocked}
              placeholder="Describe the kind of work in a few words" />
          </Field>
        )}

        <Field label="Details" required error={errors.description} full>
          <textarea className={`textarea ${errors.description ? "invalid" : ""}`}
            value={form.description} onChange={set("description")}
            placeholder="What happened, and why it mattered." />
        </Field>

        <Field label="What did it change?" required error={errors.value_statement} full>
          <input className={`input ${errors.value_statement ? "invalid" : ""}`} maxLength={200}
            value={form.value_statement} onChange={set("value_statement")}
            placeholder="e.g. Saves the support team around 3 hours a week" />
          <span className="hint">The outcome, in one line.</span>
        </Field>

        <Field label="When" required error={errors.effort_start_date}>
          <input className="input" type="date" value={form.effort_start_date} onChange={set("effort_start_date")} />
        </Field>

        <Field label="Link to a KPI" hint="optional">
          <select className="select" value={form.kpi_measurement_id} onChange={set("kpi_measurement_id")}>
            <option value="">Not linked to a KPI</option>
            {kpiOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.kpi_metric_name} · {m.measurement_period_label}</option>
            ))}
          </select>
        </Field>

        <div className="field">
          <div className="check-row" style={{ alignSelf: "end", height: 38 }}>
            <input id="pwe-multiday" type="checkbox" checked={multiDay}
              onChange={(e) => { setMultiDay(e.target.checked); setErrors((er) => ({ ...er, effort_end_date: undefined })); }} />
            <label htmlFor="pwe-multiday">This ran over several days</label>
          </div>
        </div>

        {multiDay && (
          <Field label="Last day" required error={errors.effort_end_date}>
            <input className={`input ${errors.effort_end_date ? "invalid" : ""}`} type="date"
              value={form.effort_end_date} onChange={set("effort_end_date")} />
          </Field>
        )}

        <Field label="Who can see this" full>
          <div className="segmented" style={{ alignSelf: "flex-start" }}>
            <button type="button" className={form.visibility === "ORGANISATION" ? "active" : ""}
              onClick={() => setForm((f) => ({ ...f, visibility: "ORGANISATION" }))}>
              Everyone at Vitec
            </button>
            <button type="button" className={form.visibility === "PRIVATE" ? "active" : ""}
              onClick={() => setForm((f) => ({ ...f, visibility: "PRIVATE" }))}>
              Just my manager
            </button>
          </div>
          <span className="hint">
            Anyone can endorse or comment on an entry shared this way. A linked KPI stays visible
            only to people who already have access to it.
          </span>
        </Field>
      </div>

      <div className="form-actions" style={{ justifyContent: "space-between" }}>
        <span className="cell-sub">Your manager will see this. No approval needed.</span>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save entry"}
          </button>
        </div>
      </div>
    </form>
  );
}
