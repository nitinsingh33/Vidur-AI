import {
  BrainCircuit,
  CheckCircle2,
  ShieldAlert,
  Target,
  TrendingUp,
} from 'lucide-react'
import type { RecoveryCase } from '../../api/recoveryCases'
import { formatAmount, formatLabel } from '../../lib/status'
import { cn } from '../../lib/utils'

interface AgentReasoningCardProps {
  recoveryCase: RecoveryCase
}

export function AgentReasoningCard({
  recoveryCase,
}: AgentReasoningCardProps) {
  if (!recoveryCase.aiReasoning) return null

  const selectedIntervention = recoveryCase.actions.find(
    (action) => action.type !== 'ESCALATE_HUMAN',
  )

  const confidence = Math.round(
    Number(recoveryCase.recoveryProbability) * 100,
  )

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-sm">
      <header className="relative overflow-hidden border-b border-primary/10 bg-gradient-to-br from-primary/[0.08] via-primary/[0.025] to-transparent px-5 py-5 sm:px-6">
        <div className="absolute -right-16 -top-16 size-40 rounded-full bg-primary/[0.07] blur-3xl" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <BrainCircuit size={19} />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                Vidur AI
              </p>
              <h2 className="mt-0.5 text-[15px] font-semibold text-foreground">
                Decision reasoning
              </h2>
            </div>
          </div>

          <span className="hidden items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-[10px] font-medium text-primary sm:flex">
            <span className="size-1.5 rounded-full bg-primary" />
            Gemini generated
          </span>
        </div>
      </header>

      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Target size={14} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Why at risk
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {formatLabel(recoveryCase.rootCause)}
          </p>
        </div>

        <div className="bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 size={14} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Intervention
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {selectedIntervention
              ? formatLabel(selectedIntervention.type)
              : 'No intervention'}
          </p>
        </div>

        <div className="bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp size={14} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Recovery confidence
            </span>
          </div>

          <div className="mt-2 flex items-end gap-2">
            <p className="text-xl font-semibold tracking-tight text-foreground">
              {confidence}%
            </p>
            <div className="mb-1 h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(confidence, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldAlert size={14} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Risk implication
            </span>
          </div>

          <p className="mt-2 text-sm font-semibold text-foreground">
            {formatLabel(recoveryCase.riskLevel)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatAmount(recoveryCase.revenueAtRisk)} exposed
          </p>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="rounded-xl border border-border bg-secondary/25 p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              AI analysis
            </span>
          </div>

          <p
            className={cn(
              'max-w-4xl text-[14px] leading-7 text-foreground/85',
              'sm:text-[15px]',
            )}
          >
            {recoveryCase.aiReasoning}
          </p>
        </div>
      </div>
    </section>
  )
}