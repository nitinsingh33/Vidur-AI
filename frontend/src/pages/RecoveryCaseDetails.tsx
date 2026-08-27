import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Clock3, Sparkles, XCircle } from 'lucide-react'
import {
  getRecoveryCase,
  type RecoveryCase,
} from '../api/recoveryCases'
import { VidurRecoveryPanel } from '../components/recovery/VidurRecoveryPanel'
import { StatusBadge } from '../components/ui/status-badge'
import { Skeleton } from '../components/ui/skeleton'
import { useAuth } from '../context/AuthContext'
import {
  actionStatusTone,
  caseStatusTone,
  formatAmount,
  formatLabel,
  policyTone,
  riskTone,
} from '../lib/status'

function getActionIcon(status: string) {
  if (status === 'SUCCESS') return <CheckCircle2 size={16} />
  if (status === 'FAILED') return <XCircle size={16} />
  return <Clock3 size={16} />
}

export function RecoveryCaseDetails() {
  const { recoveryCaseId } = useParams<{ recoveryCaseId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const [recoveryCase, setRecoveryCase] = useState<RecoveryCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    async function loadCase() {
      try {
        setLoading(true)
        setError(null)
        if (!recoveryCaseId) return

        const data = await getRecoveryCase(token as string, recoveryCaseId)
        setRecoveryCase(data)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load recovery case.',
        )
      } finally {
        setLoading(false)
      }
    }

    loadCase()
  }, [recoveryCaseId, token])

  if (loading) {
    return (
      <section className="mx-auto max-w-5xl pb-12">
        <Skeleton className="mb-6 h-5 w-40" />
        <Skeleton className="mb-3 h-9 w-72" />
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </section>
    )
  }

  if (error || !recoveryCase) {
    return (
      <section className="mx-auto max-w-5xl pb-12">
        <button
          type="button"
          onClick={() => navigate('/recovery-cases')}
          className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to recovery cases
        </button>

        <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-6 text-sm text-destructive">
          {error ?? 'Recovery case not found.'}
        </div>
      </section>
    )
  }

  const probability = Math.round(
    Number(recoveryCase.recoveryProbability) * 100,
  )

  return (
    <section className="mx-auto max-w-5xl pb-12">
      <button
        type="button"
        onClick={() => navigate('/recovery-cases')}
        className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} />
        Back to recovery cases
      </button>

      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            Recovery case
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
            Case details
          </h1>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {recoveryCase.id}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusBadge label={recoveryCase.status} tone={caseStatusTone(recoveryCase.status)} />
          <StatusBadge
            label={`${formatLabel(recoveryCase.riskLevel)} risk`}
            tone={riskTone(recoveryCase.riskLevel)}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-5">
          <span className="text-xs text-muted-foreground">Revenue at risk</span>
          <strong className="mt-2 block text-2xl font-semibold text-foreground">
            {formatAmount(recoveryCase.revenueAtRisk)}
          </strong>
        </article>

        <article className="rounded-xl border border-border bg-card p-5">
          <span className="text-xs text-muted-foreground">Recovery probability</span>
          <strong className="mt-2 block text-2xl font-semibold text-foreground">
            {probability}%
          </strong>
        </article>

        <article className="rounded-xl border border-border bg-card p-5">
          <span className="text-xs text-muted-foreground">Root cause</span>
          <strong className="mt-2 block text-2xl font-semibold text-foreground">
            {formatLabel(recoveryCase.rootCause)}
          </strong>
        </article>
      </div>

      {recoveryCase.aiReasoning && (
        <article className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-6">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles size={14} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Vidur AI
              </p>
              <h2 className="text-sm font-semibold text-foreground">
                AI reasoning
              </h2>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {recoveryCase.aiReasoning}
          </p>
        </article>
      )}

      <VidurRecoveryPanel
        recoveryCaseId={recoveryCase.id}
        onCompleted={() => window.location.reload()}
      />

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Customer
          </p>
          <h2 className="mt-1 mb-4 text-base font-semibold text-foreground">
            Customer information
          </h2>

          <dl className="space-y-3">
            <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
              <dt className="text-xs text-muted-foreground">Name</dt>
              <dd className="text-sm font-medium text-foreground">
                {recoveryCase.customer.name}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="text-sm font-medium text-foreground">
                {recoveryCase.customer.email}
              </dd>
            </div>
            {recoveryCase.customer.phone && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd className="text-sm font-medium text-foreground">
                  {recoveryCase.customer.phone}
                </dd>
              </div>
            )}
          </dl>
        </article>

        <article className="rounded-xl border border-border bg-card p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Payment
          </p>
          <h2 className="mt-1 mb-4 text-base font-semibold text-foreground">
            Payment information
          </h2>

          {recoveryCase.payment ? (
            <dl className="space-y-3">
              <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
                <dt className="text-xs text-muted-foreground">Amount</dt>
                <dd className="text-sm font-medium text-foreground">
                  {formatAmount(recoveryCase.payment.amount, recoveryCase.payment.currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
                <dt className="text-xs text-muted-foreground">Method</dt>
                <dd className="text-sm font-medium text-foreground">
                  {formatLabel(recoveryCase.payment.method)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd className="text-sm font-medium text-foreground">
                  {formatLabel(recoveryCase.payment.status)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
                <dt className="text-xs text-muted-foreground">Failure reason</dt>
                <dd className="text-sm font-medium text-foreground">
                  {formatLabel(recoveryCase.payment.failureReason)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-xs text-muted-foreground">Attempt</dt>
                <dd className="text-sm font-medium text-foreground">
                  #{recoveryCase.payment.attemptNumber}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              No payment information available.
            </p>
          )}
        </article>
      </div>

      <article className="mt-4 rounded-xl border border-border bg-card p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Agent activity
        </p>
        <h2 className="mt-1 mb-5 text-base font-semibold text-foreground">
          Recovery timeline
        </h2>

        {recoveryCase.actions.length > 0 ? (
          <div className="space-y-0">
            {recoveryCase.actions.map((action, index) => (
              <div key={action.id} className="relative flex gap-3.5 pb-6 last:pb-0">
                {index < recoveryCase.actions.length - 1 && (
                  <span className="absolute left-4 top-8 bottom-0 w-px bg-border" />
                )}

                <div className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  {getActionIcon(action.status)}
                </div>

                <div className="min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <strong className="text-sm font-semibold text-foreground">
                      {formatLabel(action.type)}
                    </strong>
                    <StatusBadge label={action.status} tone={actionStatusTone(action.status)} />
                  </div>

                  {action.reason && (
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {action.reason}
                    </p>
                  )}

                  {action.policyDecision && (
                    <StatusBadge
                      className="mt-2"
                      label={`Policy: ${formatLabel(action.policyDecision)}`}
                      tone={policyTone(action.policyDecision)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No recovery actions recorded yet.
          </p>
        )}
      </article>

      {recoveryCase.outcome && (
        <article className="mt-4 flex items-center justify-between gap-6 rounded-xl border border-border bg-card p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recovery outcome
            </p>
            <h2 className="mt-1 text-base font-semibold text-foreground">
              {recoveryCase.outcome.successful
                ? 'Revenue recovered'
                : 'Recovery unsuccessful'}
            </h2>
          </div>

          <strong className="text-2xl font-semibold text-foreground">
            {formatAmount(recoveryCase.outcome.recoveredAmount)}
          </strong>
        </article>
      )}
    </section>
  )
}
