import {
  Activity,
  BarChart3,
  Bot,
  LayoutDashboard,
  Layers,
  ShieldCheck,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
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
      { label: 'Overview', icon: LayoutDashboard, path: '/dashboard' },
      { label: 'Recovery Cases', icon: Activity, path: '/recovery-cases' },
      { label: 'Recovery Batches', icon: Layers, path: '/batches' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'AI Decisions', icon: Bot, path: '/agent-activity' },
      { label: 'Analytics', icon: BarChart3, path: '/analytics' },
    ],
  },
  {
    label: 'Configure',
    items: [
      { label: 'Recovery Policies', icon: ShieldCheck, path: '/policies' },
    ],
  },
  {
    label: 'Workspace',
    items: [{ label: 'Settings', icon: SettingsIcon, path: '/settings' }],
  },
]

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

interface SidebarNavProps {
  onNavigate?: () => void
}

function SidebarNav({ onNavigate }: SidebarNavProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, merchant } = useAuth()

  function go(path: string) {
    navigate(path)
    onNavigate?.()
  }

  return (
    <>
      <nav className="flex flex-1 flex-col gap-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </div>

            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active =
                  location.pathname === item.path ||
                  location.pathname.startsWith(`${item.path}/`)

                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => go(item.path)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex items-center gap-2.5 rounded-lg py-2 pl-3 pr-3 text-left text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                    )}
                  >
                    {active && (
                      <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
                    )}
                    <item.icon size={17} strokeWidth={1.8} />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 flex flex-col gap-2 border-t border-sidebar-border pt-4">
        <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          <div className="leading-tight">
            <div className="text-xs font-medium text-sidebar-foreground">
              Agent operational
            </div>
            <div className="text-[11px] text-muted-foreground">
              All systems running
            </div>
          </div>
        </div>

        {user && merchant && (
          <button
            type="button"
            onClick={() => go('/settings')}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-sidebar-accent/60"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
              {initials(user.name)}
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-xs font-medium text-sidebar-foreground">
                {user.name}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {merchant.name}
              </div>
            </div>
          </button>
        )}
      </div>
    </>
  )
}

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  useEffect(() => {
    if (!mobileOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onMobileClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen, onMobileClose])

  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 md:flex">
        <a href="/" className="mb-8 flex items-center px-2">
          <img
            src="/brand_logo.png"
            alt="Vidur AI"
            className="h-9 w-auto shrink-0"
          />
        </a>

        <SidebarNav />
      </aside>

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
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 md:hidden"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <a
                href="/"
                className="mb-8 flex items-center px-2"
                onClick={onMobileClose}
              >
                <img
                  src="/brand_logo.png"
                  alt="Vidur AI"
                  className="h-9 w-auto shrink-0"
                />
              </a>

              <SidebarNav onNavigate={onMobileClose} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
