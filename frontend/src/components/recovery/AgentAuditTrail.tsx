import {
  CheckCircle2,
  Circle,
  ListChecks,
  ShieldAlert,
} from 'lucide-react'
import type { AuditLogEntry } from '../../api/audit'
import { describeAuditEvent } from '../../lib/auditTrail'
import { cn } from '../../lib/utils'

interface AgentAuditTrailProps {
  entries: AuditLogEntry[]
}

const AMBER_ACTIONS = new Set([
  'RECOVERY_ESCALATED',
  'RECOVERY_EXHAUSTED',
  'RECOVERY_ACTION_BLOCKED',
])

const EMERALD_ACTIONS = new Set(['RECOVERY_SUCCEEDED'])

function eventTone(action: string) {
  if (EMERALD_ACTIONS.has(action)) {
    return {
      dot: 'bg-emerald-500',
      icon: CheckCircle2,
      iconClass: 'text-emerald-500',
      line: 'bg-emerald-500/15',
    }
  }

  if (AMBER_ACTIONS.has(action)) {
    return {
      dot: 'bg-amber-500',
      icon: ShieldAlert,
      iconClass: 'text-amber-500',
      line: 'bg-amber-500/15',
    }
  }

  return {
    dot: 'bg-muted-foreground/50',
    icon: Circle,
    iconClass: 'text-muted-foreground',
    line: 'bg-border',
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function AgentAuditTrail({
  entries,
}: AgentAuditTrailProps) {
  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-secondary">
            <ListChecks size={15} className="text-muted-foreground" />
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Compliance
            </p>
            <h2 className="mt-0.5 text-sm font-semibold text-foreground">
              Agent audit trail
            </h2>
          </div>
        </div>

        <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
          {entries.length} {entries.length === 1 ? 'event' : 'events'}
        </span>
      </header>

      <div className="p-5 sm:p-6">
        {entries.length === 0 ? (
          <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/20">
            <p className="text-sm text-muted-foreground">
              No audit events recorded for this case yet.
            </p>
          </div>
        ) : (
          <div>
            {entries.map((entry, index) => {
              const view = describeAuditEvent(entry)
              const tone = eventTone(entry.action)
              const Icon = tone.icon

              return (
                <div
                  key={entry.id}
                  className="relative flex gap-4 pb-7 last:pb-0"
                >
                  {index < entries.length - 1 && (
                    <span
                      className={cn(
                        'absolute left-[15px] top-8 h-[calc(100%-8px)] w-px',
                        tone.line,
                      )}
                    />
                  )}

                  <div
                    className={cn(
                      'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-sm',
                      tone.iconClass,
                    )}
                  >
                    <Icon size={14} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <strong className="text-sm font-semibold text-foreground">
                        {view.title}
                      </strong>

                      <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                        <span>{formatDate(entry.createdAt)}</span>
                        <span className="opacity-40">•</span>
                        <span>{formatTime(entry.createdAt)}</span>
                      </div>
                    </div>

                    {view.lines.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {view.lines.map((line, lineIndex) => (
                          <p
                            key={lineIndex}
                            className="text-xs leading-relaxed text-muted-foreground"
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}