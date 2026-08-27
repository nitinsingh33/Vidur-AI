import { useState } from 'react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Loader2,
  Play,
  Sparkles,
} from 'lucide-react'
import {
  createRecoveryStrategy,
  executeRecoveryAction,
  observeRecovery,
  runAgentRecovery,
  type AgentRecoveryResult,
  type RecoveryAction,
  type RecoveryOutcome,
} from '../../api/recoveryCases'
import { Button } from '../ui/button'
import { useAuth } from '../../context/AuthContext'
import { formatAmount, formatLabel } from '../../lib/status'

interface VidurRecoveryPanelProps {
  recoveryCaseId: string
  onCompleted?: () => void
}

type PanelState =
  | 'idle'
  | 'generating'
  | 'ready'
  | 'executing'
  | 'executed'
  | 'observing'
  | 'completed'
  | 'agent-running'
  | 'escalated'

export function VidurRecoveryPanel({
  recoveryCaseId,
  onCompleted,
}: VidurRecoveryPanelProps) {
  const { token } = useAuth()
  const [agentResult, setAgentResult] = useState<AgentRecoveryResult | null>(
    null,
  )
  const [state, setState] = useState<PanelState>('idle')
  const [action, setAction] = useState<RecoveryAction | null>(null)
  const [outcome, setOutcome] = useState<RecoveryOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerateStrategy() {
    if (!token) return

    try {
      setError(null)
      setState('generating')
      const result = await createRecoveryStrategy(token, recoveryCaseId)
      setAction(result)
      setState('ready')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to generate recovery strategy.',
      )
      setState('idle')
    }
  }

  async function handleExecute() {
    if (!token) return

    try {
      setError(null)
      setState('executing')
      const result = await executeRecoveryAction(token, recoveryCaseId)
      setAction(result)
      setState('executed')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to execute recovery action.',
      )
      setState('ready')
    }
  }

  async function handleObserve() {
    if (!token) return

    try {
      setError(null)
      setState('observing')
      const result = await observeRecovery(token, recoveryCaseId)
      setOutcome(result)
      setState('completed')
      onCompleted?.()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to observe recovery outcome.',
      )
      setState('executed')
    }
  }

  async function handleRunAgent() {
    if (!token) return

    try {
      setError(null)
      setState('agent-running')
      const result = await runAgentRecovery(token, recoveryCaseId)
      setAgentResult(result)

      if (result.success === true) {
        setState('completed')
        onCompleted?.()
      } else {
        setState('escalated')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Agent recovery failed.')
      setState('idle')
    }
  }

  const actionLabel = action?.type ? formatLabel(action.type) : 'Recovery action'

  return (
    <article className="relative mt-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-primary/60 to-primary" />

      <div className="flex items-center justify-between gap-5 border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Bot size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Vidur AI
            </p>
            <h2 className="text-[15px] font-semibold text-foreground">
              Recovery intelligence
            </h2>
          </div>
        </div>

        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          Agent ready
        </span>
      </div>

      <div className="p-6">
        {state === 'idle' && (
          <>
            <div className="mb-5 flex items-start gap-3.5">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles size={17} />
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">
                  Recommended next step
                </span>
                <strong className="block text-[15px] font-semibold text-foreground">
                  Generate recovery strategy
                </strong>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Vidur will evaluate this recovery case and select the
                  appropriate intervention.
                </p>
              </div>
            </div>

            <Button onClick={handleGenerateStrategy}>
              <Sparkles size={16} />
              Generate Strategy
            </Button>

            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or run full agent
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" onClick={handleRunAgent}>
              <Bot size={16} />
              Run Full Agent Recovery
            </Button>
          </>
        )}

        {(state === 'generating' ||
          state === 'executing' ||
          state === 'observing' ||
          state === 'agent-running') && (
          <div className="flex min-h-18 items-center gap-2.5 text-sm text-muted-foreground">
            <Loader2 size={19} className="animate-spin" />
            <span>
              {state === 'generating' &&
                'Vidur is evaluating the recovery case...'}
              {state === 'executing' &&
                'Vidur is executing the recovery action...'}
              {state === 'observing' &&
                'Vidur is recording the recovery outcome...'}
              {state === 'agent-running' &&
                'Agent is running full recovery workflow...'}
            </span>
          </div>
        )}

        {state === 'ready' && action && (
          <>
            <div className="mb-5 rounded-lg border border-border bg-secondary/40 p-4">
              <span className="block text-xs text-muted-foreground">
                Recommended action
              </span>
              <strong className="mt-1 block text-[15px] font-semibold text-foreground">
                {actionLabel}
              </strong>

              {action.reason && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {action.reason}
                </p>
              )}

              {action.policyDecision && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400">
                  <CheckCircle2 size={14} />
                  Policy: <strong>{action.policyDecision}</strong>
                </div>
              )}
            </div>

            <Button onClick={handleExecute}>
              <Play size={16} />
              Execute Recovery
            </Button>
          </>
        )}

        {state === 'executed' && action && (
          <>
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4 text-emerald-400">
              <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
              <div>
                <strong className="block text-sm font-semibold">
                  Recovery action executed
                </strong>
                <span className="mt-1 block text-xs opacity-90">
                  {action.result?.message ??
                    'The recovery action has completed.'}
                </span>
              </div>
            </div>

            <Button onClick={handleObserve}>
              <Play size={16} />
              Observe Recovery
            </Button>
          </>
        )}

        {state === 'completed' && outcome && (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4 text-emerald-400">
            <CheckCircle2 size={22} className="mt-0.5 shrink-0" />
            <div>
              <strong className="block text-sm font-semibold">
                {outcome.successful
                  ? 'Recovery completed'
                  : 'Recovery unsuccessful'}
              </strong>
              <span className="mt-1 block text-xs opacity-90">
                {outcome.successful
                  ? `${formatAmount(outcome.recoveredAmount)} recovered`
                  : 'No revenue was recovered.'}
              </span>
            </div>
          </div>
        )}

        {state === 'escalated' && agentResult && (
          <div className="flex items-start gap-3.5 rounded-lg border border-amber-500/25 bg-amber-500/10 p-4 text-amber-400">
            <AlertTriangle size={22} className="mt-0.5 shrink-0" />
            <div>
              <strong className="block text-sm font-semibold">
                Escalated to human review
              </strong>
              <span className="mt-1 block text-xs opacity-90">
                {agentResult.policy_decision === 'DENY'
                  ? 'Policy blocked this intervention.'
                  : 'Recovery exhausted — case escalated.'}
              </span>
              {agentResult.candidate_intervention && (
                <span className="mt-1 block text-xs opacity-60">
                  Attempted: {formatLabel(agentResult.candidate_intervention)}
                </span>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </article>
  )
}
