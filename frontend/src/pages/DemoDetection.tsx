import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Circle, CreditCard, ExternalLink, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  createRazorpayCheckoutOrder,
  getPaymentByExternalId,
  type PaymentWithCase,
} from '../api/razorpay'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { ResetDemoDataButton } from '../components/demo/ResetDemoDataButton'
import { formatAmount, formatLabel } from '../lib/status'
import { cn } from '../lib/utils'
import { loadRazorpayCheckoutScript } from '../lib/razorpayCheckout'

type LiveStage =
  | 'idle'
  | 'creating_order'
  | 'awaiting_checkout'
  | 'payment_failed'
  | 'detecting'
  | 'detected'
  | 'timeout'

const LIVE_STAGE_LABEL: Record<LiveStage, string> = {
  idle: 'Ready to start',
  creating_order: 'Creating Razorpay order…',
  awaiting_checkout: 'Checkout is open',
  payment_failed: 'Payment failure received',
  detecting: 'Vidur is processing the event…',
  detected: 'Recovery case created',
  timeout: 'Detection timed out — check the backend webhook',
}

const POLL_INTERVAL_MS = 2500
const POLL_MAX_ATTEMPTS = 16

/**
 * Live Razorpay Test Mode demonstration for Feature #1:
 * detect revenue at risk from a real payment failure.
 *
 * This page intentionally focuses on the real Razorpay flow. The old
 * manual/simulated failure trigger has been removed from the UI so a judge
 * sees one clear path: real checkout -> real webhook -> Vidur detection.
 */
