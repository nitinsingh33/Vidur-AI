import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  Circle,
  CreditCard,
  ExternalLink,
  Loader2,
  RotateCcw,
  Zap,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  resetDemo,
  triggerDemoPaymentFailure,
  type DemoResetResponse,
  type TriggerDemoFailureResponse,
} from '../api/demo'
import {
  createRazorpayCheckoutOrder,
  getPaymentByExternalId,
  type PaymentWithCase,
} from '../api/razorpay'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { formatAmount, formatLabel } from '../lib/status'
import { cn } from '../lib/utils'

const RAZORPAY_CHECKOUT_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance
  }
}

interface RazorpayCheckoutOptions {
  key: string
  amount: number
  currency: string
  order_id: string
  name?: string
  description?: string
  prefill?: { name?: string; email?: string; contact?: string }
  notes?: Record<string, string>
  theme?: { color?: string }
  modal?: { ondismiss?: () => void }
  handler?: (response: { razorpay_payment_id: string }) => void
}

interface RazorpayFailureResponse {
  error: {
    code?: string
    description?: string
    reason?: string
    metadata?: { order_id?: string; payment_id?: string }
  }
}

interface RazorpayInstance {
  open: () => void
  on: (event: 'payment.failed', handler: (response: RazorpayFailureResponse) => void) => void
}

type LiveStage =
  | 'idle'
  | 'creating_order'
  | 'awaiting_checkout'
  | 'payment_failed'
  | 'detecting'
  | 'detected'
  | 'timeout'

const LIVE_STAGE_LABEL: Record<LiveStage, string> = {
  idle: 'Not started',
  creating_order: 'Creating real Razorpay Test Mode order…',
  awaiting_checkout: 'Waiting on Razorpay Checkout…',
  payment_failed: 'Razorpay reported payment.failed',
  detecting: 'Waiting for Vidur backend to receive the webhook…',
  detected: 'Recovery case created from the real webhook',
  timeout: 'Webhook has not arrived yet — check backend logs / ngrok tunnel',
}

const POLL_INTERVAL_MS = 2500
const POLL_MAX_ATTEMPTS = 16

/**
 * Development/demo-only page for a live judged demonstration of Feature #1
 * ("detect revenue at risk"). This page does not compute or display any
 * revenue-at-risk number itself — it only calls the real backend demo
 * endpoints (POST /demo/payment-failure, POST /demo/reset), which run the
 * unmodified PaymentsService -> RiskService -> RiskEngineService pipeline.
 * The actual Dashboard and Recovery Cases pages remain the source of truth;
 * this page exists so a judge can trigger events without a terminal.
 */
