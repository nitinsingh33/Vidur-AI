import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Bell, LogOut, Search, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getAuditLog, type AuditLogEntry } from '../../api/audit'
import { useAuth } from '../../context/AuthContext'
import { formatLabel } from '../../lib/status'
import { Avatar, AvatarFallback } from '../ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Topbar() {
  const { token, user, merchant, logout } = useAuth()
  const navigate = useNavigate()
  const searchRef = useRef<HTMLInputElement>(null)
  const [searchValue, setSearchValue] = useState('')
  const [notifications, setNotifications] = useState<AuditLogEntry[]>([])

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!token) return

    getAuditLog(token, 1, 5)
      .then((response) => setNotifications(response.data))
      .catch(() => setNotifications([]))
  }, [token])

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      navigate('/recovery-cases')
    }
  }

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border px-6">
      <div className="flex h-9 max-w-sm flex-1 items-center gap-2 rounded-lg border border-input bg-secondary/50 px-3 text-sm text-muted-foreground focus-within:border-ring">
        <Search size={15} strokeWidth={1.8} />
        <input
          ref={searchRef}
          type="text"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search recovery cases..."
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Notifications"
            className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Bell size={17} strokeWidth={1.8} />
            {notifications.length > 0 && (
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Recent agent activity</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                No activity yet.
              </div>
            ) : (
              notifications.map((entry) => (
                <DropdownMenuItem
                  key={entry.id}
                  onClick={() =>
                    entry.recoveryCaseId &&
                    navigate(`/recovery-cases/${entry.recoveryCaseId}`)
                  }
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {formatLabel(entry.action)}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  </div>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/agent-activity')}>
              View all activity
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 outline-none transition-colors hover:bg-secondary">
            <Avatar size="sm">
              <AvatarFallback className="bg-primary/15 text-primary">
                {user ? initials(user.name) : '··'}
              </AvatarFallback>
            </Avatar>

            <div className="hidden text-left leading-tight sm:block">
              <div className="text-xs font-medium text-foreground">
                {user?.name ?? 'Loading…'}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {merchant?.name ?? ''}
              </div>
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings size={15} />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={logout}>
              <LogOut size={15} />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
