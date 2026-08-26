import {
  Activity,
  BarChart3,
  Bot,
  LayoutDashboard,
  Layers,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'

const navigation = [
  { label: 'Overview', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Recovery Cases', icon: Activity, path: '/recovery-cases' },
  { label: 'Batches', icon: Layers, path: '/batches' },
  { label: 'Agent Activity', icon: Bot, path: '/agent-activity' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
]

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 md:flex">
      <a
        href="/"
        className="mb-8 flex items-center px-2"
      >
        <img
          src="/brand_logo.png"
          alt="Vidur AI"
          className="h-9 w-auto shrink-0"
        />
      </a>

      <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Workspace
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {navigation.map((item) => {
          const active =
            location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path))

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.path)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
              )}
            >
              <item.icon size={17} strokeWidth={1.8} />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="mt-4 flex flex-col gap-0.5 border-t border-sidebar-border pt-4">
        <button
          type="button"
          onClick={() => navigate('/policies')}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <ShieldCheck size={17} strokeWidth={1.8} />
          Policies
        </button>

        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <Settings size={17} strokeWidth={1.8} />
          Settings
        </button>

        <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
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
      </div>
    </aside>
  )
}
