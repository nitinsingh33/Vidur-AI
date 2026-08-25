import { Bell, LogOut, Search, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Avatar, AvatarFallback } from '../ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
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
  const { user, merchant, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border px-6">
      <div className="flex h-9 max-w-sm flex-1 items-center gap-2 rounded-lg border border-input bg-secondary/50 px-3 text-sm text-muted-foreground">
        <Search size={15} strokeWidth={1.8} />
        <span className="flex-1 truncate">Search recovery cases...</span>
        <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Bell size={17} strokeWidth={1.8} />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />
        </button>

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
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
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
