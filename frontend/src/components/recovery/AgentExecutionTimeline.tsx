import {
  Ban,
  CheckCircle2,
  Circle,
  CreditCard,
  Cpu,
  Eye,
  GitBranch,
  Loader2,
  ShieldCheck,
  TrendingUp,
  UserRound,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type {
  FinalOutcome,
  GuardrailCheck,
  PipelineStage,
} from '../../lib/agentPipeline'

interface AgentExecutionTimelineProps {
  stages: PipelineStage[]
  finalOutcome: FinalOutcome | null
  guardrails: GuardrailCheck[]
  running: boolean
}

type NodeTone = 'idle' | 'active' | 'done' | 'blocked' | 'warn'

interface HeroNode {
  key: string
  typeLabel: string
  Icon: LucideIcon
  tone: NodeTone
  value?: string
  caption?: string
}

const TONE: Record<
  NodeTone,
  {
    icon: string
    dot: string
    border: string
    glow: string
    label: string
  }
> = {
  idle: {
    icon: 'bg-white/[0.055] text-white/35',
    dot: 'bg-white/25',
    border: 'border-white/[0.08]',
    glow: '',
    label: 'text-white/35',
  },
  active: {
    icon: 'bg-primary/15 text-primary ring-1 ring-primary/30',
    dot: 'bg-primary',
    border: 'border-primary/25',
    glow: 'shadow-[0_0_28px_rgba(99,102,241,0.12)]',
    label: 'text-primary',
  },
  done: {
    icon: 'bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/25',
    dot: 'bg-emerald-400',
    border: 'border-emerald-400/15',
    glow: '',
    label: 'text-emerald-300',
  },
  blocked: {
    icon: 'bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/25',
    dot: 'bg-rose-400',
    border: 'border-rose-400/20',
    glow: '',
    label: 'text-rose-300',
  },
  warn: {
    icon: 'bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/25',
    dot: 'bg-amber-400',
    border: 'border-amber-400/15',
    glow: '',
    label: 'text-amber-300',
  },
}

function StateGlyph({ tone }: { tone: NodeTone }) {
  if (tone === 'done')
    return <CheckCircle2 className="size-3 text-emerald-300" />
  if (tone === 'active')
    return <Loader2 className="size-3 animate-spin text-primary" />
  if (tone === 'blocked')
    return <Ban className="size-3 text-rose-300" />
  if (tone === 'warn')
    return <XCircle className="size-3 text-amber-300" />
  return <Circle className="size-3 text-white/25" />
}

function toneFromStage(status: PipelineStage['status']): NodeTone {
  if (status === 'completed') return 'done'
  if (status === 'running') return 'active'
  if (status === 'failed') return 'warn'
  return 'idle'
}

export function AgentExecutionTimeline({
  stages,
  finalOutcome,
  guardrails,
  running,
}: AgentExecutionTimelineProps) {
  const [
    detected,
    risk,
    decision,
    diagnosis,
    execution,
    observation,
  ] = stages

  // agentPipeline.ts marks the diagnosis stage 'completed' both when Gemini
  // actually returned reasoning and when it didn't (best-effort — see
  // deriveAgentPipeline's diagnosisStage) — 'No diagnosis returned' is its
  // literal sentinel for the latter. Distinguish them here so the UI never
  // claims reasoning is ready when aiReasoning is actually null.
  const hasRealDiagnosis =
    diagnosis.status === 'completed' &&
    diagnosis.detail !== 'No diagnosis returned'

  const policyCheck = guardrails.find((g) => g.key === 'policy')
  const policyDecision =
    policyCheck?.detail?.replace('Decision: ', '') ?? null

  const policyTone: NodeTone =
    policyDecision === 'Block'
      ? 'blocked'
      : policyDecision === 'Require Approval'
        ? 'warn'
        : policyDecision === 'Allow'
          ? 'done'
          : running
            ? 'active'
            : 'idle'

  const nodes: HeroNode[] = [
    {
      key: 'payment',
      typeLabel: 'Payment',
      Icon: CreditCard,
      tone: toneFromStage(detected.status),
      value: detected.value,
      caption: detected.detail,
    },
    {
      key: 'risk',
      typeLabel: 'Risk',
      Icon: TrendingUp,
      tone: toneFromStage(risk.status),
      value: risk.value,
      caption: risk.detail,
    },
    {
      key: 'decision',
      typeLabel: 'Decision',
      Icon: GitBranch,
      tone: toneFromStage(decision.status),
      value: decision.value,
      caption: decision.detail,
    },
    {
      key: 'ai',
      typeLabel: 'AI diagnosis',
      Icon: Cpu,
      tone: toneFromStage(diagnosis.status),
      value:
        diagnosis.status === 'completed'
          ? 'Diagnosed'
          : diagnosis.status === 'running'
            ? 'Thinking…'
            : undefined,
      caption:
        diagnosis.status === 'completed'
          ? hasRealDiagnosis
            ? 'Gemini reasoning ready'
            : 'No diagnosis returned'
          : diagnosis.detail,
    },
    {
      key: 'guardrail',
      typeLabel: 'Policy',
      Icon: ShieldCheck,
      tone: policyTone,
      value: policyDecision ?? undefined,
      caption: policyDecision ? 'Policy evaluated' : undefined,
    },
    {
      key: 'execute',
      typeLabel: 'Execution',
      Icon: Zap,
      tone: toneFromStage(execution.status),
      value:
        execution.status === 'completed'
          ? 'Executed'
          : execution.status === 'failed'
            ? 'Failed'
            : execution.status === 'running'
              ? 'Executing'
              : execution.detail
                ? 'Skipped'
                : undefined,
      caption:
        execution.status === 'pending'
          ? execution.detail?.replace(/^Skipped — /, '')
          : undefined,
    },
    {
      key: 'observe',
      typeLabel: 'Observation',
      Icon: Eye,
      tone: toneFromStage(observation.status),
      value: observation.value,
      caption: observation.detail,
    },
    {
      key: 'final',
      typeLabel:
        finalOutcome?.kind === 'escalated'
          ? 'Human review'
          : finalOutcome?.kind === 'recovered'
            ? 'Recovered'
            : 'Outcome',
      Icon:
        finalOutcome?.kind === 'escalated' ? UserRound : CheckCircle2,
      tone: finalOutcome
        ? finalOutcome.kind === 'recovered'
          ? 'done'
          : 'warn'
        : 'idle',
      // Prefer the recovered ₹ figure as the headline value (matching how
      // the Payment/Risk cards lead with an amount) — fall back to the
      // outcome label for an escalated case, which has no amount to show.
      value: finalOutcome?.amount ?? finalOutcome?.label,
      caption: finalOutcome?.detail,
    },
  ]

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0d12] text-white shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
      <header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-white/[0.06]">
            <Cpu size={15} className="text-white/70" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              Agent execution
            </p>
            <p className="mt-0.5 text-sm font-medium text-white/90">
              Recovery decision pipeline
            </p>
          </div>
        </div>

        {running ? (
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            Agent running
          </div>
        ) : (
          <span className="hidden text-[11px] text-white/30 sm:block">
            Live system state
          </span>
        )}
      </header>

      <div className="p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {nodes.map((node, index) => {
            const tone = TONE[node.tone]

            return (
              <div key={node.key} className="relative">
                <div
                  className={cn(
                    'group relative min-h-[126px] rounded-xl border bg-white/[0.025] p-3 transition-all',
                    tone.border,
                    tone.glow,
                    node.tone === 'active' && 'bg-primary/[0.045]',
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        'flex size-8 items-center justify-center rounded-lg',
                        tone.icon,
                      )}
                    >
                      <node.Icon size={15} />
                    </div>

                    <div className="flex size-5 items-center justify-center rounded-full bg-black/30">
                      <StateGlyph tone={node.tone} />
                    </div>
                  </div>

                  <p className="mt-4 text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">
                    {node.typeLabel}
                  </p>

                  <p
                    className={cn(
                      'mt-1 truncate text-[13px] font-semibold',
                      node.tone === 'idle'
                        ? 'text-white/30'
                        : 'text-white/90',
                    )}
                    title={node.value}
                  >
                    {node.value ?? 'Waiting'}
                  </p>

                  {node.caption && (
                    <p className={cn(
                      'mt-1 line-clamp-2 text-[10px] leading-relaxed',
                      tone.label,
                      node.tone === 'done' && 'text-white/35',
                    )}>
                      {node.caption}
                    </p>
                  )}
                </div>

                {index < nodes.length - 1 && (
                  <div className="absolute -right-2 top-1/2 z-10 hidden h-px w-2 bg-white/[0.08] xl:block" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}