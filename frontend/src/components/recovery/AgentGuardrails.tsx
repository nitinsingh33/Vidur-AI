import {
  Ban,
  CheckCircle2,
  CircleDashed,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type {
  GuardrailCheck,
  GuardrailStatus,
} from '../../lib/agentPipeline'

interface AgentGuardrailsProps {
  guardrails: GuardrailCheck[]
}

function isBlocked(check: GuardrailCheck) {
  return check.status === 'met' && /block/i.test(check.detail ?? '')
}

const STATUS: Record<GuardrailStatus, string> = {
  met: 'Satisfied',
  'not-applicable': 'Not applicable',
  pending: 'Pending',
}

function GuardrailIcon({ check }: { check: GuardrailCheck }) {
  if (isBlocked(check)) {
    return <Ban size={15} />
  }

  if (check.status === 'met') {
    return <CheckCircle2 size={15} />
  }

  return <CircleDashed size={15} />
}

export function AgentGuardrails({
  guardrails,
}: AgentGuardrailsProps) {
  const blockedCount = guardrails.filter(isBlocked).length
  const completedCount = guardrails.filter(
    (item) => item.status === 'met' && !isBlocked(item),
  ).length

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-secondary">
            <ShieldCheck size={15} className="text-muted-foreground" />
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Safety layer
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-foreground">
              Agent guardrails
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          {completedCount > 0 && (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-600 dark:text-emerald-400">
              {completedCount} passed
            </span>
          )}

          {blockedCount > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600 dark:text-amber-400">
              {blockedCount} blocked
            </span>
          )}
        </div>
      </header>

      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
        {guardrails.map((check) => {
          const blocked = isBlocked(check)

          return (
            <div
              key={check.key}
              className="bg-card p-4 transition-colors hover:bg-secondary/20"
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg',
                    blocked
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : check.status === 'met'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-secondary text-muted-foreground',
                  )}
                >
                  <GuardrailIcon check={check} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-foreground">
                      {check.label}
                    </p>

                    <span
                      className={cn(
                        'shrink-0 text-[9px] font-semibold uppercase tracking-wider',
                        blocked
                          ? 'text-amber-600 dark:text-amber-400'
                          : check.status === 'met'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-muted-foreground',
                      )}
                    >
                      {blocked ? 'Blocked' : STATUS[check.status]}
                    </span>
                  </div>

                  {check.detail && (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      {check.detail}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}