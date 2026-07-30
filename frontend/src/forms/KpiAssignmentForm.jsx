import { useEffect, useState } from "react";
import { Field } from "../components/UI";
import { listEmployees, getCurrentUser } from "../lib/store";

// Initial blank form payload structure
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
  assignments = [], // Added assignments prop for local duplicate validation
  isTeamKpi = false,
}) {
  // Check if there is already an active assignment for this KPI metric (for Team KPI create validation)
  const hasExistingAssignment = assignments.some(a => Number(a.kpi_metric_id) === Number(kpiId));
  // Main form state for metadata fields (Team, Dates, Primary status)
  const [form, setForm] = useState({
    ...BLANK,
    ...initial,
  });

  // State to hold list of all system employees and current logged in user
  const [employees, setEmployees] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // State to hold selected employee IDs for multi-assignment (used when creating a new assignment)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

  useEffect(() => {
    // Fetch employees list and current user details on component mount
    listEmployees().then(setEmployees);
    getCurrentUser().then(setCurrentUser);
  }, []);

  useEffect(() => {
    // If editing (initial prop is passed), populate the selectedEmployeeIds with the current employee's ID
    if (initial && initial.employee_id) {
      setSelectedEmployeeIds([Number(initial.employee_id)]);
    }
  }, [initial]);

  // Helper to determine if an employee is already assigned to this KPI (excluding the current assignment in edit mode)
  const isAlreadyAssigned = (empId) => {
    return assignments.some(a => 
      Number(a.kpi_metric_id) === Number(kpiId) &&
      Number(a.employee_id) === Number(empId) &&
      (!initial || Number(a.id) !== Number(initial.id))
    );
  };

  // Generic handler for text, date, and checkbox form changes
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

  // Submit handler: package selected employee ids (for new) or single employee id (for edit) along with form metadata
  function submit(ev) {
    ev.preventDefault();

    if (initial) {
      onSubmit({
        id: form.id,
        kpi_metric_id: Number(kpiId),
        employee_id: Number(initial.employee_id),
        team: form.team || null,
        is_primary: !!form.is_primary,
        assigned_from: form.assigned_from || null,
        assigned_to: form.assigned_to || null,
      });
    } else {
      onSubmit({
        kpi_metric_id: Number(kpiId),
        employee_ids: selectedEmployeeIds,
        team: form.team || null,
        is_primary: !!form.is_primary,
        assigned_from: form.assigned_from || null,
        assigned_to: form.assigned_to || null,
      });
    }
  }

  // Filter and sort eligible employees based on role restrictions
  const eligibleEmployees = currentUser && employees
    .filter((e) => {
      // If the logged-in user is a manager, restrict options to their direct reports or themselves
      if (currentUser.role === "manager") {
        return Number(e.managerId) === Number(currentUser.id) || Number(e.id) === Number(currentUser.id);
      }
      // Admins and other roles see all system employees
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <form onSubmit={submit}>
      <div className="form-grid">

        {/* If editing an assignment, render the employee name as read-only */}
        {initial ? (
          <Field label="Employee" required>
            <input
              type="text"
              className="input"
              value={initial.employee_name || ""}
              disabled
              style={{ background: "var(--surface-2)", cursor: "not-allowed" }}
            />
          </Field>
        ) : (
          /* If creating new assignments, render the alphabetical multi-select checkbox grid */
          <div className="field field--full">
            {isTeamKpi && hasExistingAssignment && !initial && (
              <div style={{
                padding: "0.75rem",
                background: "#fff8e1",
                border: "1px solid #ffe082",
                borderRadius: "var(--r-sm)",
                color: "#b78103",
                fontSize: "0.85rem",
                marginBottom: "1rem"
              }}>
                <strong>Team KPI Constraints:</strong> This is a Team KPI and is already assigned to a team member. To assign it to a different member, please delete the existing assignment first.
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.45rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink-soft)" }}>
                Select Employee {isTeamKpi ? "(Choose One)" : "s"} <span style={{ color: "var(--bad)" }}>*</span>
              </label>
              {!isTeamKpi && (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", height: "auto" }}
                    onClick={() => {
                      // Select all employees who are not already assigned to this KPI
                      const assignable = eligibleEmployees.filter(e => !isAlreadyAssigned(e.id));
                      setSelectedEmployeeIds(assignable.map(e => e.id));
                    }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", height: "auto" }}
                    onClick={() => setSelectedEmployeeIds([])}
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            <div className="employee-checkbox-grid" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "0.75rem",
              maxHeight: "200px",
              overflowY: "auto",
              border: "1px solid var(--rule-strong)",
              borderRadius: "var(--r-sm)",
              padding: "0.75rem",
              background: "var(--surface-2)"
            }}>
              {eligibleEmployees && eligibleEmployees.map((e) => {
                const assigned = isAlreadyAssigned(e.id);
                const isChecked = assigned || selectedEmployeeIds.includes(e.id);
                const isDisabled = assigned || (isTeamKpi && hasExistingAssignment && !initial);

                return (
                  <div key={e.id} className="check-row" style={{ opacity: isDisabled ? 0.75 : 1 }}>
                    <input
                      id={`emp-chk-${e.id}`}
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={(evt) => {
                        if (evt.target.checked) {
                          if (isTeamKpi) {
                            setSelectedEmployeeIds([e.id]);
                          } else {
                            setSelectedEmployeeIds((prev) => [...prev, e.id]);
                          }
                        } else {
                          setSelectedEmployeeIds((prev) => prev.filter((id) => id !== e.id));
                        }
                      }}
                    />
                    <label
                      htmlFor={`emp-chk-${e.id}`}
                      style={{
                        color: assigned ? "var(--muted)" : "var(--ink-soft)",
                        textDecoration: assigned ? "line-through" : "none",
                        cursor: assigned ? "not-allowed" : "pointer"
                      }}
                    >
                      {e.name} {assigned && <span style={{ fontSize: "0.7rem", color: "var(--muted)", textDecoration: "none", display: "inline-block" }}>(Assigned)</span>}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Field label="Team">
          <select
            className="select"
            value={form.team || ""}
            onChange={set("team")}
          >
            <option value="">Select Team...</option>
            <option value="Scrum">Scrum</option>
            <option value="Kanban">Kanban</option>
            <option value="Intern">Intern</option>
          </select>
        </Field>

        <Field label="Assigned From">
          <input
            type="date"
            className="input"
            value={form.assigned_from || ""}
            onChange={set("assigned_from")}
          />
        </Field>

        <Field label="Assigned To">
          <input
            type="date"
            className="input"
            value={form.assigned_to || ""}
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

        {/* Disable the button if saving is in progress, or if creating a new assignment and no employees are selected, or if Team KPI is already assigned */}
        <button
          type="submit"
          className="btn btn--primary"
          disabled={saving || (!initial && selectedEmployeeIds.length === 0) || (isTeamKpi && hasExistingAssignment && !initial)}
        >
          {saving ? "Saving…" : "Save Assignment"}
        </button>
      </div>
    </form>
  );
}