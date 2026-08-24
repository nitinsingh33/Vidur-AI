import './Topbar.css'
import { Bell, Search } from 'lucide-react'

export function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar-search">
        <Search size={17} strokeWidth={1.8} />
        <span>Search recovery cases...</span>
        <kbd>⌘ K</kbd>
      </div>

      <div className="topbar-actions">
        <button
          className="icon-button"
          type="button"
          aria-label="Notifications"
        >
          <Bell size={18} strokeWidth={1.8} />
          <span className="notification-dot" />
        </button>

        <div className="profile">
          <div className="avatar">NS</div>

          <div className="profile-info">
            <span className="profile-name">Nitin Singh</span>
            <span className="profile-role">Administrator</span>
          </div>
        </div>
      </div>
    </header>
  )
}