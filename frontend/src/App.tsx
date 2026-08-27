import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { ScrollToTop } from './components/layout/ScrollToTop'

import { Landing } from './pages/Landing'
import { Product } from './pages/Product'
import { Solutions } from './pages/Solutions'
import { HowItWorks } from './pages/HowItWorks'
import { Developers } from './pages/Developers'
import { Pricing } from './pages/Pricing'

import { Login } from './pages/Login'
import { SignUp } from './pages/SignUp'

import { Dashboard } from './pages/Dashboard'
import { RecoveryCaseDetails } from './pages/RecoveryCaseDetails'
import { RecoveryBatches } from './pages/RecoveryBatches'
import { AgentActivity } from './pages/AgentActivity'
import { Analytics } from './pages/Analytics'
import { Policies } from './pages/Policies'
import { Settings } from './pages/Settings'

import './index.css'

function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />

        <main className="flex-1 overflow-x-hidden px-6 py-8 md:px-10">
          <div className="mx-auto max-w-[1400px]">
            <Routes>
              {/* Dashboard */}
              <Route
                path="/dashboard"
                element={<Dashboard />}
              />

              {/* Recovery */}
              <Route
                path="/recovery-cases"
                element={<Dashboard showRecoveryCases />}
              />

              <Route
                path="/recovery-cases/:recoveryCaseId"
                element={<RecoveryCaseDetails />}
              />

              <Route
                path="/batches"
                element={<RecoveryBatches />}
              />

              {/* Agent */}
              <Route
                path="/agent-activity"
                element={<AgentActivity />}
              />

              {/* Analytics */}
              <Route
                path="/analytics"
                element={<Analytics />}
              />

              {/* Policies */}
              <Route
                path="/policies"
                element={<Policies />}
              />

              {/* Settings */}
              <Route
                path="/settings"
                element={<Settings />}
              />

              {/* Unknown protected route */}
              <Route
                path="*"
                element={<Navigate to="/dashboard" replace />}
              />
            </Routes>
          </div>
        </main>

        <footer className="border-t border-border px-6 py-4 md:px-10">
          <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
            <span className="text-xs text-muted-foreground">
              © 2026 Vidur AI
            </span>

            <span className="text-xs text-muted-foreground">
              Revenue recovery infrastructure for modern payment systems.
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* ───────────────── Public marketing ───────────────── */}

          <Route
            path="/"
            element={<Landing />}
          />

          <Route
            path="/product"
            element={<Product />}
          />

          <Route
            path="/solutions"
            element={<Solutions />}
          />

          <Route
            path="/how-it-works"
            element={<HowItWorks />}
          />

          <Route
            path="/developers"
            element={<Developers />}
          />

          <Route
            path="/pricing"
            element={<Pricing />}
          />

          {/* ───────────────── Authentication ───────────────── */}

          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/signup"
            element={<SignUp />}
          />

          {/* ───────────────── Protected application ───────────────── */}

          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App