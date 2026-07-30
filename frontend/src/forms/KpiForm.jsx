import { useState, useEffect } from "react";
import { Field } from "../components/UI";
import { ENUMS, listKras } from "../lib/store";

const BLANK = {
  name: "",
  kra_area_id: "",
  target_expression: "",
  direction: "higher_better",
  target_value: "",
  warn_threshold: "",
  critical_threshold: "",
  unit: "Percentage",
  frequency: "monthly",
  source_system: "",
  source_reference: "",
  measurement_instruction: "",
  is_active: 1,
  is_team_kpi: 0,
};

export default function KpiForm({ initial, onSubmit, onCancel, saving, kpis = [], isCopy = false }) {
  const [form, setForm] = useState({ ...BLANK, ...initial });
  const [errors, setErrors] = useState({});
  const [kras, setKras] = useState([]);

  useEffect(() => { listKras().then(setKras); }, []);

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? (e.target.checked ? 1 : 0) : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  function validate() {
    const e = {};
    if (!form.name.trim()) {
      e.name = "KPI name is required.";
    } else if (isCopy && form.name.trim().toLowerCase() === initial?.name?.trim()?.toLowerCase()) {
      e.name = "Duplicate KPI must have a different name from the original.";
    } else if (kpis && kpis.some(k => k.name.trim().toLowerCase() === form.name.trim().toLowerCase() && Number(k.id) !== Number(initial?.id))) {
      e.name = "A KPI with this name already exists.";
    }
    if (!form.kra_area_id) e.kra_area_id = "Pick the KRA area this belongs to.";
    if (form.target_value === "" || isNaN(Number(form.target_value)))
      e.target_value = "Enter a numeric target.";
    // threshold sanity per direction
    const t = Number(form.target_value), w = numOrNull(form.warn_threshold), c = numOrNull(form.critical_threshold);
    if (w !== null && c !== null) {
      if (form.direction === "higher_better" && !(t >= w && w >= c))
        e.warn_threshold = "For higher-is-better, expected target ≥ warn ≥ critical.";
      if (form.direction === "lower_better" && !(t <= w && w <= c))
        e.warn_threshold = "For lower-is-better, expected target ≤ warn ≤ critical.";
    }
    if (!form.source_system.trim()) e.source_system = "Name the source system (e.g. Jira).";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    onSubmit({
      ...form,
      kra_area_id: Number(form.kra_area_id),
      target_value: Number(form.target_value),
      warn_threshold: numOrNull(form.warn_threshold),
      critical_threshold: numOrNull(form.critical_threshold),
    });
  }

  const dirHint =
    form.direction === "higher_better"
      ? "Higher values are better (e.g. SLA compliance %)."
      : "Lower values are better (e.g. defect count).";

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="KPI name" required error={errors.name} full>
          <input className={`input ${errors.name ? "invalid" : ""}`} value={form.name}
            onChange={set("name")} placeholder="e.g. Delivery Commitment Accuracy" />
        </Field>

        <Field label="KRA area" required error={errors.kra_area_id}>
          <select className={`select ${errors.kra_area_id ? "invalid" : ""}`}
            value={form.kra_area_id} onChange={set("kra_area_id")}>
            <option value="">Select KRA area…</option>
            {kras.map((k) => <option key={k.id} value={k.id}>{k.area_name}</option>)}
          </select>
        </Field>

        <Field label="Measurement frequency" required>
          <select className="select" value={form.frequency} onChange={set("frequency")}>
            {ENUMS.frequency.map((f) => <option key={f} value={f}>{cap(f)}</option>)}
          </select>
        </Field>

        <Field label="Direction" required hint="" error={errors.direction}>
          <div className="segmented">
            <button type="button" className={form.direction === "higher_better" ? "active" : ""}
              onClick={() => setForm((f) => ({ ...f, direction: "higher_better" }))}>Higher is better</button>
            <button type="button" className={form.direction === "lower_better" ? "active" : ""}
              onClick={() => setForm((f) => ({ ...f, direction: "lower_better" }))}>Lower is better</button>
          </div>
          <span className="hint">{dirHint}</span>
        </Field>

        <Field label="Unit" required>
          <select className="select" value={form.unit} onChange={set("unit")}>
            {ENUMS.unit.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>

        <div className="form-section-title">Thresholds (drive automatic RAG status)</div>

        <Field label="Target value" required error={errors.target_value}
          hint="Green at or beyond this">
          <input className={`input input--mono ${errors.target_value ? "invalid" : ""}`}
            value={form.target_value} onChange={set("target_value")} inputMode="decimal"
            placeholder="85" />
        </Field>

        <Field label="Warn threshold" error={errors.warn_threshold} hint="Amber band — optional">
          <input className={`input input--mono ${errors.warn_threshold ? "invalid" : ""}`}
            value={form.warn_threshold ?? ""} onChange={set("warn_threshold")} inputMode="decimal"
            placeholder="80" />
        </Field>

        <Field label="Critical threshold" hint="Below this is Red — optional">
          <input className="input input--mono"
            value={form.critical_threshold ?? ""} onChange={set("critical_threshold")} inputMode="decimal"
            placeholder="70" />
        </Field>

        <Field label="Target expression" hint="Human-readable, shown to users" full>
          <input className="input" value={form.target_expression} onChange={set("target_expression")}
            placeholder="≥ 85% (senior) / ≥ 90% (lead)" />
        </Field>

        <div className="form-section-title">Data source (eliminates the “ask someone” problem)</div>

        <Field label="Source system" required error={errors.source_system}>
          <input className={`input ${errors.source_system ? "invalid" : ""}`}
            value={form.source_system} onChange={set("source_system")}
            placeholder="Jira / Kanban planning sheet" />
        </Field>

        <Field label="Source reference" hint="URL, Jira filter, or JQL">
          <input className="input input--mono" value={form.source_reference} onChange={set("source_reference")}
            placeholder="https://…atlassian.net/issues/?filter=11647" />
        </Field>

        <Field label="Measurement instruction" hint="Exact formula / how to read the value" full>
          <textarea className="textarea" value={form.measurement_instruction} onChange={set("measurement_instruction")}
            placeholder="(Delivered planned items ÷ committed planned items) × 100, monthly." />
        </Field>

        <div className="field field--full">
          <div className="check-row">
            <input id="kpi-active" type="checkbox" checked={!!form.is_active} onChange={set("is_active")} />
            <label htmlFor="kpi-active">Active — appears in measurement entry and dashboards</label>
          </div>
        </div>

        <div className="field field--full">
          <div className="check-row">
            <input id="kpi-team" type="checkbox" checked={!!form.is_team_kpi} onChange={set("is_team_kpi")} />
            <label htmlFor="kpi-team">Team KPI — Can only be assigned to a single team member</label>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? "Saving…" : initial?.id ? "Save changes" : "Create KPI"}
        </button>
      </div>
    </form>
  );
}

function numOrNull(x) {
  if (x === "" || x === null || x === undefined) return null;
  const n = Number(x);
  return isNaN(n) ? null : n;
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
