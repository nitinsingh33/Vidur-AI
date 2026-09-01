import type { RecoveryCase } from '../../api/recoveryCases'
import { StatusBadge } from '../ui/status-badge'
import { DeleteButton } from '../ui/delete-button'
import {
  caseStatusTone,
  riskTone,
  formatAmount,
  formatLabel,
  recoveryCaseCategory,
  recoveryCaseCategoryMeta,
} from '../../lib/status'

interface RecoveryCasesTableProps {
  cases: RecoveryCase[]
  onOpenRecoveryCase: (recoveryCaseId: string) => void
  /** Omit to hide the Delete column entirely (e.g. a read-only preview). */
  onDeleteRecoveryCase?: (recoveryCaseId: string) => Promise<void>
}

function getLatestAction(recoveryCase: RecoveryCase) {
  return recoveryCase.actions[0] ?? null
}

export function RecoveryCasesTable({
  cases,
  onOpenRecoveryCase,
  onDeleteRecoveryCase,
}: RecoveryCasesTableProps) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recovery operations
        </p>
        <h2 className="mt-1 text-base font-semibold text-foreground">
          Recent recovery cases
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Monitor cases that require automated or human intervention.
        </p>
      </div>

      {cases.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            No active recovery cases
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Vidur AI hasn't detected any cases requiring action.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Payment</th>
                <th className="px-3 py-3 font-medium">At risk</th>
                <th className="px-3 py-3 font-medium">Probability</th>
                <th className="px-3 py-3 font-medium">Risk</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Latest action</th>
                {onDeleteRecoveryCase && (
                  <th className="px-3 py-3 font-medium">Actions</th>
                )}
              </tr>
            </thead>

            <tbody>
              {cases.map((recoveryCase) => {
                const latestAction = getLatestAction(recoveryCase)
                const category = recoveryCaseCategory(recoveryCase)
                const categoryMeta = recoveryCaseCategoryMeta(category)

                return (
                  <tr
                    key={recoveryCase.id}
                    onClick={() => onOpenRecoveryCase(recoveryCase.id)}
                    className="cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {recoveryCase.customer?.name ?? 'Unknown customer'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {recoveryCase.customer?.email ?? 'No contact info'}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-3.5">
                      <StatusBadge
                        label={categoryMeta.label}
                        tone={categoryMeta.tone}
                      />
                    </td>

                    <td className="px-3 py-3.5 text-muted-foreground">
                      {recoveryCase.payment ? (
                        formatAmount(
                          recoveryCase.payment.amount,
                          recoveryCase.payment.currency,
                        )
                      ) : recoveryCase.order ? (
                        <span>
                          {formatAmount(
                            recoveryCase.order.amount,
                            recoveryCase.order.currency,
                          )}
                          <span className="ml-1 text-xs text-muted-foreground/70">
                            (checkout)
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="px-3 py-3.5 text-muted-foreground">
                      {formatAmount(recoveryCase.revenueAtRisk, 'INR')}
                    </td>

                    <td className="px-3 py-3.5 text-muted-foreground">
                      {Math.round(
                        Number(recoveryCase.recoveryProbability) * 100,
                      )}
                      %
                    </td>

                    <td className="px-3 py-3.5">
                      <StatusBadge
                        label={recoveryCase.riskLevel}
                        tone={riskTone(recoveryCase.riskLevel)}
                      />
                    </td>

                    <td className="px-3 py-3.5">
                      <StatusBadge
                        label={recoveryCase.status}
                        tone={caseStatusTone(recoveryCase.status)}
                      />
                    </td>

                    <td className="px-3 py-3.5">
                      {latestAction ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {formatLabel(latestAction.type)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatLabel(latestAction.status)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          No action
                        </span>
                      )}
                    </td>

                    {onDeleteRecoveryCase && (
                      <td className="px-3 py-3.5">
                        <DeleteButton
                          size="sm"
                          stopPropagation
                          onConfirm={() =>
                            onDeleteRecoveryCase(recoveryCase.id)
                          }
                        />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