export function DemoDetection() {
  const { token } = useAuth()

  const [amount, setAmount] = useState('25000')
  const [failureReason, setFailureReason] = useState('insufficient_funds')
  const [customerName, setCustomerName] = useState('Vidur Demo Customer')

  const [triggering, setTriggering] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [lastTrigger, setLastTrigger] =
    useState<TriggerDemoFailureResponse | null>(null)
  const [lastReset, setLastReset] = useState<DemoResetResponse | null>(null)

  async function handleTrigger() {
    if (!token) return

    setTriggering(true)
    setError(null)

    try {
      const parsedAmount = Number(amount)

      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Enter a valid positive amount.')
      }

      const result = await triggerDemoPaymentFailure(token, {
        amount: parsedAmount,
        failureReason: failureReason || undefined,
        customerName: customerName || undefined,
      })

      setLastTrigger(result)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to trigger demo payment.',
      )
    } finally {
      setTriggering(false)
    }
  }

  async function handleReset() {
    if (!token) return

    setResetting(true)
    setError(null)

    try {
      const result = await resetDemo(token)
      setLastReset(result)
      setLastTrigger(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset demo.')
    } finally {
      setResetting(false)
    }
  }

  // ── Live Razorpay Test Mode payment (real webhook-driven detection) ──
  // Entirely separate state/code path from the manual demo trigger above:
  // this never calls POST /demo/payment-failure. It creates a real
  // Razorpay Test Mode order, opens Checkout.js, and then polls the
  // backend for the Payment/RecoveryCase that the payment.failed webhook
  // creates asynchronously.
  const [liveAmount, setLiveAmount] = useState('25000')
  const [liveCustomerName, setLiveCustomerName] = useState('Vidur Live Customer')
  const [liveCustomerEmail, setLiveCustomerEmail] = useState('')
  const [liveCustomerPhone, setLiveCustomerPhone] = useState('')
  const [liveStage, setLiveStage] = useState<LiveStage>('idle')
  const [liveError, setLiveError] = useState<string | null>(null)
  const [detectedPayment, setDetectedPayment] = useState<PaymentWithCase | null>(null)

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  function loadRazorpayCheckoutScript(): Promise<void> {
    if (window.Razorpay) return Promise.resolve()

    const existing = document.querySelector(
      `script[src="${RAZORPAY_CHECKOUT_SCRIPT_SRC}"]`,
    )

    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () =>
          reject(new Error('Failed to load Razorpay Checkout script.')),
        )
      })
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = RAZORPAY_CHECKOUT_SCRIPT_SRC
      script.async = true
      script.onload = () => resolve()
      script.onerror = () =>
        reject(new Error('Failed to load Razorpay Checkout script.'))
      document.body.appendChild(script)
    })
  }

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
        const payment = await getPaymentByExternalId(token, razorpayPaymentId)

        if (payment && payment.recoveryCases.length > 0) {
          stopPolling()
          setDetectedPayment(payment)
          setLiveStage('detected')
          return
        }
      } catch (err) {
        stopPolling()
        setLiveError(
          err instanceof Error ? err.message : 'Failed to poll for the recovery case.',
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
        name: 'Vidur AI — Test Mode',
        description: 'Live Razorpay Test Mode payment attempt',
        prefill: {
          name: liveCustomerName || undefined,
          email: liveCustomerEmail || undefined,
          contact: liveCustomerPhone || undefined,
        },
        theme: { color: '#6366f1' },
        modal: {
          ondismiss: () => {
            setLiveStage((current) => (current === 'awaiting_checkout' ? 'idle' : current))
          },
        },
        handler: () => {
          // A successful test payment isn't this flow's focus (Phase 1 is
          // payment.failed detection only) — nothing to do here.
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
        err instanceof Error ? err.message : 'Failed to start Razorpay checkout.',
      )
    }
  }

  const liveBusy =
    liveStage === 'creating_order' ||
    liveStage === 'awaiting_checkout' ||
    liveStage === 'detecting'

  const liveEditable = liveStage === 'idle' || liveStage === 'timeout'

  const trackerSteps = [
    { key: 'order', label: 'Payment attempted', done: liveStage !== 'idle' },
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
      label: 'Recovery case created',
      done: liveStage === 'detected' && Boolean(detectedPayment),
    },
  ] as const

  return (
    <section className="pb-12">
      <header className="pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Live detection demo
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-foreground sm:text-[28px]">
          See Vidur detect revenue at risk
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-5 text-muted-foreground">
          Trigger a real failed payment below, then watch it land on the{' '}
          <a href="/dashboard" className="text-primary hover:underline">
            Dashboard
          </a>
          .
        </p>
      </header>

      {error && (
        <div className="mt-6 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex size-9 items-center justify-center rounded-lg bg-secondary/60 text-muted-foreground">
            <RotateCcw size={16} />
          </div>

          <h2 className="mt-4 text-base font-semibold text-foreground">
            Reset demo state
          </h2>
          <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
            Clears only records tagged for this demo. Real data is never
            touched.
          </p>

          <Button
            variant="outline"
            className="mt-5"
            onClick={handleReset}
            disabled={resetting || !token}
          >
            {resetting ? <Loader2 size={15} className="animate-spin" /> : null}
            {resetting ? 'Resetting…' : 'Reset demo'}
          </Button>

          {lastReset && (
            <p className="mt-3 text-xs text-muted-foreground">
              Cleared {lastReset.paymentsDeleted} payment
              {lastReset.paymentsDeleted === 1 ? '' : 's'} and{' '}
              {lastReset.recoveryCasesDeleted} recovery case
              {lastReset.recoveryCasesDeleted === 1 ? '' : 's'}.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex size-9 items-center justify-center rounded-lg bg-secondary/60 text-muted-foreground">
            <Zap size={16} />
          </div>

          <h2 className="mt-4 text-base font-semibold text-foreground">
            Trigger a failed payment
          </h2>
          <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
            Creates a real failed payment and runs it through Vidur's risk
            engine.
          </p>

          <div className="mt-5 flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="demo-amount">Amount (INR)</Label>
                <Input
                  id="demo-amount"
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="demo-reason">Failure reason</Label>
                <Input
                  id="demo-reason"
                  value={failureReason}
                  onChange={(event) => setFailureReason(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="demo-customer">Customer name</Label>
              <Input
                id="demo-customer"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </div>

            <Button
              className="mt-1"
              onClick={handleTrigger}
              disabled={triggering || !token}
            >
              {triggering ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Zap size={15} />
              )}
              {triggering ? 'Sending…' : 'Simulate failed payment'}
            </Button>

            {lastTrigger && (
              <p className="text-sm leading-5 text-foreground">
                <strong>
                  {formatAmount(lastTrigger.recoveryCase.revenueAtRisk)}
                </strong>{' '}
                at risk · risk level{' '}
                <strong>{formatLabel(lastTrigger.recoveryCase.riskLevel)}</strong>{' '}
                · recovery probability{' '}
                <strong>
                  {Math.round(
                    Number(lastTrigger.recoveryCase.recoveryProbability) * 100,
                  )}
                  %
                </strong>
              </p>
            )}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:col-span-2">
          <div className="h-1 bg-gradient-to-r from-primary/80 via-primary to-primary/40" />

          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <CreditCard size={18} />
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                  Real Razorpay webhook
                </p>
                <h2 className="mt-0.5 text-base font-semibold text-foreground">
                  Live Test Mode payment
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-5 text-muted-foreground">
                  Opens real Razorpay Checkout. A failed attempt is detected
                  entirely through Razorpay's{' '}
                  <code className="rounded bg-secondary/60 px-1 py-0.5 text-[13px]">
                    payment.failed
                  </code>{' '}
                  webhook. Use a{' '}
                  <a
                    href="https://razorpay.com/docs/payments/payments/test-card-upi-details/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    documented test failure card
                  </a>{' '}
                  to trigger it.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="live-amount">Amount (INR)</Label>
                <Input
                  id="live-amount"
                  type="number"
                  min="1"
                  value={liveAmount}
                  onChange={(event) => setLiveAmount(event.target.value)}
                  disabled={!liveEditable}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="live-customer">Customer name</Label>
                <Input
                  id="live-customer"
                  value={liveCustomerName}
                  onChange={(event) => setLiveCustomerName(event.target.value)}
                  disabled={!liveEditable}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="live-customer-email">Customer email</Label>
                <Input
                  id="live-customer-email"
                  type="email"
                  placeholder="you@example.com"
                  value={liveCustomerEmail}
                  onChange={(event) => setLiveCustomerEmail(event.target.value)}
                  disabled={!liveEditable}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="live-customer-phone">Customer phone</Label>
                <Input
                  id="live-customer-phone"
                  type="tel"
                  placeholder="+91XXXXXXXXXX"
                  value={liveCustomerPhone}
                  onChange={(event) => setLiveCustomerPhone(event.target.value)}
                  disabled={!liveEditable}
                />
              </div>
            </div>

            <Button
              className="mt-5"
              onClick={handleStartLivePayment}
              disabled={!token || liveBusy}
            >
              {liveBusy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CreditCard size={15} />
              )}
              {liveStage === 'creating_order'
                ? 'Creating order…'
                : liveStage === 'awaiting_checkout'
                  ? 'Waiting on Checkout…'
                  : 'Pay with Razorpay Test Mode'}
            </Button>

            {liveError && (
              <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {liveError}
              </div>
            )}

            <ol className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-4">
              {trackerSteps.map((step) => (
                <li
                  key={step.key}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
                    step.done
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-border bg-secondary/30 text-muted-foreground',
                  )}
                >
                  {step.done ? (
                    <CheckCircle2 size={13} className="shrink-0" />
                  ) : (
                    <Circle size={13} className="shrink-0" />
                  )}
                  {step.label}
                </li>
              ))}
            </ol>

            <p className="mt-3 text-xs text-muted-foreground">
              {LIVE_STAGE_LABEL[liveStage]}
            </p>

            {detectedPayment && (
              <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                <p className="text-sm leading-6 text-foreground">
                  Recovery case created —{' '}
                  <strong>
                    {formatAmount(
                      detectedPayment.recoveryCases[0]?.revenueAtRisk ?? '0',
                    )}
                  </strong>{' '}
                  at risk · risk level{' '}
                  <strong>
                    {formatLabel(detectedPayment.recoveryCases[0]?.riskLevel)}
                  </strong>{' '}
                  · root cause{' '}
                  <strong>{formatLabel(detectedPayment.failureReason)}</strong>
                </p>
                <a
                  href={`/recovery-cases/${detectedPayment.recoveryCases[0]?.id}`}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Open this recovery case
                  <ExternalLink size={13} />
                </a>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
