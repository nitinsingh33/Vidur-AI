import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'
import { useCart } from '../../context/useCart'
import {
  createStorefrontOrder,
  getStorefrontOrderStatus,
  sendAbandonSignal,
} from '../../api/storefront'
import { loadRazorpayCheckoutScript } from '../../lib/razorpayCheckout'
import { formatAmount } from '../../lib/status'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'

type Stage =
  | 'form'
  | 'creating_order'
  | 'awaiting_checkout'
  | 'payment_failed'
  | 'paid'

const POLL_INTERVAL_MS = 2500
const POLL_MAX_ATTEMPTS = 24

export function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { lines, totalAmount, clear } = useCart()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [stage, setStage] = useState<Stage>('form')
  const [error, setError] = useState<string | null>(null)
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null)

  const internalOrderIdRef = useRef<string | null>(null)
  const completedRef = useRef(false)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    function handleHide() {
      if (internalOrderIdRef.current && !completedRef.current) {
        sendAbandonSignal(internalOrderIdRef.current)
      }
    }

    // Covers both an outright tab close (pagehide) and a switch away from
    // the tab (visibilitychange -> hidden) — a real signal either way, not
    // a guess based on elapsed time.
    window.addEventListener('pagehide', handleHide)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handleHide()
    })

    return () => {
      window.removeEventListener('pagehide', handleHide)
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  function pollOrderStatus() {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)

    let attempts = 0
    pollTimerRef.current = setInterval(async () => {
      attempts += 1
      if (!internalOrderIdRef.current) return

      try {
        const status = await getStorefrontOrderStatus(internalOrderIdRef.current)

        if (status.status === 'PAID') {
          completedRef.current = true
          if (pollTimerRef.current) clearInterval(pollTimerRef.current)
          setStage('paid')
          clear()
          return
        }

        if (status.recovery?.paymentLinkUrl) {
          setRecoveryLink(status.recovery.paymentLinkUrl)
        }
      } catch {
        // Transient — keep polling until the attempt ceiling.
      }

      if (attempts >= POLL_MAX_ATTEMPTS && pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
      }
    }, POLL_INTERVAL_MS)
  }

  async function handlePay() {
    if (!slug || lines.length === 0) return

    setError(null)

    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.')
      return
    }

    setStage('creating_order')

    try {
      const order = await createStorefrontOrder(slug, {
        items: lines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
        })),
        customer: { name, email, phone: phone || undefined },
      })

      internalOrderIdRef.current = order.internalOrderId

      await loadRazorpayCheckoutScript()

      if (!window.Razorpay) {
        throw new Error('Razorpay Checkout script did not load.')
      }

      setStage('awaiting_checkout')

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'FashionKart',
        description: `${lines.length} item(s)`,
        prefill: { name, email, contact: phone || undefined },
        theme: { color: '#2563eb' },
        modal: {
          ondismiss: () => {
            setStage((current) =>
              current === 'awaiting_checkout' ? 'form' : current,
            )
          },
        },
        handler: () => {
          setStage('paid')
          completedRef.current = true
          clear()
        },
      })

      rzp.on('payment.failed', () => {
        setStage('payment_failed')
        pollOrderStatus()
      })

      rzp.open()
    } catch (err) {
      setStage('form')
      setError(err instanceof Error ? err.message : 'Failed to start checkout.')
    }
  }

  if (lines.length === 0 && stage !== 'paid') {
    return (
      <section className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Button onClick={() => navigate(`/store/${slug}`)}>Continue shopping</Button>
      </section>
    )
  }

  if (stage === 'paid') {
    return (
      <section className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <CheckCircle2 size={40} className="text-emerald-500" />
        <h1 className="text-xl font-semibold text-foreground">Payment successful</h1>
        <p className="text-sm text-muted-foreground">Thank you for your order.</p>
        <Button variant="outline" onClick={() => navigate(`/store/${slug}`)}>
          Continue shopping
        </Button>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.02em] text-foreground">
        Checkout
      </h1>

      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{lines.length} item(s)</span>
          <span className="font-semibold text-foreground">{formatAmount(totalAmount)}</span>
        </div>
      </div>

      {stage === 'payment_failed' && (
        <div className="mb-5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          {recoveryLink ? (
            <div className="flex flex-col gap-2">
              <span>
                Your payment didn't go through — but Vidur AI already generated a
                new secure payment link for you automatically.
              </span>
              <a
                href={recoveryLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
              >
                Complete payment via new link
                <ExternalLink size={13} />
              </a>
            </div>
          ) : (
            'Your payment didn\'t go through. Checking whether Vidur AI has an automatic recovery option for you…'
          )}
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="checkout-name">Full name</Label>
          <Input
            id="checkout-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={stage !== 'form' && stage !== 'payment_failed'}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="checkout-email">Email</Label>
          <Input
            id="checkout-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={stage !== 'form' && stage !== 'payment_failed'}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="checkout-phone">Phone (optional)</Label>
          <Input
            id="checkout-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={stage !== 'form' && stage !== 'payment_failed'}
          />
        </div>
      </div>

      <Button
        className="mt-6 h-11 w-full gap-2"
        onClick={handlePay}
        disabled={stage === 'creating_order' || stage === 'awaiting_checkout'}
      >
        {(stage === 'creating_order' || stage === 'awaiting_checkout') && (
          <Loader2 size={16} className="animate-spin" />
        )}
        {stage === 'payment_failed' ? 'Try payment again' : `Pay ${formatAmount(totalAmount)}`}
      </Button>
    </section>
  )
}
