import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Modal, Spinner, Toast } from "../components/UI";
import { Icon } from "../components/Icon";
import EmployeeForm from "../forms/EmployeeForm";
import { listEmployees, saveEmployee, employeeName } from "../lib/store";

const ROLE_TAG = { admin:"Admin", manager:"Manager", employee:"Employee", hr:"HR" };

export default function Employees() {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [q, setQ] = useState("");

  const load = () => listEmployees().then(setRows);
  useEffect(() => { load(); }, []);
  function flash(m){ setToast(m); setTimeout(()=>setToast(null),2400); }
  async function handleSave(p){ setSaving(true); await saveEmployee(p); setSaving(false); setEditing(null); await load(); flash(p.id?"Employee updated":"Employee added"); }

  if (!rows) return <Layout crumb={<b>Employees</b>}><Spinner /></Layout>;

  const filtered = rows.filter((e) => (e.name||"").toLowerCase().includes(q.toLowerCase())
    || (e.email||"").toLowerCase().includes(q.toLowerCase())
    || (e.employee_id||"").toLowerCase().includes(q.toLowerCase()));

  return (
    <Layout crumb={<><span>Administration</span> · <b>Employees</b></>}>
      <div className="page-head">
        <div><h1>Employees</h1><p>Team members, roles, and reporting lines.</p></div>
      </div>

      <div className="filter-bar">
        <div className="search"><Icon.search /><input placeholder="Search name, email, or ID…" value={q} onChange={(e)=>setQ(e.target.value)} /></div>
        <span className="tag">{filtered.length} of {rows.length}</span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Name</th><th>Employee ID</th><th>Role</th><th>Department</th><th>Reports to</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td><div className="cell-strong">{e.name}</div><div className="cell-sub">{e.email}</div></td>
                  <td className="mono">{e.employee_id}</td>
                  <td><span className="tag">{ROLE_TAG[e.role] || e.role}</span></td>
                  <td className="cell-sub">{e.department || "—"}</td>
                  <td className="cell-sub">{e.manager_id ? employeeName(e.manager_id) : "—"}</td>
                  <td><span className="cell-sub" style={{ textTransform:"capitalize" }}>{e.status}</span></td>
                  <td><button className="icon-btn" title="Edit" onClick={() => setEditing(e)}><Icon.edit /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal title={editing.id ? "Edit employee" : "Add employee"}
          subtitle={editing.id ? editing.name : "Create a team member account"}
          onClose={() => setEditing(null)} wide>
          <EmployeeForm initial={editing.id ? editing : null} saving={saving}
            onSubmit={handleSave} onCancel={() => setEditing(null)} />
        </Modal>
      )}
      {toast && <Toast message={toast} />}
    </Layout>
  );
}
