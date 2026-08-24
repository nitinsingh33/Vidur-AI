import './RecoveryCasesTable.css'
import type { RecoveryCase } from '../../api/recoveryCases'

interface RecoveryCasesTableProps {
  cases: RecoveryCase[]
  onOpenRecoveryCase: (
    recoveryCaseId: string,
  ) => void
}

function formatAmount(
  amount: string,
  currency: string,
) {
  return `${currency === 'INR' ? '₹' : currency} ${Number(
    amount,
  ).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    )
}

function getLatestAction(recoveryCase: RecoveryCase) {
  return recoveryCase.actions[0] ?? null
}

export function RecoveryCasesTable({
  cases,
  onOpenRecoveryCase,
}: RecoveryCasesTableProps) {
  return (
    <section className="recovery-section">
      <div className="section-heading">
        <div>
          <p className="section-eyebrow">
            Recovery operations
          </p>

          <h2>Recent recovery cases</h2>

          <p>
            Monitor cases that require automated or human
            intervention.
          </p>
        </div>
      </div>

      <div className="recovery-table-wrapper">
        <table className="recovery-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Payment</th>
              <th>At risk</th>
              <th>Probability</th>
              <th>Risk</th>
              <th>Status</th>
              <th>Latest action</th>
            </tr>
          </thead>

          <tbody>
            {cases.map((recoveryCase) => {
              const latestAction =
                getLatestAction(recoveryCase)

              return (
                <tr 
                  key={recoveryCase.id}
                  onClick={() =>
                    onOpenRecoveryCase(recoveryCase.id)
                  }
                  className="recovery-row"
                >
                  <td>
                    <div className="customer-cell">
                      <strong>
                        {recoveryCase.customer.name}
                      </strong>

                      <span>
                        {recoveryCase.customer.email}
                      </span>
                    </div>
                  </td>

                  <td>
                    {recoveryCase.payment
                      ? formatAmount(
                          recoveryCase.payment.amount,
                          recoveryCase.payment.currency,
                        )
                      : '—'}
                  </td>

                  <td>
                    {formatAmount(
                      recoveryCase.revenueAtRisk,
                      'INR',
                    )}
                  </td>

                  <td>
                    {Math.round(
                      Number(
                        recoveryCase.recoveryProbability,
                      ) * 100,
                    )}
                    %
                  </td>

                  <td>
                    <span
                      className={`status-pill risk-${recoveryCase.riskLevel.toLowerCase()}`}
                    >
                      {formatLabel(
                        recoveryCase.riskLevel,
                      )}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`status-pill status-${recoveryCase.status.toLowerCase()}`}
                    >
                      {formatLabel(
                        recoveryCase.status,
                      )}
                    </span>
                  </td>

                  <td>
                    {latestAction ? (
                      <div className="action-cell">
                        <strong>
                          {formatLabel(
                            latestAction.type,
                          )}
                        </strong>

                        <span>
                          {formatLabel(
                            latestAction.status,
                          )}
                        </span>
                      </div>
                    ) : (
                      'No action'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}