export function DemoDetection() {
  const { token } = useAuth()

  const [liveAmount, setLiveAmount] = useState('25000')
  const [liveCustomerName, setLiveCustomerName] =
    useState('Vidur Live Customer')
  const [liveCustomerEmail, setLiveCustomerEmail] = useState('')
  const [liveCustomerPhone, setLiveCustomerPhone] = useState('')
  const [liveStage, setLiveStage] = useState<LiveStage>('idle')
  const [liveError, setLiveError] = useState<string | null>(null)
  const [detectedPayment, setDetectedPayment] =
    useState<PaymentWithCase | null>(null)

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  function startPollingForRecoveryCase(razorpayPaymentId: string) {
    if (!token) return

    setLiveStage('detecting')
    let attempts = 0

    pollTimerRef.current = setInterval(async () => {
      attempts += 1

      try {
        const payment = await getPaymentByExternalId(
          token,
          razorpayPaymentId,
        )

        if (payment && payment.recoveryCases.length > 0) {
          stopPolling()
          setDetectedPayment(payment)
          setLiveStage('detected')
          return
        }
      } catch (err) {
        stopPolling()
        setLiveError(
          err instanceof Error
            ? err.message
            : 'Failed to check for the recovery case.',
        )
        return
      }

      if (attempts >= POLL_MAX_ATTEMPTS) {
        stopPolling()
        setLiveStage('timeout')
      }
    }, POLL_INTERVAL_MS)
  }

  async function handleStartLivePayment() {
    if (!token) return

    setLiveError(null)
    setDetectedPayment(null)
    stopPolling()

    const parsedAmount = Number(liveAmount)

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setLiveError('Enter a valid positive amount.')
      return
    }

    setLiveStage('creating_order')

    try {
      const order = await createRazorpayCheckoutOrder(token, {
        amount: parsedAmount,
        customerName: liveCustomerName || undefined,
      })

      await loadRazorpayCheckoutScript()

      if (!window.Razorpay) {
        throw new Error('Razorpay Checkout script did not load.')
      }

      setLiveStage('awaiting_checkout')

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'Vidur AI',
        description: 'Razorpay Test Mode payment',
        prefill: {
          name: liveCustomerName || undefined,
          email: liveCustomerEmail || undefined,
          contact: liveCustomerPhone || undefined,
        },
        theme: { color: '#2563eb' },
        modal: {
          ondismiss: () => {
            setLiveStage((current) =>
              current === 'awaiting_checkout' ? 'idle' : current,
            )
          },
        },
        handler: () => {
          // The live demo focuses on payment.failed detection.
        },
      })

      rzp.on('payment.failed', (response) => {
        const { error: rzpError } = response

        setLiveStage('payment_failed')

        if (rzpError.metadata?.payment_id) {
          startPollingForRecoveryCase(rzpError.metadata.payment_id)
        }
      })

      rzp.open()
    } catch (err) {
      setLiveStage('idle')
      setLiveError(
        err instanceof Error
          ? err.message
          : 'Failed to start Razorpay checkout.',
      )
    }
  }

  function handleReset() {
    setLiveError(null)
    setDetectedPayment(null)
    setLiveStage('idle')
    stopPolling()
  }

  const liveBusy =
    liveStage === 'creating_order' ||
    liveStage === 'awaiting_checkout' ||
    liveStage === 'detecting'

  const liveEditable = liveStage === 'idle' || liveStage === 'timeout'

  const trackerSteps = [
    {
      key: 'order',
      label: 'Checkout',
      done: liveStage !== 'idle',
    },
    {
      key: 'failed',
      label: 'Payment failed',
      done: ['payment_failed', 'detecting', 'detected', 'timeout'].includes(
        liveStage,
      ),
    },
    {
      key: 'detected',
      label: 'Vidur detected',
      done: liveStage === 'detected',
    },
    {
      key: 'case',
      label: 'Case created',
      done: liveStage === 'detected' && Boolean(detectedPayment),
    },
  ] as const

  return (
    <section className="pb-10">
      <header className="flex items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Live detection
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-[28px]">
            Payment detection
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Test a real Razorpay payment and watch Vidur detect the failure.
          </p>
        </div>

        <ResetDemoDataButton onReset={handleReset} className="shrink-0" />
      </header>

      {liveError && (
        <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {liveError}
        </div>
      )}

      <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="h-1 bg-primary" />

        <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <CreditCard size={18} />
              </div>

              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Razorpay Checkout
                </h2>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Test Mode</span>
                  <span aria-hidden="true">·</span>
                  <span>No real money</span>
                </div>
              </div>
            </div>

            {liveStage !== 'idle' && (
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-medium',
                  liveStage === 'detected'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'bg-secondary text-muted-foreground',
                )}
              >
                {LIVE_STAGE_LABEL[liveStage]}
              </span>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="live-amount">Amount</Label>
              <Input
                id="live-amount"
                type="number"
                min="1"
                value={liveAmount}
                onChange={(event) => setLiveAmount(event.target.value)}
                disabled={!liveEditable}
                className="h-10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="live-customer">Customer</Label>
              <Input
                id="live-customer"
                value={liveCustomerName}
                onChange={(event) => setLiveCustomerName(event.target.value)}
                disabled={!liveEditable}
                className="h-10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="live-customer-email">Email</Label>
              <Input
                id="live-customer-email"
                type="email"
                placeholder="you@example.com"
                value={liveCustomerEmail}
                onChange={(event) => setLiveCustomerEmail(event.target.value)}
                disabled={!liveEditable}
                className="h-10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="live-customer-phone">Phone</Label>
              <Input
                id="live-customer-phone"
                type="tel"
                placeholder="+91XXXXXXXXXX"
                value={liveCustomerPhone}
                onChange={(event) => setLiveCustomerPhone(event.target.value)}
                disabled={!liveEditable}
                className="h-10"
              />
            </div>
          </div>

          <Button
            className="mt-5 h-11 w-full gap-2"
            onClick={handleStartLivePayment}
            disabled={!token || liveBusy}
          >
            {liveBusy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CreditCard size={16} />
            )}

            {liveStage === 'creating_order'
              ? 'Creating order…'
              : liveStage === 'awaiting_checkout'
                ? 'Checkout open…'
                : 'Open Razorpay Checkout'}
          </Button>

          <div className="mt-7 border-t border-border pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Detection
              </h3>
              <span className="text-xs text-muted-foreground">
                Live status
              </span>
            </div>

            <ol className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {trackerSteps.map((step, index) => (
                <li
                  key={step.key}
                  className={cn(
                    'flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2.5',
                    step.done
                      ? 'border-emerald-500/25 bg-emerald-500/5'
                      : 'border-border bg-background',
                  )}
                >
                  {step.done ? (
                    <CheckCircle2
                      size={15}
                      className="shrink-0 text-emerald-600 dark:text-emerald-400"
                    />
                  ) : (
                    <Circle
                      size={15}
                      className="shrink-0 text-muted-foreground"
                    />
                  )}

                  <span className="text-xs font-medium text-foreground">
                    {index + 1}. {step.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {detectedPayment && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Recovery case created
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatAmount(
                    detectedPayment.recoveryCases[0]?.revenueAtRisk ?? '0',
                  )}{' '}
                  at risk ·{' '}
                  {formatLabel(detectedPayment.recoveryCases[0]?.riskLevel)}{' '}
                  risk
                </p>
              </div>

              <a
                href={`/recovery-cases/${detectedPayment.recoveryCases[0]?.id}`}
                className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                View case
                <ExternalLink size={13} />
              </a>
            </div>
          )}
        </div>
      </section>

      <div className="mt-4 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span>Razorpay Test Mode</span>
        <a
          href="https://razorpay.com/docs/payments/payments/test-card-upi-details/"
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground hover:underline"
        >
          Test cards
        </a>
      </div>
    </section>
  )
}
