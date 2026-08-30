import type { AuditLogEntry } from '../api/audit'
import { formatAmount, formatLabel } from './status'

export interface AuditEventView {
  title: string
  lines: string[]
}

function str(details: Record<string, unknown> | null, key: string): string | undefined {
  const value = details?.[key]
  return typeof value === 'string' ? value : undefined
}

function num(details: Record<string, unknown> | null, key: string): number | undefined {
  const value = details?.[key]
  return typeof value === 'number' ? value : undefined
}

/**
 * Turns one persisted AuditLog row into a judge-readable title + detail
 * lines. This only relabels and formats fields that are already present in
 * `entry.details` (written by AuditService.record() calls across the risk,
 * recovery, policy, and escalation services) — it never invents a field
 * that isn't actually there.
 */
export function describeAuditEvent(entry: AuditLogEntry): AuditEventView {
  const d = entry.details
  const lines: string[] = []

  switch (entry.action) {
    case 'RECOVERY_CASE_OPENED': {
      if (d && 'revenueAtRisk' in d) {
        lines.push(
          `${formatLabel(str(d, 'riskLevel'))} risk · ${formatAmount(
            String(d.revenueAtRisk),
          )} at risk`,
        )
      }
      const rootCause = str(d, 'rootCause')
      if (rootCause) lines.push(`Root cause: ${formatLabel(rootCause)}`)
      return { title: 'Recovery case opened', lines }
    }

    case 'STRATEGY_SELECTED': {
      const actionType = str(d, 'actionType')
      if (actionType) lines.push(formatLabel(actionType))
      const reason = str(d, 'reason')
      if (reason) lines.push(reason)
      return { title: 'Intervention selected', lines }
    }

    case 'AI_DIAGNOSIS_GENERATED': {
      const reasoning = str(d, 'reasoning')
      if (reasoning) lines.push(reasoning)
      return { title: 'AI diagnosis generated', lines }
    }

    case 'POLICY_EVALUATED': {
      const decision = str(d, 'decision')
      if (decision) lines.push(`Decision: ${formatLabel(decision)}`)
      const reason = str(d, 'reason')
      if (reason) lines.push(reason)
      return { title: 'Policy evaluated', lines }
    }

    case 'RECOVERY_ACTION_EXECUTED': {
      const successful = d?.successful === true
      lines.push(successful ? 'Execution succeeded' : 'Execution failed')
      const amount = num(d, 'recoveredAmount')
      if (successful && amount) lines.push(formatAmount(amount))
      const reason = str(d, 'reason')
      if (reason) lines.push(reason)
      return { title: 'Intervention executed', lines }
    }

    case 'RECOVERY_ACTION_BLOCKED': {
      const reason = str(d, 'reason')
      if (reason) lines.push(reason)
      return { title: 'Recovery action blocked', lines }
    }

    case 'RECOVERY_SUCCEEDED': {
      const amount = num(d, 'recoveredAmount')
      if (amount) lines.push(`${formatAmount(amount)} recovered`)
      const method = str(d, 'recoveryMethod')
      if (method) lines.push(`Method: ${formatLabel(method)}`)
      return { title: 'Recovery succeeded', lines }
    }

    case 'RECOVERY_ATTEMPT_OBSERVED': {
      const used = num(d, 'attemptsUsed')
      const remaining = num(d, 'attemptsRemaining')
      if (used !== undefined && remaining !== undefined) {
        lines.push(`${used} attempt${used === 1 ? '' : 's'} used · ${remaining} remaining`)
      }
      return { title: 'Recovery attempt observed', lines }
    }

    case 'RECOVERY_EXHAUSTED': {
      const used = num(d, 'attemptsUsed')
      const max = num(d, 'maxAttempts')
      if (used !== undefined && max !== undefined) {
        lines.push(`Attempt limit reached: ${used}/${max}`)
      }
      return { title: 'Agent stopped — attempt limit reached', lines }
    }

    case 'RECOVERY_ESCALATED': {
      const reason = str(d, 'reason')
      if (reason) lines.push(reason)
      return { title: 'Escalated to human review', lines }
    }

    default:
      return { title: formatLabel(entry.action), lines }
  }
}
