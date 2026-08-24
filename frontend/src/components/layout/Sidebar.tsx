import './Sidebar.css'
import {
  Activity,
  BarChart3,
  Bot,
  LayoutDashboard,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const navigation = [
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
    label: 'Agent Activity',
    icon: Bot,
    path: '/agent-activity',
  },
  {
    label: 'Analytics',
    icon: BarChart3,
    path: '/analytics',
  },
]

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

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

          const active =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)

          return (
            <button
              key={item.label}
              className={`nav-item ${active ? 'active' : ''}`}
              type="button"
              onClick={() => navigate(item.path)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-bottom">
        <button
          className="nav-item"
          type="button"
          onClick={() => navigate('/policies')}
        >
          <ShieldCheck size={18} strokeWidth={1.8} />
          <span>Policies</span>
        </button>

        <button
          className="nav-item"
          type="button"
          onClick={() => navigate('/settings')}
        >
          <Settings size={18} strokeWidth={1.8} />
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