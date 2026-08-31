import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { getPromises, runPromiseSweep, type PromiseToPay } from '../api/promises'
import { useAuth } from '../context/AuthContext'
import { MetricCard } from '../components/dashboard/MetricCard'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { StatusBadge } from '../components/ui/status-badge'
import { actionStatusTone, formatAmount, formatLabel, promiseStatusTone } from '../lib/status'

function daysLabel(dateIso: string): string {
  const diffMs = new Date(dateIso).getTime() - Date.now()
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000))
  if (days === 0) return 'Today'
  if (days > 0) return `In ${days}d`
  return `${Math.abs(days)}d overdue`
}

function nextActionLabel(promise: PromiseToPay): string {
  if (promise.status === 'KEPT') return 'None — recovered'
  if (promise.status === 'PENDING') {
    return new Date(promise.promisedDate).getTime() > Date.now()
      ? 'Waiting for promised date'
      : 'Ready to verify'
  }

  // MISSED
  const caseStatus = promise.recoveryCase.status
  if (caseStatus === 'ESCALATED') return 'Escalated for human review'
  if (caseStatus === 'STOPPED' || caseStatus === 'EXHAUSTED') {
    return 'No further action — case closed'
  }
  const latestAction = promise.recoveryCase.actions[0]
  if (latestAction) {
    return `Vidur: ${formatLabel(latestAction.type)}`
  }
  return 'Vidur re-evaluating'
}

export function PromiseToPay() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [promises, setPromises] = useState<PromiseToPay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sweeping, setSweeping] = useState(false)
  const [sweepMessage, setSweepMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const data = await getPromises(token as string)
        setPromises(data)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load promises.',
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  async function handleRunSweep() {
    if (!token) return

    try {
      setSweeping(true)
      setSweepMessage(null)
      const result = await runPromiseSweep(token)
      setSweepMessage(
        result.scanned > 0
          ? `Checked ${result.scanned} due promise${result.scanned === 1 ? '' : 's'}: ${result.kept} kept, ${result.missed} missed.`
          : 'No promises are due for verification yet.',
      )
      const data = await getPromises(token)
      setPromises(data)
    } catch (err) {
      setSweepMessage(
        err instanceof Error ? err.message : 'Unable to run verification.',
      )
    } finally {
      setSweeping(false)
    }
  }

  const pending = promises.filter((p) => p.status === 'PENDING')
  const kept = promises.filter((p) => p.status === 'KEPT')
  const missed = promises.filter((p) => p.status === 'MISSED')

  const pendingAmount = pending.reduce(
    (total, p) => total + Number(p.promisedAmount),
    0,
  )
  const recoveredAmount = kept.reduce(
    (total, p) => total + Number(p.recoveredAmount ?? 0),
    0,
  )

  return (
    <section className="pb-12">
      <header className="flex flex-col gap-5 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarClock size={16} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Recovery intelligence
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-[-0.03em] text-foreground">
              Promise to Pay
            </h1>
          </div>
        </div>

        <Button onClick={handleRunSweep} disabled={sweeping} variant="outline">
          {sweeping ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <RefreshCw size={15} />
          )}
          Run verification now
        </Button>
      </header>

      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Promises are recorded from a case's detail page after a real
        conversation with the customer. Verification never trusts the
        promise itself — only a real payment confirmation (webhook or
        merchant "Mark Paid") ever moves one to Kept.
      </p>

      {sweepMessage && (
        <div className="mt-3 rounded-lg border border-border bg-secondary/30 px-4 py-2.5 text-sm text-muted-foreground">
          {sweepMessage}
        </div>
      )}

      {loading && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <MetricCard
              label="Pending"
              value={formatAmount(pendingAmount)}
              description={`${pending.length} promise${pending.length === 1 ? '' : 's'} awaiting verification`}
              icon={Clock3}
              tone="amber"
            />
            <MetricCard
              label="Kept"
              value={formatAmount(recoveredAmount)}
              description={`${kept.length} promise${kept.length === 1 ? '' : 's'} — real payment confirmed`}
              icon={CheckCircle2}
              tone="emerald"
            />
            <MetricCard
              label="Missed"
              value={String(missed.length)}
              description="Handed back to the automatic recovery pipeline"
              icon={XCircle}
              tone="primary"
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Promises
              </p>
              <h2 className="mt-1 text-base font-semibold text-foreground">
                All promises
              </h2>
            </div>

            {promises.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-medium text-foreground">
                  No promises recorded yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Record one from an invoice-linked recovery case after
                  speaking with the customer.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Customer</th>
                      <th className="px-3 py-3 font-medium">Invoice</th>
                      <th className="px-3 py-3 font-medium">Promised amount</th>
                      <th className="px-3 py-3 font-medium">Promised date</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Next action</th>
                      <th className="px-3 py-3 font-medium">Recovered</th>
                    </tr>
                  </thead>

                  <tbody>
                    {promises.map((promise) => (
                      <tr
                        key={promise.id}
                        className="cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/40"
                        onClick={() =>
                          navigate(`/recovery-cases/${promise.recoveryCaseId}`)
                        }
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {promise.customer.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {promise.customer.email ?? 'No email'}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-3.5 text-muted-foreground">
                          {formatAmount(promise.invoice.amount, promise.invoice.currency)}
                        </td>

                        <td className="px-3 py-3.5 font-medium text-foreground">
                          {formatAmount(promise.promisedAmount)}
                        </td>

                        <td className="px-3 py-3.5">
                          <div className="flex flex-col">
                            <span className="text-foreground">
                              {new Date(promise.promisedDate).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {daysLabel(promise.promisedDate)}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-3.5">
                          <StatusBadge
                            label={promise.status}
                            tone={promiseStatusTone(promise.status)}
                          />
                        </td>

                        <td className="px-3 py-3.5">
                          <span className="text-xs text-muted-foreground">
                            {nextActionLabel(promise)}
                          </span>
                          {promise.recoveryCase.actions[0] && (
                            <StatusBadge
                              className="ml-2"
                              label={promise.recoveryCase.actions[0].status}
                              tone={actionStatusTone(promise.recoveryCase.actions[0].status)}
                            />
                          )}
                        </td>

                        <td className="px-3 py-3.5 font-medium text-foreground">
                          {promise.recoveredAmount
                            ? formatAmount(promise.recoveredAmount)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
