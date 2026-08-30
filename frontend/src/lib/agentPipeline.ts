import type {
  AgentRecoveryResult,
  RecoveryAction,
  RecoveryCase,
} from '../api/recoveryCases'
import { formatAmount, formatLabel } from './status'

export type StageStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface PipelineStage {
  key: string
  label: string
  status: StageStatus
  value?: string
  detail?: string
}

export interface FinalOutcome {
  kind: 'recovered' | 'escalated'
  label: string
  detail: string
}

export type GuardrailStatus = 'met' | 'not-applicable' | 'pending'

export interface GuardrailCheck {
  key: string
  label: string
  status: GuardrailStatus
  detail?: string
}

interface DerivePipelineParams {
  recoveryCase: RecoveryCase
  /**
   * The case snapshot captured the moment "Run Full Agent Recovery" was
   * clicked. `null` means there is no active run in this session — we are
   * reconstructing whatever the persisted case already shows (e.g. after a
   * page reload), so every existing action/diagnosis/outcome counts as
   * already-real rather than "new since this click."
   */
  initialSnapshot: RecoveryCase | null
  agentResult: AgentRecoveryResult | null
  isRunning: boolean
}

/**
 * Pure presentation mapping: reads already-decided backend state (risk
 * numbers, persisted RecoveryAction/RecoveryOutcome rows, the agent's own
 * response) and maps it to display stages. It never computes risk,
 * probability, diagnosis, or an intervention itself — every value here is
 * copied from data the backend already produced.
 */
