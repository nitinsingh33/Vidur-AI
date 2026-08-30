import {
  Activity,
  BarChart3,
  Bot,
  LayoutDashboard,
  Layers,
  ShieldCheck,
  ShoppingCart,
  Settings as SettingsIcon,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'

interface NavItem {
  label: string
  icon: LucideIcon
  path: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Monitor',
    items: [
      {
        label: 'Overview',
        icon: LayoutDashboard,
        path: '/dashboard',
      },
      {
        label: 'Recovery Cases',
        icon: Activity,
        path: '/recovery-cases',
      },
      {
        label: 'Recovery Batches',
        icon: Layers,
        path: '/batches',
      },
      {
        label: 'Checkout Drop-off',
        icon: ShoppingCart,
        path: '/checkout-dropoff',
      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        label: 'AI Decisions',
        icon: Bot,
        path: '/agent-activity',
      },
      {
        label: 'Analytics',
        icon: BarChart3,
        path: '/analytics',
      },
    ],
  },
  {
    label: 'Configure',
    items: [
      {
        label: 'Recovery Policies',
        icon: ShieldCheck,
        path: '/policies',
      },
    ],
  },
  {
    label: 'Live Test',
    items: [
      {
        label: 'Razorpay Live Demo',
        icon: Zap,
        path: '/demo-detection',
      },
    ],
  },
  {
    label: 'Workspace',
    items: [
      {
        label: 'Settings',
        icon: SettingsIcon,
        path: '/settings',
      },
    ],
  },
]

interface SidebarNavProps {
  onNavigate?: () => void
}

function SidebarNav({ onNavigate }: SidebarNavProps) {
  const navigate = useNavigate()
  const location = useLocation()

  function go(path: string) {
    navigate(path)
    onNavigate?.()
  }

  return (
    <nav className="flex flex-1 flex-col gap-7">
      {navGroups.map((group) => (
        <div key={group.label}>
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
            {group.label}
          </div>

          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                location.pathname === item.path ||
                location.pathname.startsWith(`${item.path}/`)

              const Icon = item.icon

              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => go(item.path)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium outline-none transition-all duration-150',
                    active
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                  )}

                  <Icon
                    size={17}
                    strokeWidth={1.8}
                    className={cn(
                      'shrink-0 transition-colors',
                      active
                        ? 'text-primary'
                        : 'text-muted-foreground group-hover:text-foreground',
                    )}
                  />

                  <span className="truncate">
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  useEffect(() => {
    if (!mobileOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onMobileClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen, onMobileClose])

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-[232px] shrink-0 border-r border-border bg-background md:flex md:min-h-screen md:flex-col">
        <div className="flex h-[68px] items-center border-b border-border px-5">
          <a
            href="/"
            aria-label="Vidur AI home"
            className="flex items-center rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src="/brand.png"
              alt="Vidur AI"
              className="h-9 w-auto shrink-0"
            />
          </a>
        </div>

        <div className="flex flex-1 flex-col px-3 py-7">
          <SidebarNav />
        </div>
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-foreground/20 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={onMobileClose}
              aria-hidden="true"
            />

            <motion.aside
              id="mobile-sidebar-nav"
              role="dialog"
              aria-label="Navigation"
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-background md:hidden"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{
                duration: 0.2,
                ease: 'easeOut',
              }}
            >
              <div className="flex h-[68px] items-center border-b border-border px-5">
                <a
                  href="/"
                  className="flex items-center"
                  onClick={onMobileClose}
                  aria-label="Vidur AI home"
                >
                  <img
                    src="/brand.png"
                    alt="Vidur AI"
                    className="h-9 w-auto shrink-0"
                  />
                </a>
              </div>

              <div className="flex flex-1 flex-col px-3 py-7">
                <SidebarNav onNavigate={onMobileClose} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}