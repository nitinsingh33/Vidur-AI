import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { Dashboard } from './pages/Dashboard'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { SignUp } from './pages/SignUp'
import { RecoveryCaseDetails } from './pages/RecoveryCaseDetails'
import { RecoveryBatches } from './pages/RecoveryBatches'
import './index.css'

function AppShell() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <main className="flex-1 overflow-x-hidden px-6 py-8 md:px-10">
          <div className="mx-auto max-w-[1400px]">
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

              <Route path="/batches" element={<RecoveryBatches />} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />

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
