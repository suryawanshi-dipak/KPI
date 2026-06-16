import { useState, useEffect } from "react";
import { Field } from "../components/UI";
import { ENUMS, listEmployees } from "../lib/store";

const BLANK = {
  employee_id: "",
  name: "",
  email: "",
  role: "employee",
  department: "IT",
  designation: "",
  manager_id: "",
  phone: "",
  joined_on: "",
  gender: "Male",
  status: "active",
};

export default function EmployeeForm({ initial, onSubmit, onCancel, saving }) {
  const [form, setForm] = useState({ ...BLANK, ...initial });
  const [errors, setErrors] = useState({});
  const [managers, setManagers] = useState([]);

  useEffect(() => {
    listEmployees().then((all) =>
      setManagers(all.filter((e) => e.role === "manager" || e.role === "admin"))
    );
  }, []);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  function submit(ev) {
    ev.preventDefault();
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required.";
    if (!form.employee_id.trim()) e.employee_id = "Employee ID is required.";
    if (!form.email.trim()) e.email = "Email is required.";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = "Enter a valid email.";
    setErrors(e);
    if (Object.keys(e).length) return;
    onSubmit({
      ...form,
      manager_id: form.manager_id === "" ? null : Number(form.manager_id),
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="Full name" required error={errors.name}>
          <input className={`input ${errors.name ? "invalid" : ""}`} value={form.name}
            onChange={set("name")} placeholder="Devdatta Dahanukar" />
        </Field>

        <Field label="Employee ID" required error={errors.employee_id}>
          <input className={`input input--mono ${errors.employee_id ? "invalid" : ""}`} value={form.employee_id}
            onChange={set("employee_id")} placeholder="VT001" />
        </Field>

        <Field label="Email" required error={errors.email} full>
          <input className={`input ${errors.email ? "invalid" : ""}`} value={form.email}
            onChange={set("email")} type="email" placeholder="name@vitec.co.in" />
        </Field>

        <Field label="Role" required hint="Drives access level">
          <select className="select" value={form.role} onChange={set("role")}>
            {ENUMS.role.map((r) => <option key={r} value={r}>{cap(r)}</option>)}
          </select>
        </Field>

        <Field label="Department" required>
          <select className="select" value={form.department} onChange={set("department")}>
            {ENUMS.department.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>

        <Field label="Designation">
          <input className="input" value={form.designation} onChange={set("designation")}
            placeholder="Senior Developer" />
        </Field>

        <Field label="Reports to" hint="Manager">
          <select className="select" value={form.manager_id ?? ""} onChange={set("manager_id")}>
            <option value="">— None —</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>

        <Field label="Phone">
          <input className="input input--mono" value={form.phone ?? ""} onChange={set("phone")}
            placeholder="9833955933" />
        </Field>

        <Field label="Joined on">
          <input className="input" type="date" value={form.joined_on || ""} onChange={set("joined_on")} />
        </Field>

        <Field label="Gender">
          <select className="select" value={form.gender} onChange={set("gender")}>
            {ENUMS.gender.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>

        <Field label="Status">
          <select className="select" value={form.status} onChange={set("status")}>
            {ENUMS.status.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
        </Field>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? "Saving…" : initial?.id ? "Save changes" : "Add employee"}
        </button>
      </div>
    </form>
  );
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
