import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Clock3, XCircle } from 'lucide-react'
import {
  getRecoveryCase,
  type RecoveryCase,
} from '../api/recoveryCases'
import { VidurRecoveryPanel } from '../components/recovery/VidurRecoveryPanel'
import './RecoveryCaseDetails.css'

interface RecoveryCaseDetailsProps {}

function formatAmount(
  amount: string,
  currency = 'INR',
) {
  return `${currency === 'INR' ? '₹' : currency} ${Number(
    amount,
  ).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatLabel(value: string | null) {
  if (!value) return '—'

  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    )
}

function getActionIcon(status: string) {
  if (status === 'SUCCESS') {
    return <CheckCircle2 size={16} />
  }

  if (status === 'FAILED') {
    return <XCircle size={16} />
  }

  return <Clock3 size={16} />
}

export function RecoveryCaseDetails(
  _props: RecoveryCaseDetailsProps,
) {
  const { recoveryCaseId } = useParams<{
    recoveryCaseId: string
  }>()

  const navigate = useNavigate()
  const [recoveryCase, setRecoveryCase] =
    useState<RecoveryCase | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCase() {
      try {
        setLoading(true)
        setError(null)

        if (!recoveryCaseId) {
          return
        }

        const data = await getRecoveryCase(
          recoveryCaseId,
        )

        setRecoveryCase(data)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load recovery case.',
        )
      } finally {
        setLoading(false)
      }
    }

    loadCase()
  }, [recoveryCaseId])

  if (loading) {
    return (
      <section className="case-details-page">
        <div className="case-details-state">
          Loading recovery case...
        </div>
      </section>
    )
  }

  if (error || !recoveryCase) {
    return (
      <section className="case-details-page">
        <button
          className="back-button"
          type="button"
          onClick={() => navigate('/recovery-cases')}
        >
          <ArrowLeft size={17} />
          Back to recovery cases
        </button>

        <div className="case-details-state error">
          {error ?? 'Recovery case not found.'}
        </div>
      </section>
    )
  }

  const probability = Math.round(
    Number(recoveryCase.recoveryProbability) * 100,
  )

  return (
    <section className="case-details-page">
      <button
        className="back-button"
        type="button"
        onClick={() => navigate('/recovery-cases')}
      >
        <ArrowLeft size={17} />
        Back to recovery cases
      </button>

      <div className="case-header">
        <div>
          <p className="eyebrow">Recovery case</p>

          <h1>Case details</h1>

          <p className="case-id">
            {recoveryCase.id}
          </p>
        </div>

        <div className="case-header-status">
          <span
            className={`status-pill status-${recoveryCase.status.toLowerCase()}`}
          >
            {formatLabel(recoveryCase.status)}
          </span>

          <span
            className={`status-pill risk-${recoveryCase.riskLevel.toLowerCase()}`}
          >
            {formatLabel(recoveryCase.riskLevel)} risk
          </span>
        </div>
      </div>

      <div className="case-overview-grid">
        <article className="case-highlight">
          <span>Revenue at risk</span>

          <strong>
            {formatAmount(
              recoveryCase.revenueAtRisk,
            )}
          </strong>
        </article>

        <article className="case-highlight">
          <span>Recovery probability</span>

          <strong>{probability}%</strong>
        </article>

        <article className="case-highlight">
          <span>Root cause</span>

          <strong>
            {formatLabel(recoveryCase.rootCause)}
          </strong>
        </article>
      </div>

      {recoveryCase.aiReasoning && (
        <article className="details-card">
          <div className="details-card-heading">
            <div>
              <p className="section-eyebrow">Vidur AI</p>

              <h2>AI reasoning</h2>
            </div>
          </div>

          <p>{recoveryCase.aiReasoning}</p>
        </article>
      )}

      <VidurRecoveryPanel
        recoveryCaseId={recoveryCase.id}
        onCompleted={() => {
          window.location.reload()
        }}
      />

      <div className="case-details-grid">
        <article className="details-card">
          <div className="details-card-heading">
            <div>
              <p className="section-eyebrow">
                Customer
              </p>

              <h2>Customer information</h2>
            </div>
          </div>

          <div className="detail-list">
            <div>
              <span>Name</span>
              <strong>
                {recoveryCase.customer.name}
              </strong>
            </div>

            <div>
              <span>Email</span>
              <strong>
                {recoveryCase.customer.email}
              </strong>
            </div>

            {recoveryCase.customer.phone && (
              <div>
                <span>Phone</span>
                <strong>
                  {recoveryCase.customer.phone}
                </strong>
              </div>
            )}
          </div>
        </article>

        <article className="details-card">
          <div className="details-card-heading">
            <div>
              <p className="section-eyebrow">
                Payment
              </p>

              <h2>Payment information</h2>
            </div>
          </div>

          {recoveryCase.payment ? (
            <div className="detail-list">
              <div>
                <span>Amount</span>
                <strong>
                  {formatAmount(
                    recoveryCase.payment.amount,
                    recoveryCase.payment.currency,
                  )}
                </strong>
              </div>

              <div>
                <span>Method</span>
                <strong>
                  {formatLabel(
                    recoveryCase.payment.method,
                  )}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>
                  {formatLabel(
                    recoveryCase.payment.status,
                  )}
                </strong>
              </div>

              <div>
                <span>Failure reason</span>
                <strong>
                  {formatLabel(
                    recoveryCase.payment
                      .failureReason,
                  )}
                </strong>
              </div>

              <div>
                <span>Attempt</span>
                <strong>
                  #{recoveryCase.payment.attemptNumber}
                </strong>
              </div>
            </div>
          ) : (
            <p className="empty-detail">
              No payment information available.
            </p>
          )}
        </article>
      </div>

      <article className="details-card">
        <div className="details-card-heading">
          <div>
            <p className="section-eyebrow">
              Agent activity
            </p>

            <h2>Recovery timeline</h2>
          </div>
        </div>

        {recoveryCase.actions.length > 0 ? (
          <div className="action-timeline">
            {recoveryCase.actions.map((action) => (
              <div
                className="timeline-item"
                key={action.id}
              >
                <div className="timeline-icon">
                  {getActionIcon(action.status)}
                </div>

                <div className="timeline-content">
                  <div className="timeline-main">
                    <strong>
                      {formatLabel(action.type)}
                    </strong>

                    <span
                      className={`status-pill status-${action.status.toLowerCase()}`}
                    >
                      {formatLabel(action.status)}
                    </span>
                  </div>

                  {action.reason && (
                    <p>{action.reason}</p>
                  )}

                  {action.policyDecision && (
                    <span className="policy-result">
                      Policy: {formatLabel(
                        action.policyDecision,
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-detail">
            No recovery actions recorded yet.
          </p>
        )}
      </article>

      {recoveryCase.outcome && (
        <article className="outcome-card">
          <div>
            <p className="section-eyebrow">
              Recovery outcome
            </p>

            <h2>
              {recoveryCase.outcome.successful
                ? 'Revenue recovered'
                : 'Recovery unsuccessful'}
            </h2>
          </div>

          <strong>
            {formatAmount(
              recoveryCase.outcome.recoveredAmount,
            )}
          </strong>
        </article>
      )}
    </section>
  )
}