import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ExternalLink, Loader2, Sparkles } from 'lucide-react'
import { createStorefrontSubscription } from '../../api/storefront'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'

const PLUS_PRICE_LABEL = '₹499'

const BENEFITS = [
  'Free shipping on every order',
  'Early access to new arrivals',
  'Exclusive member discounts',
  'Member-only offers',
]

type Stage = 'form' | 'creating' | 'redirecting'

export function FashionKartPlus() {
  const { slug } = useParams<{ slug: string }>()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [stage, setStage] = useState<Stage>('form')
  const [error, setError] = useState<string | null>(null)
  const [authUrl, setAuthUrl] = useState<string | null>(null)

  async function handleSubscribe(event: FormEvent) {
    event.preventDefault()
    if (!slug) return

    try {
      setError(null)
      setStage('creating')

      const result = await createStorefrontSubscription(slug, {
        customer: { name, email, phone: phone || undefined },
      })

      setAuthUrl(result.shortUrl)
      setStage('redirecting')

      // A real Razorpay-hosted page — the customer completes the actual
      // mandate authorization there, not inside this app.
      window.location.href = result.shortUrl
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to start your subscription.',
      )
      setStage('form')
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <Link
        to={`/store/${slug}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Back to store
      </Link>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles size={17} />
          </span>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
            FashionKart Plus
          </h1>
        </div>

        <p className="mt-4 text-2xl font-semibold text-foreground">
          {PLUS_PRICE_LABEL}
          <span className="text-sm font-normal text-muted-foreground"> / month</span>
        </p>

        <div className="mt-5 flex flex-col gap-3">
          {BENEFITS.map((benefit) => (
            <div key={benefit} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check size={12} strokeWidth={2.5} />
              </span>
              <span className="text-sm leading-5 text-muted-foreground">
                {benefit}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          FashionKart Plus is a recurring membership — {PLUS_PRICE_LABEL} is
          charged automatically every month via Razorpay until you cancel.
        </p>

        {stage === 'redirecting' && authUrl ? (
          <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
            <p className="font-medium">Redirecting you to Razorpay…</p>
            <p className="mt-1 text-muted-foreground">
              Complete your one-time membership authorization there.
            </p>
            <a
              href={authUrl}
              className="mt-2 inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              Open authorization page
              <ExternalLink size={13} />
            </a>
          </div>
        ) : (
          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubscribe}>
            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plus-name">Full name</Label>
              <Input
                id="plus-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={stage === 'creating'}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plus-email">Email</Label>
              <Input
                id="plus-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={stage === 'creating'}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plus-phone">Phone (optional)</Label>
              <Input
                id="plus-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={stage === 'creating'}
              />
            </div>

            <Button type="submit" className="mt-2 h-11 w-full gap-2" disabled={stage === 'creating'}>
              {stage === 'creating' && <Loader2 size={15} className="animate-spin" />}
              Subscribe with Razorpay
            </Button>
          </form>
        )}
      </div>
    </section>
  )
}
