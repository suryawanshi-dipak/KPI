import { useEffect, useState } from "react";
import { Field } from "../components/UI";
import { listEmployees, getCurrentUser } from "../lib/store";

const BLANK = {
  employee_id: "",
  team: "",
  is_primary: 1,
  assigned_from: "",
  assigned_to: "",
};

export default function KpiAssignmentForm({
  kpiId,
  initial,
  saving,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState({
    ...BLANK,
    ...initial,
  });

  const [employees, setEmployees] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    listEmployees().then(setEmployees);
    getCurrentUser().then(setCurrentUser);
  }, []);

  const set = (k) => (e) => {
    const v =
      e.target.type === "checkbox"
        ? (e.target.checked ? 1 : 0)
        : e.target.value;

    setForm((f) => ({
      ...f,
      [k]: v,
    }));
  };

function submit(ev) {
  ev.preventDefault();

  onSubmit({
    id: form.id,
    kpi_metric_id: Number(kpiId),
    employee_id: Number(form.employee_id),
    team: form.team || null,
    is_primary: !!form.is_primary,
    assigned_from: form.assigned_from || null,
    assigned_to: form.assigned_to || null,
  });
}

  return (
    <form onSubmit={submit}>
      <div className="form-grid">

        <Field label="Employee" required>
          <select
            className="select"
            value={form.employee_id}
            onChange={set("employee_id")}
          >
            <option value="">
              Select employee…
            </option>

            {currentUser && employees
              .filter((e) => {
                // If the logged-in user is a manager, restrict the visible options to their direct reports (team members)
                if (currentUser.role === "manager") {
                  return Number(e.managerId) === Number(currentUser.id);
                }
                // Administrators, HR, and other roles see all employees in the system
                return true;
              })
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        </Field>

       <Field label="Team">
  <select
    className="select"
    value={form.team}
    onChange={set("team")}
  >
    <option value="">Select Team...</option>
    <option value="Scrum">Scrum</option>
    <option value="Kanban">Kanban</option>
  </select>
</Field>

        <Field label="Assigned From">
          <input
            type="date"
            className="input"
            value={form.assigned_from}
            onChange={set("assigned_from")}
          />
        </Field>

        <Field label="Assigned To">
          <input
            type="date"
            className="input"
            value={form.assigned_to}
            onChange={set("assigned_to")}
          />
        </Field>

        <div className="field field--full">
          <div className="check-row">
            <input
              id="primary-owner"
              type="checkbox"
              checked={!!form.is_primary}
              onChange={set("is_primary")}
            />

            <label htmlFor="primary-owner">
              Primary Owner
            </label>
          </div>
        </div>

      </div>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onCancel}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="btn btn--primary"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Assignment"}
        </button>
      </div>
    </form>
  );
}