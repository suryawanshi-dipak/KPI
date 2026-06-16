import { useState } from "react";
import { Field } from "../components/UI";

const BLANK = {
  area_name: "",
  financial_year: "FY2026-27",
  sort_order: "",
  is_active: 1,
};

export default function KraForm({ initial, onSubmit, onCancel, saving }) {
  const [form, setForm] = useState({ ...BLANK, ...initial });
  const [errors, setErrors] = useState({});

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? (e.target.checked ? 1 : 0) : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  function submit(ev) {
    ev.preventDefault();
    const e = {};
    if (!form.area_name.trim()) e.area_name = "Area name is required.";
    if (!form.financial_year.trim()) e.financial_year = "Financial year is required.";
    setErrors(e);
    if (Object.keys(e).length) return;
    onSubmit({
      ...form,
      sort_order: form.sort_order === "" ? undefined : Number(form.sort_order),
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="Area name" required error={errors.area_name} full>
          <input className={`input ${errors.area_name ? "invalid" : ""}`} value={form.area_name}
            onChange={set("area_name")} placeholder="e.g. Delivery Predictability" />
        </Field>

        <Field label="Financial year" required error={errors.financial_year}>
          <input className="input input--mono" value={form.financial_year}
            onChange={set("financial_year")} placeholder="FY2026-27" />
        </Field>

        <Field label="Sort order" hint="Display order on dashboards">
          <input className="input input--mono" value={form.sort_order ?? ""} onChange={set("sort_order")}
            inputMode="numeric" placeholder="1" />
        </Field>

        <div className="field field--full">
          <div className="check-row">
            <input id="kra-active" type="checkbox" checked={!!form.is_active} onChange={set("is_active")} />
            <label htmlFor="kra-active">Active</label>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? "Saving…" : initial?.id ? "Save changes" : "Create KRA area"}
        </button>
      </div>
    </form>
  );
}
