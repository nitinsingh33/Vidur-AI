import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Ban,
  Bot,
  CheckCircle2,
  Loader2,
  Play,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import {
  approveRecoveryAction,
  checkPolicy,
  createRecoveryStrategy,
  executeRecoveryAction,
  getRecoveryCase,
  observeRecovery,
  rejectRecoveryAction,
  runAgentRecovery,
  type AgentRecoveryResult,
  type RecoveryAction,
  type RecoveryCase,
  type RecoveryOutcome,
} from '../../api/recoveryCases'
import { Button } from '../ui/button'
import { useAuth } from '../../context/AuthContext'
import { formatAmount, formatLabel } from '../../lib/status'
import { deriveAgentPipeline } from '../../lib/agentPipeline'
import { AgentExecutionTimeline } from './AgentExecutionTimeline'
import { AgentGuardrails } from './AgentGuardrails'

interface VidurRecoveryPanelProps {
  recoveryCase: RecoveryCase
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

const POLL_INTERVAL_MS = 1200

export function VidurRecoveryPanel({
  recoveryCase,
  onCompleted,
}: VidurRecoveryPanelProps) {
  const { token, user } = useAuth()

  const [state, setState] = useState<PanelState>('idle')
  const [approvalBusy, setApprovalBusy] = useState<'approve' | 'reject' | null>(
    null,
  )
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [action, setAction] = useState<RecoveryAction | null>(null)
  const [outcome, setOutcome] = useState<RecoveryOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [caseSnapshot, setCaseSnapshot] =
    useState<RecoveryCase>(recoveryCase)

  const [initialSnapshot, setInitialSnapshot] =
    useState<RecoveryCase | null>(null)

  const [agentResult, setAgentResult] =
    useState<AgentRecoveryResult | null>(null)

  const [isAgentRunning, setIsAgentRunning] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isAgentRunning) {
      setCaseSnapshot(recoveryCase)
    }
  }, [recoveryCase, isAgentRunning])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  async function handleGenerateStrategy() {
    if (!token) return

    try {
      setError(null)
      setState('generating')

      const strategy = await createRecoveryStrategy(
        token,
        recoveryCase.id,
      )

      /*
       * The autonomous agent run evaluates policy as one of its own steps;
       * this manual path must do the same thing explicitly — execute
       * refuses to run anything whose policyDecision isn't ALLOW yet, and
       * nothing else sets it for a manually-generated action.
       */
      const policy = await checkPolicy(
        token,
        recoveryCase.id,
        strategy.type,
      )

      setAction({ ...strategy, policyDecision: policy.decision })

      // Refresh so the REQUIRE_APPROVAL card (driven by caseSnapshot,
      // not this action state) picks up the freshly-evaluated action too.
      const freshCase = await getRecoveryCase(token, recoveryCase.id)
      setCaseSnapshot(freshCase)

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

      const result = await executeRecoveryAction(
        token,
        recoveryCase.id,
      )

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

      const result = await observeRecovery(
        token,
        recoveryCase.id,
      )

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

    setError(null)
    setAgentResult(null)
    setInitialSnapshot(caseSnapshot)
    setIsAgentRunning(true)
    setState('agent-running')

    pollRef.current = setInterval(() => {
      getRecoveryCase(token, recoveryCase.id)
        .then(setCaseSnapshot)
        .catch(() => {})
    }, POLL_INTERVAL_MS)

    try {
      const result = await runAgentRecovery(
        token,
        recoveryCase.id,
      )

      const finalSnapshot = await getRecoveryCase(
        token,
        recoveryCase.id,
      )

      setCaseSnapshot(finalSnapshot)
      setAgentResult(result)
      setState('idle')

      if (result.success === true) {
        setTimeout(() => onCompleted?.(), 3000)
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Agent recovery failed.',
      )
      setState('idle')
    } finally {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }

      setIsAgentRunning(false)
    }
  }

  const pendingApproval = caseSnapshot.actions.find(
    (item) => item.status === 'PENDING' && item.policyDecision === 'REQUIRE_APPROVAL',
  )
  const canApprove = user?.role === 'ADMIN' || user?.role === 'FINANCE_MANAGER'

  async function handleApproval(decision: 'approve' | 'reject') {
    if (!token || !pendingApproval) return

    try {
      setApprovalError(null)
      setApprovalBusy(decision)

      if (decision === 'approve') {
        await approveRecoveryAction(token, recoveryCase.id, pendingApproval.id)
      } else {
        await rejectRecoveryAction(token, recoveryCase.id, pendingApproval.id)
      }

      onCompleted?.()
    } catch (err) {
      setApprovalError(
        err instanceof Error ? err.message : 'Unable to record the decision.',
      )
      setApprovalBusy(null)
    }
  }

  const actionLabel = action?.type
    ? formatLabel(action.type)
    : 'Recovery action'

  const hasPipelineData =
    isAgentRunning ||
    agentResult !== null ||
    caseSnapshot.actions.length > 0

  const { stages, finalOutcome, guardrails } = hasPipelineData
    ? deriveAgentPipeline({
        recoveryCase: caseSnapshot,
        initialSnapshot,
        agentResult,
        isRunning: isAgentRunning,
      })
    : {
        stages: [],
        finalOutcome: null,
        guardrails: [],
      }

  return (
    <section className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="h-1 bg-gradient-to-r from-primary/80 via-primary to-primary/40" />

      <header className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Bot size={19} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                Vidur AI
              </p>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                LIVE
              </span>
            </div>

            <h2 className="mt-0.5 text-[15px] font-semibold text-foreground">
              Recovery intelligence
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck size={14} />
          Policy-controlled execution
        </div>
      </header>

      <div className="p-5 sm:p-6">
        {pendingApproval && (
          <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <ShieldAlert size={18} />
              </div>

              <div className="flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-600 dark:text-amber-400">
                  Awaiting human approval
                </p>

                <h3 className="mt-1 text-base font-semibold text-foreground">
                  {formatLabel(pendingApproval.type)}
                </h3>

                {pendingApproval.reason && (
                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {pendingApproval.reason}
                  </p>
                )}

                {canApprove ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleApproval('approve')}
                      disabled={approvalBusy !== null}
                    >
                      {approvalBusy === 'approve' ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={15} />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleApproval('reject')}
                      disabled={approvalBusy !== null}
                    >
                      {approvalBusy === 'reject' ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Ban size={15} />
                      )}
                      Reject
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Only an admin or finance manager can approve or reject this
                    action.
                  </p>
                )}

                {approvalError && (
                  <p className="mt-3 text-sm text-destructive">
                    {approvalError}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {state === 'idle' && (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
            <div className="rounded-2xl border border-border bg-secondary/20 p-5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm">
                <Sparkles size={16} />
              </div>

              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Controlled recovery
              </p>

              <h3 className="mt-1 text-base font-semibold text-foreground">
                Review each decision
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Generate the recommended intervention, review policy,
                execute it, and explicitly observe the result.
              </p>

              <Button
                className="mt-5 w-full sm:w-auto"
                onClick={handleGenerateStrategy}
              >
                <Sparkles size={15} />
                Generate strategy
              </Button>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.045] p-5">
              <div className="absolute -right-10 -top-10 size-32 rounded-full bg-primary/[0.08] blur-3xl" />

              <div className="relative">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Zap size={16} />
                </div>

                <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
                  Autonomous mode
                </p>

                <h3 className="mt-1 text-base font-semibold text-foreground">
                  Let Vidur run the full recovery
                </h3>

                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Diagnose the case, select an intervention, evaluate
                  guardrails, execute when allowed, and observe the outcome.
                </p>

                <Button
                  variant="outline"
                  className="mt-5 w-full border-primary/20 bg-background/60 sm:w-auto"
                  onClick={handleRunAgent}
                >
                  <Bot size={15} />
                  Run full agent
                  <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          </div>
        )}

        {(state === 'generating' ||
          state === 'executing' ||
          state === 'observing') && (
          <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20">
            <div className="flex flex-col items-center text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Loader2 size={19} className="animate-spin" />
              </div>

              <p className="mt-4 text-sm font-medium text-foreground">
                {state === 'generating' &&
                  'Evaluating the recovery case'}
                {state === 'executing' &&
                  'Executing the recovery action'}
                {state === 'observing' &&
                  'Recording the recovery outcome'}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Vidur is working with the persisted case state.
              </p>
            </div>
          </div>
        )}

        {state === 'ready' && action && (
          <div className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
                  Recommended intervention
                </p>

                <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                  {actionLabel}
                </h3>

                {action.reason && (
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {action.reason}
                  </p>
                )}
              </div>

              {action.policyDecision && (
                <div
                  className={
                    action.policyDecision === 'ALLOW'
                      ? 'flex shrink-0 items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400'
                      : 'flex shrink-0 items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400'
                  }
                >
                  {action.policyDecision === 'ALLOW' ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <ShieldAlert size={14} />
                  )}
                  Policy {formatLabel(action.policyDecision)}
                </div>
              )}
            </div>

            <div className="mt-5 border-t border-primary/10 pt-4">
              {action.policyDecision === 'ALLOW' ? (
                <Button onClick={handleExecute}>
                  <Play size={15} />
                  Execute recovery
                </Button>
              ) : action.policyDecision === 'REQUIRE_APPROVAL' ? (
                <p className="text-sm text-muted-foreground">
                  This action needs approval before it can run — see "Awaiting
                  human approval" above.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Policy blocked this intervention. No further action will be
                  taken automatically.
                </p>
              )}
            </div>
          </div>
        )}

        {state === 'executed' && action && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 size={18} />
              </div>

              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Recovery action executed
                </p>

                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {action.result?.message ??
                    'The recovery action has completed.'}
                </p>

                {(action.result?.paymentLinkShortUrl ??
                  action.externalReferenceUrl) && (
                  <a
                    href={
                      action.result?.paymentLinkShortUrl ??
                      action.externalReferenceUrl ??
                      undefined
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block break-all text-sm font-medium text-primary hover:underline"
                  >
                    {action.result?.paymentLinkShortUrl ??
                      action.externalReferenceUrl}
                  </a>
                )}

                <Button className="mt-4" onClick={handleObserve}>
                  <Play size={15} />
                  Observe recovery
                </Button>
              </div>
            </div>
          </div>
        )}

        {state === 'completed' && outcome && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 size={18} />
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground">
                  {outcome.successful
                    ? 'Recovery completed'
                    : 'Recovery unsuccessful'}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  {outcome.successful
                    ? `${formatAmount(outcome.recoveredAmount)} recovered`
                    : 'No revenue was recovered.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {hasPipelineData && (
          <div className="mt-5">
            <AgentExecutionTimeline
              stages={stages}
              finalOutcome={finalOutcome}
              guardrails={guardrails}
              running={isAgentRunning}
            />

            <AgentGuardrails guardrails={guardrails} />
          </div>
        )}

        {state === 'agent-running' && !hasPipelineData && (
          <div className="flex min-h-24 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={18} className="animate-spin" />
              Starting agent…
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </section>
  )
}