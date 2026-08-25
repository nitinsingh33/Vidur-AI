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
import './VidurRecoveryPanel.css'


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
  const [agentResult, setAgentResult] =
  useState<AgentRecoveryResult | null>(null)
  const [state, setState] = useState<PanelState>('idle')
  const [action, setAction] =
    useState<RecoveryAction | null>(null)
  const [outcome, setOutcome] =
    useState<RecoveryOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerateStrategy() {
    try {
      setError(null)
      setState('generating')

      const result =
        await createRecoveryStrategy(recoveryCaseId)

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
    try {
      setError(null)
      setState('executing')

      const result =
        await executeRecoveryAction(recoveryCaseId)

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
    try {
      setError(null)
      setState('observing')

      const result =
        await observeRecovery(recoveryCaseId)

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
    try {
      setError(null);
      setState("agent-running");

      const result = await runAgentRecovery(recoveryCaseId);
      setAgentResult(result);

      if (result.success === true) {
        setState("completed");
        onCompleted?.();
      } else {
        setState("escalated");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent recovery failed.");
      setState("idle");
    }
  }


  const actionLabel =
    action?.type
      ?.toLowerCase()
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase(),
      ) ?? 'Recovery action'

  return (
    <article className="vidur-panel">
      <div className="vidur-panel-header">
        <div className="vidur-brand">
          <div className="vidur-icon">
            <Bot size={20} />
          </div>

          <div>
            <p className="vidur-eyebrow">Vidur AI</p>

            <h2>Recovery intelligence</h2>
          </div>
        </div>

        <span className="vidur-live">
          <span />
          Agent ready
        </span>
      </div>

      <div className="vidur-content">
        {state === "idle" && (
          <>
            <div className="vidur-recommendation">
              <div className="recommendation-icon">
                <Sparkles size={18} />
              </div>

              <div>
                <span>Recommended next step</span>

                <strong>Generate recovery strategy</strong>

                <p>
                  Vidur will evaluate this recovery case and select the
                  appropriate intervention.
                </p>
              </div>
            </div>

            <button
              className="vidur-primary-button"
              type="button"
              onClick={handleGenerateStrategy}>
              <Sparkles size={17} />
              Generate Strategy
            </button>
            <div className="vidur-divider">
              <span>or run full agent</span>
            </div>

            <button
              className="vidur-secondary-button"
              type="button"
              onClick={handleRunAgent}>
              <Bot size={16} />
              Run Full Agent Recovery
            </button>
          </>
        )}

        {state === "generating" && (
          <div className="vidur-loading">
            <Loader2 size={20} className="spin" />

            <span>Vidur is evaluating the recovery case...</span>
          </div>
        )}

        {state === "ready" && action && (
          <>
            <div className="vidur-result">
              <div className="result-heading">
                <span>Recommended action</span>

                <strong>{actionLabel}</strong>
              </div>

              {action.reason && <p>{action.reason}</p>}

              {action.policyDecision && (
                <div className="policy-check">
                  <CheckCircle2 size={17} />

                  <span>
                    Policy: <strong>{action.policyDecision}</strong>
                  </span>
                </div>
              )}
            </div>

            <button
              className="vidur-primary-button"
              type="button"
              onClick={handleExecute}>
              <Play size={16} />
              Execute Recovery
            </button>
          </>
        )}

        {state === "executing" && (
          <div className="vidur-loading">
            <Loader2 size={20} className="spin" />

            <span>Vidur is executing the recovery action...</span>
          </div>
        )}

        {state === "executed" && action && (
          <>
            <div className="vidur-success">
              <CheckCircle2 size={22} />

              <div>
                <strong>Recovery action executed</strong>

                <span>
                  {action.result?.message ??
                    "The recovery action has completed."}
                </span>
              </div>
            </div>

            <button
              className="vidur-primary-button"
              type="button"
              onClick={handleObserve}>
              <Play size={16} />
              Observe Recovery
            </button>
          </>
        )}

        {state === "observing" && (
          <div className="vidur-loading">
            <Loader2 size={20} className="spin" />

            <span>Vidur is recording the recovery outcome...</span>
          </div>
        )}

        {state === "agent-running" && (
          <div className="vidur-loading">
            <Loader2 size={20} className="spin" />
            <span>Agent is running full recovery workflow...</span>
          </div>
        )}

        {state === "completed" && outcome && (
          <div className="vidur-success completed">
            <CheckCircle2 size={24} />

            <div>
              <strong>
                {outcome.successful
                  ? "Recovery completed"
                  : "Recovery unsuccessful"}
              </strong>

              <span>
                {outcome.successful
                  ? `₹${Number(outcome.recoveredAmount).toLocaleString(
                      "en-IN",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )} recovered`
                  : "No revenue was recovered."}
              </span>
            </div>
          </div>
        )}

        {state === "escalated" && agentResult && (
          <div className="vidur-escalated">
            <AlertTriangle size={22} />

            <div>
              <strong>Escalated to human review</strong>

              <span>
                {agentResult.policy_decision === "DENY"
                  ? "Policy blocked this intervention."
                  : "Recovery exhausted — case escalated."}
              </span>

              {agentResult.candidate_intervention && (
                <span className="escalated-intervention">
                  Attempted:{" "}
                  {agentResult.candidate_intervention
                    .toLowerCase()
                    .replaceAll("_", " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
              )}
            </div>
          </div>
        )}

        {error && <div className="vidur-error">{error}</div>}
      </div>
    </article>
  );
}