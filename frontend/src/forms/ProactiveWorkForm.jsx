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
  TECHNICAL_MISSOUT: "Technical Missouts",
  FUNCTIONAL_MISSOUT: "Functional Missouts",
  COMMUNICATION_MISSOUT: "Communication Missouts",
  PROCESS_MISSOUT: "Process Missouts",
  TIMELINE_MISSOUT: "Timeline Missouts",
  OTHER: "Other",
};

const KIND_LABELS = {
  PROACTIVE: "Proactive",
  MISSOUT: "Missout",
};

// Example text in every free-text field switches with Type, so a Missout entry isn't guided by
// examples written for crediting positive effort.
const PLACEHOLDERS = {
  PROACTIVE: {
    title: "e.g. Covered the on-call rotation for a sick teammate",
    details: "What happened, and why it mattered.",
    impact: "e.g. Saves the support team around 3 hours a week",
  },
  MISSOUT: {
    title: "e.g. Missed the deployment window for the release",
    details: "What happened, and what went wrong.",
    impact: "e.g. Caused a 2-hour delay in the release",
  },
};

const BLANK = {
  title: "",
  work_kind: "PROACTIVE",
  category: "",
  other_category_text: "",
  subject_employee_ids: [],
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
 *
 * Credit to is a Teams-style @mention picker, not a hierarchy pick: any role can mention any
 * employee(s). Mentioning nobody logs the entry for yourself; mentioning someone credits them
 * *alongside* yourself, not instead of yourself — one entry, jointly credited to everyone
 * involved ("Bhavesh Bhimra & Dipak Suryawanshi"), not one entry per person. Editing an existing
 * entry keeps the single subject it already has; only new entries can be jointly credited.
 */
export default function ProactiveWorkForm({ currentUser, initial, lockedKpiMeasurementId, onSubmit, onCancel, saving }) {
  const [form, setForm] = useState(() => {
    if (initial) {
      return {
        title: initial.title,
        work_kind: initial.work_kind || "PROACTIVE",
        category: initial.category,
        other_category_text: initial.other_category_text || "",
        subject_employee_ids: initial.subject_employee_id != null ? [Number(initial.subject_employee_id)] : [],
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
      // No mentions yet — an empty mention list means "log this for me", so nobody is pre-selected.
      kpi_measurement_id: lockedKpiMeasurementId || "",
    };
  });
  const [errors, setErrors] = useState({});
  const [multiDay, setMultiDay] = useState(
    !!initial && initial.effort_end_date && initial.effort_end_date !== initial.effort_start_date
  );
  const [employees, setEmployees] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [mentionText, setMentionText] = useState("");

  useEffect(() => {
    listEmployees().then(setEmployees);
    listMeasurements().then(setMeasurements);
  }, []);

  const isEdit = !!initial;
  const isLocked = isEdit && (initial.endorsement_count || 0) > 0 && currentUser?.role !== "admin";

  // Category options depend on the entry's Type — Missout has its own set on the same underlying
  // column (see ProactiveWorkCategory.java).
  const categoryOptions = form.work_kind === "MISSOUT" ? ENUMS.missoutCategory : ENUMS.proactiveWorkCategory;

  // Credit to is a mention, not a hierarchy pick — every role can mention any employee, including
  // themselves. (Previously Manager was scoped to direct reports only; that restriction is gone.)
  const creditOptions = useMemo(() => {
    if (!currentUser) return [];
    return [...employees].sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, currentUser]);

  // Typing "@" opens the suggestion list, filtered by whatever follows it; already-mentioned
  // people drop out of the list so the same person can't be mentioned twice.
  const showMentionSuggestions = mentionText.startsWith("@");
  const mentionSuggestions = useMemo(() => {
    if (!showMentionSuggestions) return [];
    const q = mentionText.slice(1).trim().toLowerCase();
    return creditOptions
      // Yourself is credited automatically (see effectiveSubjectIds below), so mentioning
      // yourself would be redundant — leave yourself out of the suggestion list entirely.
      .filter((e) => Number(e.id) !== Number(currentUser?.id))
      .filter((e) => !form.subject_employee_ids.some((id) => Number(id) === Number(e.id)))
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [creditOptions, mentionText, showMentionSuggestions, form.subject_employee_ids, currentUser]);

  // Mentioning someone credits them alongside yourself, not instead of yourself — an empty
  // mention list means "just me", and mentioning Bhavesh means "Bhavesh and me", not "Bhavesh
  // only". Yourself is appended last (mentioned people first) purely for a consistent display
  // order ("Bhavesh Bhimra & Dipak Suryawanshi"); the backend also enforces this same rule
  // server-side regardless of what order a client sends. This resolution happens here (and again
  // at submit time) so the rest of the form, including the KPI-link field below, reacts to the
  // actual credited person(s) rather than to the raw mention list.
  const effectiveSubjectIds = useMemo(() => {
    const selfId = currentUser?.id != null ? Number(currentUser.id) : null;
    if (selfId == null) return form.subject_employee_ids;
    return form.subject_employee_ids.includes(selfId)
      ? form.subject_employee_ids
      : [...form.subject_employee_ids, selfId];
  }, [form.subject_employee_ids, currentUser]);

  // Linking a KPI measurement only makes sense when exactly one person is credited — a
  // measurement belongs to one subject, so with multiple people mentioned there's no single
  // "credited employee" to scope it to. The field itself is hidden (not just disabled) in that case.
  const singleSubjectId = effectiveSubjectIds.length === 1 ? effectiveSubjectIds[0] : null;

  // "Link to a KPI" lists the credited employee's recent measurements — filtered by whoever is
  // currently mentioned (or yourself, by default), so changing that selection re-scopes this list.
  const kpiOptions = useMemo(() => {
    if (singleSubjectId == null) return [];
    return measurements
      .filter((m) => Number(m.subject_employee_id) === Number(singleSubjectId) && !m.is_deleted)
      .sort((a, b) => String(b.period_start_date).localeCompare(String(a.period_start_date)))
      .slice(0, 25);
  }, [measurements, singleSubjectId]);

  // Clearing kpi_measurement_id happens right here, in the same state update, rather than in a
  // separate effect reacting to the new selection count — a KPI link only makes sense for exactly
  // one credited person, so any change away from that drops whatever link was picked before.
  function addMention(employee) {
    setForm((f) => {
      const ids = [...f.subject_employee_ids, Number(employee.id)];
      return { ...f, subject_employee_ids: ids, kpi_measurement_id: ids.length === 1 ? f.kpi_measurement_id : "" };
    });
    setMentionText("");
  }

  function removeMention(employeeId) {
    setForm((f) => {
      const ids = f.subject_employee_ids.filter((id) => Number(id) !== Number(employeeId));
      return { ...f, subject_employee_ids: ids, kpi_measurement_id: ids.length === 1 ? f.kpi_measurement_id : "" };
    });
  }

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
    // No mention required — an empty mention list resolves to "log this for me" at submit time.
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
    const shared = {
      work_kind: form.work_kind,
      category: form.category,
      other_category_text: form.category === "OTHER" ? form.other_category_text.trim() : null,
      title: form.title.trim(),
      description: form.description.trim(),
      value_statement: form.value_statement.trim() || null,
      effort_start_date: form.effort_start_date,
      effort_end_date: multiDay ? form.effort_end_date : form.effort_start_date,
      visibility: form.visibility,
    };
    if (isEdit) {
      // Single subject, unchanged by the edit — see the component doc comment above.
      onSubmit({
        ...shared,
        id: initial.id,
        subject_employee_id: form.subject_employee_ids[0],
        kpi_measurement_id: form.kpi_measurement_id || null,
      });
    } else {
      // One or more subjects (defaulting to yourself when nobody was mentioned) — a single
      // create call, one entry, jointly credited to everyone in the list.
      onSubmit({
        ...shared,
        subject_employee_ids: effectiveSubjectIds,
        kpi_measurement_id: singleSubjectId != null ? (form.kpi_measurement_id || null) : null,
      });
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="Type" required full>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            {ENUMS.proactiveWorkKind.map((k) => (
              <div key={k} className="check-row">
                <input type="radio" id={`pwe-kind-${k}`} name="work_kind" value={k}
                  checked={form.work_kind === k} disabled={isLocked}
                  onChange={() => setForm((f) => (
                    // Category options differ by kind (see categoryOptions below), so a category
                    // picked under the old kind may not even exist under the new one — clear it
                    // rather than carry over a value the new dropdown can't display as selected.
                    { ...f, work_kind: k, category: "", other_category_text: "" }
                  ))} />
                <label htmlFor={`pwe-kind-${k}`}>{KIND_LABELS[k] || k}</label>
              </div>
            ))}
          </div>
        </Field>

        <Field label="What did you do?" required error={errors.title} full>
          <input className={`input ${errors.title ? "invalid" : ""}`} maxLength={200}
            value={form.title} onChange={set("title")} disabled={isLocked}
            placeholder={PLACEHOLDERS[form.work_kind].title} />
        </Field>

        <Field label="Category" required error={errors.category}
          hint={isLocked ? "locked — this entry has an endorsement" : undefined}>
          <select className={`select ${errors.category ? "invalid" : ""}`}
            value={form.category} onChange={set("category")} disabled={isLocked}>
            <option value="">Select a category…</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
            ))}
          </select>
        </Field>

        <Field label="Credit to" full
          hint={isEdit ? "locked — re-crediting is a bigger change than editing a typo"
            : "type @ to also credit a teammate — you're always credited too"}>
          {isEdit ? (
            <div className="input" style={{ background: "var(--surface-2)", color: "var(--ink-soft)" }}>
              {initial.subject_employee_name || "—"}
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              {form.subject_employee_ids.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.5rem" }}>
                  {form.subject_employee_ids.map((id) => {
                    const person = creditOptions.find((e) => Number(e.id) === Number(id));
                    return (
                      <span key={id} className="tag" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                        @{person?.name || id}
                        <button type="button" onClick={() => removeMention(id)}
                          aria-label={`Remove ${person?.name || "mention"}`}
                          style={{ border: "none", background: "none", cursor: "pointer", padding: 0,
                            color: "var(--ink-soft)", fontSize: "0.95rem", lineHeight: 1 }}>
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <input className="input" value={mentionText}
                onChange={(ev) => setMentionText(ev.target.value)}
                placeholder="Type @ to mention someone…" />
              {showMentionSuggestions && mentionSuggestions.length > 0 && (
                <div style={{
                  position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0, marginTop: 4,
                  background: "var(--surface)", border: "1px solid var(--rule-strong)",
                  borderRadius: "var(--r-sm)", boxShadow: "0 8px 24px rgba(0,0,0,.14)",
                  maxHeight: 200, overflowY: "auto",
                }}>
                  {mentionSuggestions.map((e) => (
                    <button key={e.id} type="button"
                      onMouseDown={(ev) => { ev.preventDefault(); addMention(e); }}
                      style={{ display: "block", width: "100%", textAlign: "left",
                        padding: "0.5rem 0.75rem", border: "none", background: "none",
                        cursor: "pointer", fontSize: "0.86rem", color: "var(--ink)" }}>
                      {e.name}{Number(e.id) === Number(currentUser?.id) ? " (Me)" : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
            placeholder={PLACEHOLDERS[form.work_kind].details} />
        </Field>

        <Field label="Impact" required error={errors.value_statement} full>
          <input className={`input ${errors.value_statement ? "invalid" : ""}`} maxLength={200}
            value={form.value_statement} onChange={set("value_statement")}
            placeholder={PLACEHOLDERS[form.work_kind].impact} />
          <span className="hint">The outcome, in one line.</span>
        </Field>

        <Field label="When" required error={errors.effort_start_date}>
          <input className="input" type="date" value={form.effort_start_date} onChange={set("effort_start_date")} />
        </Field>

        {singleSubjectId != null && (
          <Field label="Link to a KPI" hint="optional">
            <select className="select" value={form.kpi_measurement_id} onChange={set("kpi_measurement_id")}>
              <option value="">Not linked to a KPI</option>
              {kpiOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.kpi_metric_name} · {m.measurement_period_label}</option>
              ))}
            </select>
          </Field>
        )}

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
