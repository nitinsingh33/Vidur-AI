import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, ChevronLeft, ChevronRight, Cpu } from 'lucide-react'
import { getAuditLog, type AuditLogEntry } from '../api/audit'
import { Skeleton } from '../components/ui/skeleton'
import { StatusBadge } from '../components/ui/status-badge'
import { useAuth } from '../context/AuthContext'
import { formatLabel } from '../lib/status'

const PAGE_SIZE = 20

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function AgentActivity() {
  const { token } = useAuth()
  const navigate = useNavigate()

  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const response = await getAuditLog(token as string, page, PAGE_SIZE)
        setEntries(response.data)
        setTotalPages(response.pagination.totalPages)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load agent activity.',
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token, page])

  return (
    <section className="pb-12">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Recovery intelligence
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
          Agent Activity
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
          Every decision, policy evaluation, and action Vidur has taken —
          in order, with full context.
        </p>
      </div>

      {loading && (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot size={18} />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            No agent activity yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once Vidur starts evaluating recovery cases, every decision will
            show up here.
          </p>
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="mt-8 space-y-0">
          {entries.map((entry, index) => (
            <div key={entry.id} className="relative flex gap-3.5 pb-6 last:pb-0">
              {index < entries.length - 1 && (
                <span className="absolute left-4 top-8 bottom-0 w-px bg-border" />
              )}

              <div className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                {entry.actorType === 'AGENT' ? (
                  <Bot size={16} />
                ) : (
                  <Cpu size={16} />
                )}
              </div>

              <button
                type="button"
                disabled={!entry.recoveryCaseId}
                onClick={() =>
                  entry.recoveryCaseId &&
                  navigate(`/recovery-cases/${entry.recoveryCaseId}`)
                }
                className="min-w-0 flex-1 rounded-xl border border-border bg-card p-4 text-left transition-colors enabled:hover:border-primary/30 disabled:cursor-default"
              >
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <strong className="text-sm font-semibold text-foreground">
                      {formatLabel(entry.action)}
                    </strong>
                    <StatusBadge label={entry.actorType} tone="sky" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(entry.createdAt)}
                  </span>
                </div>

                {entry.details && (
                  <p className="mt-1.5 truncate text-sm text-muted-foreground">
                    {Object.entries(entry.details)
                      .map(([key, value]) => `${formatLabel(key)}: ${value}`)
                      .join(' · ')}
                  </p>
                )}

                {entry.recoveryCaseId && (
                  <p className="mt-1.5 break-all font-mono text-[11px] text-muted-foreground/70">
                    Case {entry.recoveryCaseId}
                  </p>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>

          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </section>
  )
}
