import { useState } from 'react'
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  resetFashionKartDemoData,
  type FashionKartResetSummary,
} from '../../api/demo'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

interface ResetDemoDataButtonProps {
  /** Called after a successful reset so the caller can refetch its data. */
  onReset?: () => void
  className?: string
}

/**
 * The one "start clean" control for FashionKart's demo data — deletes every
 * demo-tagged order/payment/subscription/invoice/mandate and the recovery
 * cases built on top of them (see FashionKartDemoResetService). Backend
 * enforces ADMIN + isDemoMerchant regardless of who can see this button, so
 * it's safe to render wherever a merchant would want a fresh slate before a
 * new round of testing.
 */
export function ResetDemoDataButton({
  onReset,
  className,
}: ResetDemoDataButtonProps) {
  const { token } = useAuth()

  const [resetting, setResetting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastReset, setLastReset] = useState<FashionKartResetSummary | null>(
    null,
  )

  async function handleReset() {
    if (!token) return

    setResetting(true)
    setError(null)

    try {
      const result = await resetFashionKartDemoData(token)
      setLastReset(result)
      setConfirming(false)
      onReset?.()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to reset demo data.',
      )
    } finally {
      setResetting(false)
    }
  }

  const expanded = confirming || Boolean(error) || Boolean(lastReset)

  return (
    // relative + inline-block so the expanded panel below is positioned
    // against this button alone — never against whatever flex row it's
    // sitting in (a page header, say). Without that, a long confirm message
    // forces the whole row wider than the viewport instead of just wrapping
    // inside its own bounded panel.
    <div className={cn('relative inline-block', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setError(null)
          setLastReset(null)
          setConfirming(true)
        }}
        disabled={resetting || confirming || !token}
        className="shrink-0 gap-2"
      >
        {resetting ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <RotateCcw size={14} />
        )}
        Clean up demo data
      </Button>

      {expanded && (
        <div className="absolute right-0 top-full z-20 mt-2 w-[min(90vw,26rem)] rounded-lg border border-border bg-card p-1 shadow-lg">
          {confirming && (
            <div className="flex flex-col gap-3 rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-sm">
              <div className="flex gap-2.5">
                <AlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                />
                <p className="text-amber-800 dark:text-amber-300">
                  This permanently deletes every demo order, payment,
                  subscription, invoice, mandate, and recovery case (with
                  their actions/outcomes/promises/audit entries). Products,
                  policies, and the admin account are never touched. This
                  cannot be undone.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirming(false)}
                  disabled={resetting}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleReset} disabled={resetting}>
                  {resetting && <Loader2 size={14} className="animate-spin" />}
                  Delete everything
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {lastReset && (
            <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                Demo data cleared.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                <span>{lastReset.ordersDeleted} order(s)</span>
                <span>{lastReset.paymentsDeleted} payment(s)</span>
                <span>{lastReset.paymentEventsDeleted} payment event(s)</span>
                <span>{lastReset.subscriptionsDeleted} subscription(s)</span>
                <span>{lastReset.invoicesDeleted} invoice(s)</span>
                <span>{lastReset.mandatesDeleted} mandate(s)</span>
                <span>{lastReset.recoveryCasesDeleted} recovery case(s)</span>
                <span>{lastReset.recoveryActionsDeleted} action(s)</span>
                <span>{lastReset.recoveryOutcomesDeleted} outcome(s)</span>
                <span>{lastReset.promisesToPayDeleted} promise(s)</span>
                <span>{lastReset.auditLogsDeleted} audit log(s)</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
