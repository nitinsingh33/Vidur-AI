import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CircleDollarSign,
  Loader2,
  RefreshCw,
  ShoppingCart,
  Timer,
} from 'lucide-react'
import {
  getRecoveryCases,
  type RecoveryCase,
} from '../api/recoveryCases'
import { runCheckoutSweep } from '../api/checkoutSweep'
import { useAuth } from '../context/AuthContext'
import { MetricCard } from '../components/dashboard/MetricCard'
import { RecoveryCasesTable } from '../components/recovery/RecoveryCasesTable'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { formatAmount } from '../lib/status'

const OPEN_STATUSES = new Set(['OPEN', 'ELIGIBLE', 'IN_PROGRESS', 'ESCALATED'])

export function CheckoutDropOff() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [cases, setCases] = useState<RecoveryCase[]>([])
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
        const result = await getRecoveryCases(token as string, {
          rootCause: 'CHECKOUT_ABANDONED',
          limit: 50,
        })
        setCases(result.data)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load checkout drop-off cases.',
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
      const result = await runCheckoutSweep(token)
      setSweepMessage(
        result.opened > 0
          ? `Scanned ${result.scanned} stale checkout${result.scanned === 1 ? '' : 's'}, opened ${result.opened} new case${result.opened === 1 ? '' : 's'}.`
          : `Scanned ${result.scanned} stale checkout${result.scanned === 1 ? '' : 's'} — nothing new past the grace period yet.`,
      )
      const refreshed = await getRecoveryCases(token, {
        rootCause: 'CHECKOUT_ABANDONED',
        limit: 50,
      })
      setCases(refreshed.data)
    } catch (err) {
      setSweepMessage(
        err instanceof Error ? err.message : 'Unable to run the sweep.',
      )
    } finally {
      setSweeping(false)
    }
  }

  const openCases = cases.filter((item) => OPEN_STATUSES.has(item.status))
  const revenueAtRisk = openCases.reduce(
    (total, item) => total + Number(item.revenueAtRisk),
    0,
  )
  const recoveredCases = cases.filter(
    (item) => item.outcome?.successful,
  )
  const revenueRecovered = recoveredCases.reduce(
    (total, item) => total + Number(item.outcome?.recoveredAmount ?? 0),
    0,
  )

  return (
    <section className="pb-12">
      <header className="flex flex-col gap-5 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShoppingCart size={16} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Recovery intelligence
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-[-0.03em] text-foreground">
              Checkout Drop-off
            </h1>
          </div>
        </div>

        <Button onClick={handleRunSweep} disabled={sweeping} variant="outline">
          {sweeping ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <RefreshCw size={15} />
          )}
          Run sweep now
        </Button>
      </header>

      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        A real Order created via checkout that's still unpaid past the grace
        period is treated as an abandoned checkout. A scheduled sweep detects
        these automatically in the background — use "Run sweep now" to check
        immediately instead of waiting for the next interval.
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
              label="Abandoned checkouts open"
              value={String(openCases.length)}
              description="Currently being managed"
              icon={Timer}
              tone="amber"
            />

            <MetricCard
              label="Revenue at risk"
              value={formatAmount(revenueAtRisk)}
              description="Across open checkout cases"
              icon={ShoppingCart}
              tone="primary"
            />

            <MetricCard
              label="Revenue recovered"
              value={formatAmount(revenueRecovered)}
              description={`${recoveredCases.length} recovered checkout${recoveredCases.length === 1 ? '' : 's'}`}
              icon={CircleDollarSign}
              tone="emerald"
            />
          </div>

          <div className="mt-6">
            <RecoveryCasesTable
              cases={cases}
              onOpenRecoveryCase={(recoveryCaseId) =>
                navigate(`/recovery-cases/${recoveryCaseId}`)
              }
            />
          </div>
        </>
      )}
    </section>
  )
}
