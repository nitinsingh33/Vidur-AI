import { useEffect, useRef, useState } from 'react'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { formatAmount, formatLabel } from '../lib/status'

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
  const [clientFailure, setClientFailure] = useState<{
    paymentId: string
    orderId: string | null
    reason?: string
    description?: string
  } | null>(null)
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
    setClientFailure(null)
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

        setClientFailure({
          paymentId: rzpError.metadata?.payment_id ?? '',
          orderId: rzpError.metadata?.order_id ?? null,
          reason: rzpError.reason,
          description: rzpError.description,
        })
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

  return (
    <section className="pb-12">
      <header className="pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Development / demo only
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-foreground sm:text-[28px]">
          Vidur AI — Live Detection Demo
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-5 text-muted-foreground">
          This page only calls the real backend demo endpoints. It does not
          calculate or display revenue-at-risk itself — open the{' '}
          <a href="/dashboard" className="text-primary hover:underline">
            Dashboard
          </a>{' '}
          or{' '}
          <a href="/recovery-cases" className="text-primary hover:underline">
            Recovery Cases
          </a>{' '}
          after each action to see the real numbers change.
        </p>
      </header>

      {error && (
        <div className="mt-6 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>1. Reset demo state</CardTitle>
            <CardDescription>
              Deletes only records tagged VIDUR-DEMO- for your merchant. Real
              payments, customers, and other merchants are never touched.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetting || !token}
            >
              {resetting ? 'Resetting…' : 'Reset Demo'}
            </Button>

            {lastReset && (
              <pre className="overflow-x-auto rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                {JSON.stringify(lastReset, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Trigger a failed payment</CardTitle>
            <CardDescription>
              Creates a real FAILED Payment, then calls the unmodified
              RiskService.assessPayment() pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="demo-customer">Customer name</Label>
              <Input
                id="demo-customer"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </div>

            <Button onClick={handleTrigger} disabled={triggering || !token}>
              {triggering ? 'Sending…' : 'Simulate Failed Payment'}
            </Button>

            {lastTrigger && (
              <div className="space-y-2">
                <p className="text-sm text-foreground">
                  Real result from RiskEngineService:{' '}
                  <strong>
                    {formatAmount(lastTrigger.recoveryCase.revenueAtRisk)}
                  </strong>{' '}
                  at risk, risk level{' '}
                  <strong>{lastTrigger.recoveryCase.riskLevel}</strong>,
                  recovery probability{' '}
                  <strong>
                    {Number(lastTrigger.recoveryCase.recoveryProbability) *
                      100}
                    %
                  </strong>
                  .
                </p>
                <pre className="overflow-x-auto rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                  {JSON.stringify(lastTrigger, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>3. Live Razorpay Test Mode payment (real webhook)</CardTitle>
            <CardDescription>
              Opens real Razorpay Checkout.js against a real Test Mode order.
              A failed test payment here is detected entirely through
              Razorpay's <code>payment.failed</code> webhook — this never
              calls <code>/demo/payment-failure</code>. Use one of{' '}
              <a
                href="https://razorpay.com/docs/payments/payments/test-card-upi-details/"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Razorpay's documented Test Mode failure cards
              </a>{' '}
              (e.g. insufficient funds, expired card) to trigger a real
              failure.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="live-amount">Amount (INR)</Label>
                <Input
                  id="live-amount"
                  type="number"
                  min="1"
                  value={liveAmount}
                  onChange={(event) => setLiveAmount(event.target.value)}
                  disabled={liveStage !== 'idle' && liveStage !== 'timeout'}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="live-customer">Customer name</Label>
                <Input
                  id="live-customer"
                  value={liveCustomerName}
                  onChange={(event) => setLiveCustomerName(event.target.value)}
                  disabled={liveStage !== 'idle' && liveStage !== 'timeout'}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="live-customer-email">
                  Customer email (for real recovery — payment link, notifications)
                </Label>
                <Input
                  id="live-customer-email"
                  type="email"
                  placeholder="you@example.com"
                  value={liveCustomerEmail}
                  onChange={(event) => setLiveCustomerEmail(event.target.value)}
                  disabled={liveStage !== 'idle' && liveStage !== 'timeout'}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="live-customer-phone">Customer phone (for SMS delivery)</Label>
                <Input
                  id="live-customer-phone"
                  type="tel"
                  placeholder="+91XXXXXXXXXX"
                  value={liveCustomerPhone}
                  onChange={(event) => setLiveCustomerPhone(event.target.value)}
                  disabled={liveStage !== 'idle' && liveStage !== 'timeout'}
                />
              </div>
            </div>

            <Button
              onClick={handleStartLivePayment}
              disabled={
                !token ||
                liveStage === 'creating_order' ||
                liveStage === 'awaiting_checkout' ||
                liveStage === 'detecting'
              }
            >
              {liveStage === 'creating_order'
                ? 'Creating order…'
                : liveStage === 'awaiting_checkout'
                  ? 'Waiting on Razorpay Checkout…'
                  : 'Pay with Razorpay Test Mode'}
            </Button>

            {liveError && (
              <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {liveError}
              </div>
            )}

            {/* RAZORPAY PAYMENT → PAYMENT FAILED → VIDUR DETECTED → RECOVERY CASE CREATED */}
            <ol className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              {(
                [
                  { key: 'order', label: 'Razorpay payment', done: liveStage !== 'idle' },
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
              ).map((step) => (
                <li
                  key={step.key}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                    step.done
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                      : 'border-border bg-secondary/40 text-muted-foreground'
                  }`}
                >
                  {step.label}
                </li>
              ))}
            </ol>

            <p className="text-xs text-muted-foreground">
              Status: {LIVE_STAGE_LABEL[liveStage]}
            </p>

            {clientFailure && (
              <div className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                <p>
                  Razorpay payment id:{' '}
                  <strong className="text-foreground">{clientFailure.paymentId}</strong>
                </p>
                <p>
                  Razorpay order id:{' '}
                  <strong className="text-foreground">{clientFailure.orderId}</strong>
                </p>
                {clientFailure.reason && (
                  <p>
                    Reason:{' '}
                    <strong className="text-foreground">{clientFailure.reason}</strong>
                  </p>
                )}
              </div>
            )}

            {detectedPayment && (
              <div className="space-y-2">
                <p className="text-sm text-foreground">
                  Real webhook result — Recovery Case{' '}
                  <strong>{detectedPayment.recoveryCases[0]?.id}</strong>:{' '}
                  <strong>
                    {formatAmount(detectedPayment.recoveryCases[0]?.revenueAtRisk ?? '0')}
                  </strong>{' '}
                  at risk, risk level{' '}
                  <strong>{formatLabel(detectedPayment.recoveryCases[0]?.riskLevel)}</strong>,
                  root cause{' '}
                  <strong>{formatLabel(detectedPayment.failureReason)}</strong>.
                </p>
                <pre className="overflow-x-auto rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                  {JSON.stringify(detectedPayment, null, 2)}
                </pre>
                <a
                  href={`/recovery-cases/${detectedPayment.recoveryCases[0]?.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  Open this Recovery Case →
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
