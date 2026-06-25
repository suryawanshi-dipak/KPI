import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Kpis from "./pages/Kpis";
import KpiDetail from "./pages/KpiDetail";
import Kras from "./pages/Kras";
import Measurements from "./pages/Measurements";
import Team from "./pages/Team";
import Employees from "./pages/Employees";
import Reports from "./pages/Reports";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/kpis" element={<Kpis />} />
        <Route path="/kpis/:id" element={<KpiDetail />} />
        <Route path="/kras" element={<Kras />} />
        <Route path="/measurements" element={<Measurements />} />
        <Route path="/team" element={<Team />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </BrowserRouter>
  );
}
