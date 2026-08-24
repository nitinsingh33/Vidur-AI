import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { Dashboard } from './pages/Dashboard'
import { Landing } from './pages/Landing'
import { RecoveryCaseDetails } from './pages/RecoveryCaseDetails'
import './index.css'

function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        <Topbar />

        <main className="page-content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />

            <Route
              path="/recovery-cases"
              element={<Dashboard showRecoveryCases />}
            />

            <Route
              path="/recovery-cases/:recoveryCaseId"
              element={<RecoveryCaseDetails />}
            />

            <Route
              path="*"
              element={<Navigate to="/dashboard" replace />}
            />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />

        <Route path="/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App