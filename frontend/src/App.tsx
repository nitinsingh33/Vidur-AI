import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { Dashboard } from "./pages/Dashboard";
import { RecoveryCaseDetails } from "./pages/RecoveryCaseDetails";
import { Landing } from "./pages/Landing";
import "./index.css";

function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        <Topbar />

        <main className="page-content">
          <Routes>
            <Route path="/" element={<Landing />} />

            <Route path="/dashboard" element={<Dashboard />} />

            <Route
              path="/recovery-cases"
              element={<Dashboard showRecoveryCases />}
            />

            <Route
              path="/recovery-cases/:recoveryCaseId"
              element={<RecoveryCaseDetails />}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
