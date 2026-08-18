import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { Icon } from "./Icon";
import { getCurrentUser } from "../lib/store";
import { logout } from "../api/auth";

const NAV = [
  { to: "/", label: "Dashboard", icon: Icon.dashboard, end: true },
  { to: "/kpis", label: "KPIs", icon: Icon.kpi },
  { to: "/kras", label: "KRA Areas", icon: Icon.kra },
  { to: "/measurements", label: "Measurements", icon: Icon.measure },
  { to: "/team", label: "Team", icon: Icon.team },
  { to: "/feedbacks", label: "KPI Feedbacks", icon: Icon.feedback },
];
const ADMIN_NAV = [
  { to: "/employees", label: "Employees", icon: Icon.team },
  { to: "/reports", label: "Reports", icon: Icon.reports },
];

export default function Layout({ crumb, children }) {
  const [open, setOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Fetch the logged-in user dynamically on component mount
  useEffect(() => {
    getCurrentUser().then(user => {
      setCurrentUser(user);
    });
  }, []);

  const isAdmin = currentUser?.role === "admin";
  const isManager = currentUser?.role === "manager";

  // Filter NAV items: hide Team dashboard for employees
  const visibleNav = NAV.filter(n => {
    if (n.to === "/team") {
      return isAdmin || isManager;
    }
    return true;
  });

  // Calculate dynamic initials for the logged-in user
  const initials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "—";

  return (
    <div className="app">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark">📊</span> KPI Monitor
        </div>
        <nav className="sidebar__nav" onClick={() => setOpen(false)}>
          {visibleNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <n.icon /> {n.label}
            </NavLink>
          ))}
          
          {/* Administration section only visible to Admins */}
          {isAdmin && (
            <>
              <div className="nav-section">Administration</div>
              {ADMIN_NAV.map((n) => (
                <NavLink key={n.to} to={n.to}
                  className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                  <n.icon /> {n.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        
        {/* Logout button at the bottom of the sidebar */}
        <button className="nav-item sidebar__logout" onClick={logout} title="Sign out of your session">
          <Icon.logout /> Logout
        </button>

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
            <div className="avatar" title={currentUser?.name || "Loading..."}>
              {initials}
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