export function deriveAgentPipeline({
  recoveryCase,
  initialSnapshot,
  agentResult,
  isRunning,
}: DerivePipelineParams): {
  stages: PipelineStage[]
  finalOutcome: FinalOutcome | null
  guardrails: GuardrailCheck[]
} {
  const isReconstruction = initialSnapshot === null
  const runFinished = isReconstruction ? true : agentResult !== null

  const initialActionIds = new Set(
    (initialSnapshot?.actions ?? []).map((a) => a.id),
  )
  const pool: RecoveryAction[] = isReconstruction
    ? recoveryCase.actions
    : recoveryCase.actions.filter((a) => !initialActionIds.has(a.id))

  const primaryAction =
    pool.find((a) => a.type !== 'ESCALATE_HUMAN') ?? null
  const escalationAction =
    pool.find((a) => a.type === 'ESCALATE_HUMAN') ?? null

  const aiReasoningIsNew = isReconstruction
    ? Boolean(recoveryCase.aiReasoning)
    : Boolean(recoveryCase.aiReasoning) &&
      recoveryCase.aiReasoning !== initialSnapshot?.aiReasoning

  const outcomeIsNew = isReconstruction
    ? Boolean(recoveryCase.outcome)
    : Boolean(recoveryCase.outcome) &&
      recoveryCase.outcome?.id !== initialSnapshot?.outcome?.id

  const detectedStage: PipelineStage = {
    key: 'detected',
    label: 'Payment detected',
    status: recoveryCase.payment ? 'completed' : 'pending',
    value: recoveryCase.payment
      ? formatAmount(recoveryCase.payment.amount, recoveryCase.payment.currency)
      : undefined,
    // rootCause is frozen at case-open time; payment.failureReason can be
    // cleared later by a successful synthetic recovery, so rootCause stays
    // the accurate record of what the payment originally failed with.
    detail: recoveryCase.payment
      ? formatLabel(recoveryCase.rootCause)
      : undefined,
  }

  const riskStage: PipelineStage = {
    key: 'risk',
    label: 'Risk assessment',
    status: 'completed',
    value: formatAmount(recoveryCase.revenueAtRisk),
    detail: `${formatLabel(recoveryCase.riskLevel)} risk · ${Math.round(
      Number(recoveryCase.recoveryProbability) * 100,
    )}% recovery probability`,
  }

  const interventionStage: PipelineStage = primaryAction
    ? {
        key: 'intervention',
        label: 'Intervention selection',
        status: 'completed',
        value: formatLabel(primaryAction.type),
        detail: primaryAction.reason ?? undefined,
      }
    : {
        key: 'intervention',
        label: 'Intervention selection',
        status: isRunning ? 'running' : 'pending',
        detail: isRunning ? 'Selecting...' : undefined,
      }

  const diagnosisStage: PipelineStage = aiReasoningIsNew
    ? {
        key: 'diagnosis',
        label: 'AI diagnosis',
        status: 'completed',
        detail: recoveryCase.aiReasoning ?? undefined,
      }
    : interventionStage.status === 'completed'
      ? {
          key: 'diagnosis',
          label: 'AI diagnosis',
          status: runFinished ? 'completed' : 'running',
          detail: runFinished ? 'No diagnosis returned' : 'Diagnosing...',
        }
      : {
          key: 'diagnosis',
          label: 'AI diagnosis',
          status: 'pending',
        }

  let executionStage: PipelineStage
  if (!primaryAction) {
    executionStage = {
      key: 'execution',
      label: 'Intervention execution',
      status: 'pending',
    }
  } else if (primaryAction.status === 'SUCCESS') {
    executionStage = {
      key: 'execution',
      label: 'Intervention execution',
      status: 'completed',
      detail: primaryAction.result?.message,
    }
  } else if (primaryAction.status === 'FAILED') {
    executionStage = {
      key: 'execution',
      label: 'Intervention execution',
      status: 'failed',
      detail: primaryAction.result?.message ?? 'Execution failed.',
    }
  } else if (primaryAction.status === 'EXECUTING') {
    executionStage = {
      key: 'execution',
      label: 'Intervention execution',
      status: 'running',
      detail: 'Executing...',
    }
  } else if (runFinished && escalationAction) {
    // Never reached EXECUTING — policy blocked it before execute ran.
    executionStage = {
      key: 'execution',
      label: 'Intervention execution',
      status: 'pending',
      detail:
        primaryAction.policyDecision === 'REQUIRE_APPROVAL'
          ? 'Skipped — policy requires human approval'
          : primaryAction.policyDecision === 'BLOCK'
            ? 'Skipped — blocked by policy'
            : 'Not executed',
    }
  } else {
    executionStage = {
      key: 'execution',
      label: 'Intervention execution',
      status: isRunning ? 'running' : 'pending',
      detail: isRunning ? 'Checking policy...' : undefined,
    }
  }

  let observationStage: PipelineStage
  if (outcomeIsNew) {
    observationStage = {
      key: 'observation',
      label: 'Outcome observation',
      status: 'completed',
      value: recoveryCase.outcome
        ? formatAmount(recoveryCase.outcome.recoveredAmount)
        : undefined,
      detail: recoveryCase.outcome?.successful
        ? 'Payment recovered'
        : undefined,
    }
  } else if (
    executionStage.status === 'completed' ||
    executionStage.status === 'failed'
  ) {
    observationStage = {
      key: 'observation',
      label: 'Outcome observation',
      status: runFinished ? 'completed' : 'running',
      detail: runFinished ? 'No recovery recorded' : 'Observing...',
    }
  } else {
    observationStage = {
      key: 'observation',
      label: 'Outcome observation',
      status: 'pending',
    }
  }

  const stages = [
    detectedStage,
    riskStage,
    interventionStage,
    diagnosisStage,
    executionStage,
    observationStage,
  ]

  let finalOutcome: FinalOutcome | null = null

  if (
    runFinished &&
    (recoveryCase.outcome ||
      escalationAction ||
      recoveryCase.status === 'ESCALATED' ||
      recoveryCase.status === 'RECOVERED')
  ) {
    if (recoveryCase.outcome?.successful || recoveryCase.status === 'RECOVERED') {
      finalOutcome = {
        kind: 'recovered',
        label: 'Recovered',
        detail: recoveryCase.outcome
          ? `${formatAmount(recoveryCase.outcome.recoveredAmount)} recovered via ${formatLabel(
              recoveryCase.outcome.recoveryMethod,
            )}`
          : 'Payment recovered.',
      }
    } else {
      // Prefer the persisted policyDecision on the action over the
      // transient agentResult — the former survives a page reload, the
      // latter only exists for the run that's still in memory.
      const policyDecision =
        primaryAction?.policyDecision ?? agentResult?.policy_decision ?? null

      finalOutcome = {
        kind: 'escalated',
        label: 'Escalated to human review',
        detail:
          policyDecision === 'BLOCK'
            ? 'Policy blocked the selected intervention.'
            : policyDecision === 'REQUIRE_APPROVAL'
              ? 'Policy requires human approval for the selected intervention.'
              : 'Recovery attempts exhausted.',
      }
    }
  }

  // Guardrail evidence — each check is derived from the same persisted
  // fields above, never a separate claim. "not-applicable" (rather than a
  // false "met") is used whenever a rule genuinely wasn't the reason this
  // run stopped (e.g. the retry limit was never reached because policy
  // blocked the very first attempt, or the case recovered before needing
  // escalation).
  const attemptCount = primaryAction
    ? pool.filter(
        (a) =>
          a.type === primaryAction.type &&
          (a.status === 'SUCCESS' || a.status === 'FAILED'),
      ).length
    : 0

  const attemptsExhausted =
    Boolean(escalationAction) && primaryAction?.policyDecision === 'ALLOW'

  const policyCheck: GuardrailCheck = primaryAction?.policyDecision
    ? {
        key: 'policy',
        label: 'Policy evaluated before acting',
        status: 'met',
        detail: `Decision: ${formatLabel(primaryAction.policyDecision)}`,
      }
    : {
        key: 'policy',
        label: 'Policy evaluated before acting',
        status: 'pending',
      }

  const attemptLimitCheck: GuardrailCheck = !runFinished
    ? {
        key: 'attempts',
        label: 'Bounded retry limit respected',
        status: 'pending',
      }
    : attemptsExhausted
      ? {
          key: 'attempts',
          label: 'Bounded retry limit respected',
          status: 'met',
          detail: `Stopped after ${attemptCount} attempt${
            attemptCount === 1 ? '' : 's'
          } — no further retries taken.`,
        }
      : {
          key: 'attempts',
          label: 'Bounded retry limit respected',
          status: 'not-applicable',
          detail:
            primaryAction?.policyDecision &&
            primaryAction.policyDecision !== 'ALLOW'
              ? 'Not triggered — blocked by policy before any attempt.'
              : finalOutcome?.kind === 'recovered'
                ? 'Not triggered — recovered before reaching the limit.'
                : undefined,
        }

  const stoppedCheck: GuardrailCheck = finalOutcome
    ? {
        key: 'stopped',
        label: 'Agent halted at a terminal condition',
        status: 'met',
        detail: finalOutcome.label,
      }
    : {
        key: 'stopped',
        label: 'Agent halted at a terminal condition',
        status: 'pending',
      }

  const escalationCheck: GuardrailCheck = escalationAction
    ? {
        key: 'escalation',
        label: 'Human escalation triggered when required',
        status: 'met',
        detail: finalOutcome?.detail,
      }
    : runFinished
      ? {
          key: 'escalation',
          label: 'Human escalation triggered when required',
          status: 'not-applicable',
          detail:
            finalOutcome?.kind === 'recovered'
              ? 'Not required — payment recovered autonomously.'
              : undefined,
        }
      : {
          key: 'escalation',
          label: 'Human escalation triggered when required',
          status: 'pending',
        }

  const guardrails = [
    policyCheck,
    attemptLimitCheck,
    stoppedCheck,
    escalationCheck,
  ]

  return { stages, finalOutcome, guardrails }
}
