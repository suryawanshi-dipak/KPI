import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Kpis from "./pages/Kpis";
import KpiDetail from "./pages/KpiDetail";
import Kras from "./pages/Kras";
import Measurements from "./pages/Measurements";
import Team from "./pages/Team";
import Employees from "./pages/Employees";
import Reports from "./pages/Reports";
import LoginScreen from "./pages/LoginScreen";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
       <Route path="/" element={<ProtectedRoute> <Dashboard /></ProtectedRoute> }
/>
        <Route path="/kpis" element={<ProtectedRoute><Kpis /></ProtectedRoute>} />
        <Route path="/kpis/:id" element={<ProtectedRoute><KpiDetail /></ProtectedRoute>} />
        <Route path="/kras" element={<ProtectedRoute><Kras /></ProtectedRoute> } />
        <Route path="/measurements" element={<ProtectedRoute><Measurements /></ProtectedRoute>} />
        <Route path="/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/login" element={<LoginScreen />}
/>
      </Routes>
    </BrowserRouter>
  );
}

