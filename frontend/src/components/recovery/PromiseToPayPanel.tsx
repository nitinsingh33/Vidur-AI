import { useEffect, useState, type FormEvent } from 'react'
import { CalendarClock, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import {
  createPromise,
  getPromises,
  runPromiseSweep,
  type PromiseToPay,
} from '../../api/promises'
import type { RecoveryCase } from '../../api/recoveryCases'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { StatusBadge } from '../ui/status-badge'
import { formatAmount, promiseStatusTone } from '../../lib/status'

interface PromiseToPayPanelProps {
  recoveryCase: RecoveryCase
}

function daysFromNow(dateIso: string): string {
  const diffMs = new Date(dateIso).getTime() - Date.now()
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000))
  if (days === 0) return 'today'
  if (days > 0) return `in ${days} day${days === 1 ? '' : 's'}`
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
}

/**
 * A genuine merchant/customer interaction, not a fabricated record: a
 * merchant records this only after actually speaking with the customer
 * about an overdue invoice (see PromiseToPayService.create on the backend).
 * Verification is entirely real — the sweep never trusts this panel's data,
 * only the recovery case's own webhook/markPaid-derived status.
 */
export function PromiseToPayPanel({ recoveryCase }: PromiseToPayPanelProps) {
  const { token } = useAuth()

  const [promise, setPromise] = useState<PromiseToPay | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [amount, setAmount] = useState('')
  const [promisedDate, setPromisedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [verifying, setVerifying] = useState(false)
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null)

  async function fetchLatestPromise(authToken: string) {
    const all = await getPromises(authToken)
    const forCase = all
      .filter((item) => item.recoveryCaseId === recoveryCase.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    return forCase[0] ?? null
  }

  useEffect(() => {
    if (!token || !recoveryCase.invoice) return
    const authToken = token

    async function load() {
      try {
        setLoading(true)
        setError(null)
        setPromise(await fetchLatestPromise(authToken))
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load promise-to-pay data.',
        )
      } finally {
        setLoading(false)
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, recoveryCase.id])

  if (!recoveryCase.invoice) {
    return null
  }

  async function handleRecord(event: FormEvent) {
    event.preventDefault()
    if (!token) return

    try {
      setSubmitting(true)
      setError(null)

      if (!amount || Number(amount) <= 0) {
        throw new Error('Enter a positive promised amount.')
      }
      if (!promisedDate) {
        throw new Error('Enter the date the customer promised to pay by.')
      }

      await createPromise(token, {
        recoveryCaseId: recoveryCase.id,
        promisedAmount: Number(amount),
        promisedDate: new Date(promisedDate).toISOString(),
        notes: notes.trim() || undefined,
      })

      setAmount('')
      setPromisedDate('')
      setNotes('')
      setPromise(await fetchLatestPromise(token))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to record the promise.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerifyNow() {
    if (!token) return

    try {
      setVerifying(true)
      setVerifyMessage(null)
      const result = await runPromiseSweep(token)
      setVerifyMessage(
        result.scanned > 0
          ? `Checked ${result.scanned} due promise(s): ${result.kept} kept, ${result.missed} missed.`
          : 'No promises are due for verification yet.',
      )
      setPromise(await fetchLatestPromise(token))
    } catch (err) {
      setVerifyMessage(
        err instanceof Error ? err.message : 'Unable to run verification.',
      )
    } finally {
      setVerifying(false)
    }
  }

  const canRecordNew =
    !promise || promise.status !== 'PENDING'
  const invoiceAlreadyPaid = recoveryCase.invoice.status === 'PAID'

  return (
    <article className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-secondary">
          <CalendarClock size={15} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            B2B receivable
          </p>
          <h2 className="mt-0.5 text-sm font-semibold text-foreground">
            Promise to pay
          </h2>
        </div>
      </header>

      <div className="p-5">
        {loading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {error && (
          <p className="mb-3 text-sm text-destructive">{error}</p>
        )}

        {!loading && promise && (
          <div className="rounded-xl border border-border bg-secondary/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {promise.status === 'KEPT' && (
                  <CheckCircle2 size={15} className="text-emerald-500" />
                )}
                {promise.status === 'MISSED' && (
                  <XCircle size={15} className="text-destructive" />
                )}
                <StatusBadge label={promise.status} tone={promiseStatusTone(promise.status)} />
              </div>
              <span className="text-xs text-muted-foreground">
                Promised {daysFromNow(promise.promisedDate)} (
                {new Date(promise.promisedDate).toLocaleString()})
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Promised amount</dt>
                <dd className="font-medium text-foreground">
                  {formatAmount(promise.promisedAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Recovered amount</dt>
                <dd className="font-medium text-foreground">
                  {promise.recoveredAmount
                    ? formatAmount(promise.recoveredAmount)
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Source</dt>
                <dd className="font-medium text-foreground">
                  Merchant recorded
                </dd>
              </div>
            </dl>

            {promise.notes && (
              <p className="mt-3 text-xs italic text-muted-foreground">
                &ldquo;{promise.notes}&rdquo;
              </p>
            )}

            {promise.status === 'PENDING' && (
              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant="outline"
                  className="h-7 px-2.5 text-xs"
                  disabled={verifying}
                  onClick={handleVerifyNow}
                >
                  {verifying ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    'Verify now'
                  )}
                </Button>
                {verifyMessage && (
                  <span className="text-xs text-muted-foreground">
                    {verifyMessage}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {!loading && canRecordNew && !invoiceAlreadyPaid && (
          <form onSubmit={handleRecord} className={promise ? 'mt-4' : ''}>
            <p className="mb-3 text-xs text-muted-foreground">
              Record a promise only after actually speaking with the customer
              about this overdue invoice.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  Promised amount (₹)
                </Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  className="mt-1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  Promised by
                </Label>
                <Input
                  type="datetime-local"
                  className="mt-1"
                  value={promisedDate}
                  onChange={(event) => setPromisedDate(event.target.value)}
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  Notes (optional)
                </Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. spoke with finance team"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
            </div>
            <Button type="submit" className="mt-3 h-8" disabled={submitting}>
              {submitting && <Loader2 size={13} className="animate-spin" />}
              Record promise
            </Button>
          </form>
        )}

        {!loading && invoiceAlreadyPaid && !promise && (
          <p className="text-sm text-muted-foreground">
            This invoice is already paid — there is nothing to promise.
          </p>
        )}
      </div>
    </article>
  )
}
