import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Icon } from "./Icon";

const NAV = [
  { to: "/", label: "Dashboard", icon: Icon.dashboard, end: true },
  { to: "/kpis", label: "KPIs", icon: Icon.kpi },
  { to: "/kras", label: "KRA Areas", icon: Icon.kra },
  { to: "/measurements", label: "Measurements", icon: Icon.measure },
  { to: "/team", label: "Team", icon: Icon.team },
];
const ADMIN_NAV = [
  { to: "/employees", label: "Employees", icon: Icon.team },
  { to: "/reports", label: "Reports", icon: Icon.reports },
];

export default function Layout({ crumb, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="app">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark">📊</span> KPI Monitor
        </div>
        <nav className="sidebar__nav" onClick={() => setOpen(false)}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <n.icon /> {n.label}
            </NavLink>
          ))}
          <div className="nav-section">Administration</div>
          {ADMIN_NAV.map((n) => (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <n.icon /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__foot">
          Vitec · FY2026-27<br />Frontend preview build
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <button className="menu-toggle" onClick={() => setOpen((o) => !o)} aria-label="Menu">
              <Icon.menu style={{ width: 18, height: 18 }} />
            </button>
            <div className="topbar__crumb">{crumb}</div>
          </div>
          <div className="topbar__right">
            <div className="avatar">KC</div>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
