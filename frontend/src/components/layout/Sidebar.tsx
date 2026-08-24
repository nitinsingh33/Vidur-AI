import './Sidebar.css'
import {
  Activity,
  BarChart3,
  Bot,
  LayoutDashboard,
  Settings,
  ShieldCheck,
} from 'lucide-react'

interface SidebarProps {
  onOpenOverview: () => void
  onOpenRecoveryCases: () => void
}

const navigation = [
  {
    label: 'Overview',
    icon: LayoutDashboard,
  },
  {
    label: 'Recovery Cases',
    icon: Activity,
  },
  {
    label: 'Agent Activity',
    icon: Bot,
  },
  {
    label: 'Analytics',
    icon: BarChart3,
  },
]

export function Sidebar({
  onOpenOverview,
  onOpenRecoveryCases,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">V</div>

        <div>
          <div className="brand-name">Vidur AI</div>
          <div className="brand-caption">
            Revenue Recovery
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">
          Workspace
        </div>

        {navigation.map((item) => {
          const Icon = item.icon

          const handleClick =
            item.label === 'Overview'
              ? onOpenOverview
              : item.label === 'Recovery Cases'
                ? onOpenRecoveryCases
                : undefined

          return (
            <button
              key={item.label}
              className={`nav-item ${
                item.label === 'Overview'
                  ? 'active'
                  : ''
              }`}
              type="button"
              onClick={handleClick}
            >
              <Icon
                size={18}
                strokeWidth={1.8}
              />

              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-bottom">
        <button
          className="nav-item"
          type="button"
        >
          <ShieldCheck
            size={18}
            strokeWidth={1.8}
          />

          <span>Policies</span>
        </button>

        <button
          className="nav-item"
          type="button"
        >
          <Settings
            size={18}
            strokeWidth={1.8}
          />

          <span>Settings</span>
        </button>

        <div className="agent-status">
          <span className="status-dot" />

          <div>
            <div className="status-title">
              Agent operational
            </div>

            <div className="status-subtitle">
              All systems running
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}