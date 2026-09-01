import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Analytics as VercelAnalytics } from '@vercel/analytics/react'

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
import { CheckoutDropOff } from './pages/CheckoutDropOff'
import { Receivables } from './pages/Receivables'
import { PromiseToPay } from './pages/PromiseToPay'
import { Subscriptions } from './pages/Subscriptions'
import { Mandates } from './pages/Mandates'
import { AgentActivity } from './pages/AgentActivity'
import { Analytics } from './pages/Analytics'
import { Policies } from './pages/Policies'
import { Settings } from './pages/Settings'
import { DemoDetection } from './pages/DemoDetection'
import { RecoveryLab } from './pages/RecoveryLab'

import { StoreLayout } from './pages/store/StoreLayout'
import { StoreHome } from './pages/store/StoreHome'
import { ProductDetail } from './pages/store/ProductDetail'
import { CartPage } from './pages/store/CartPage'
import { CheckoutPage } from './pages/store/CheckoutPage'

import './index.css'

function DocumentTitle() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (pathname === '/dashboard') {
      document.title = 'Vidur Dashboard'
      return
    }

    if (pathname.startsWith('/store/')) {
      document.title = 'FashionKart'
      return
    }

    const titleByPath: Array<[string, string]> = [
      ['/recovery-cases/', 'Recovery Case | Vidur AI'],
      ['/recovery-cases', 'Recovery Cases | Vidur AI'],
      ['/batches', 'Recovery Batches | Vidur AI'],
      ['/checkout-dropoff', 'Checkout Drop-off | Vidur AI'],
      ['/receivables', 'Receivables | Vidur AI'],
      ['/promise-to-pay', 'Promise to Pay | Vidur AI'],
      ['/subscriptions', 'Subscriptions | Vidur AI'],
      ['/mandates', 'Mandates | Vidur AI'],
      ['/agent-activity', 'AI Activity | Vidur AI'],
      ['/analytics', 'Analytics | Vidur AI'],
      ['/policies', 'Recovery Policies | Vidur AI'],
      ['/settings', 'Settings | Vidur AI'],
      ['/demo-detection', 'Razorpay Live Demo | Vidur AI'],
      ['/recovery-lab', 'Recovery Lab | Vidur AI'],
      ['/login', 'Sign in | Vidur AI'],
      ['/signup', 'Create workspace | Vidur AI'],
      ['/product', 'Product | Vidur AI'],
      ['/solutions', 'Solutions | Vidur AI'],
      ['/how-it-works', 'How It Works | Vidur AI'],
      ['/developers', 'Developers | Vidur AI'],
      ['/pricing', 'Pricing | Vidur AI'],
      ['/', 'Vidur AI'],
    ]

    const match = titleByPath.find(([path]) => pathname === path || pathname.startsWith(path))
    document.title = match?.[1] ?? 'Vidur AI'
  }, [pathname])

  return null
}

function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col min-h-screen bg-background">
        <Topbar
          onMenuClick={() => setMobileNavOpen(true)}
        />

        <main className="min-h-[calc(100vh-68px)] flex-1 overflow-x-hidden px-4 py-7 sm:px-6 md:px-8 lg:px-10 lg:py-8">
          <div className="mx-auto w-full max-w-[1400px]">
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

              <Route
                path="/checkout-dropoff"
                element={<CheckoutDropOff />}
              />

              <Route
                path="/receivables"
                element={<Receivables />}
              />

              <Route
                path="/promise-to-pay"
                element={<PromiseToPay />}
              />

              <Route
                path="/subscriptions"
                element={<Subscriptions />}
              />

              <Route
                path="/mandates"
                element={<Mandates />}
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

              {/* Development/demo-only: Feature #1 live detection demo */}
              <Route
                path="/demo-detection"
                element={<DemoDetection />}
              />

              {/* Recovery Lab: real-data scenario launcher */}
              <Route
                path="/recovery-lab"
                element={<RecoveryLab />}
              />

              {/* Unknown protected route */}
              <Route
                path="*"
                element={<Navigate to="/dashboard" replace />}
              />
            </Routes>
          </div>
        </main>

        <footer className="border-t border-border">
          <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between gap-2 px-4 py-4 text-center sm:flex-row sm:px-6 sm:text-left lg:px-10">
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
        <DocumentTitle />

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

          {/* ───────────────── Public storefront (e.g. FashionKart) ───────────────── */}

          <Route
            path="/store/:slug"
            element={<StoreLayout />}
          >
            <Route
              index
              element={<StoreHome />}
            />
            <Route
              path="product/:productId"
              element={<ProductDetail />}
            />
            <Route
              path="cart"
              element={<CartPage />}
            />
            <Route
              path="checkout"
              element={<CheckoutPage />}
            />
          </Route>

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
        <VercelAnalytics />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App