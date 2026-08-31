import { useState } from 'react'
import {
  CreditCard,
  ExternalLink,
  FileText,
  Landmark,
  Loader2,
  Repeat,
  ShoppingCart,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  launchCheckoutAbandonment,
  launchInvoiceOverdue,
  launchMandateFailure,
  launchPaymentFailure,
  launchSubscriptionFailure,
  type LaunchScenarioResult,
} from '../api/recoveryLab'
import { Button } from '../components/ui/button'

interface Scenario {
  key: string
  title: string
  icon: LucideIcon
  description: string
  launch: (token: string) => Promise<LaunchScenarioResult>
}

const SCENARIOS: Scenario[] = [
  {
    key: 'payment-degradation',
    title: 'Payment degradation',
    icon: CreditCard,
    description:
      'Creates a real failed payment and hands it straight to Vidur\'s automatic pipeline — the same path a real Razorpay payment.failed webhook takes.',
    launch: launchPaymentFailure,
  },
  {
    key: 'checkout-dropoff',
    title: 'Checkout drop-off',
    icon: ShoppingCart,
    description:
      'Creates a real unpaid Order with a genuine abandon-signal timestamp, then runs the real checkout-abandonment sweep immediately.',
    launch: launchCheckoutAbandonment,
  },
  {
    key: 'failed-subscription',
    title: 'Failed subscription',
    icon: Repeat,
    description:
      'Creates a real subscription and marks its billing cycle failed — the same state a genuine subscription.pending webhook produces.',
    launch: launchSubscriptionFailure,
  },
  {
    key: 'b2b-receivables',
    title: 'B2B receivables chaser',
    icon: FileText,
    description:
      'Creates a real overdue invoice, then runs the real invoice-overdue sweep immediately instead of waiting out its schedule.',
    launch: launchInvoiceOverdue,
  },
  {
    key: 'mandate-retry',
    title: 'Mandate retry sequencer',
    icon: Landmark,
    description:
      'Creates a real paused mandate. Since there\'s no valid token to charge, Vidur correctly escalates it rather than fabricating a retry.',
    launch: launchMandateFailure,
  },
]

export function RecoveryLab() {
  const { token } = useAuth()
  const [launching, setLaunching] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, LaunchScenarioResult>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleLaunch(scenario: Scenario) {
    if (!token) return

    setLaunching(scenario.key)
    setErrors((current) => ({ ...current, [scenario.key]: '' }))

    try {
      const result = await scenario.launch(token)
      setResults((current) => ({ ...current, [scenario.key]: result }))
    } catch (err) {
      setErrors((current) => ({
        ...current,
        [scenario.key]: err instanceof Error ? err.message : 'Failed to launch scenario.',
      }))
    } finally {
      setLaunching(null)
    }
  }

  return (
    <section className="pb-10">
      <header className="border-b border-border pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Recovery Lab
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-[28px]">
          Scenario launcher
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Each scenario creates a real record in your database (a real payment,
          order, subscription, invoice, or mandate) and hands it to Vidur's
          real, unmodified automatic pipeline. Nothing here is fabricated —
          recovered revenue still only ever comes from a real provider
          confirmation.
        </p>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SCENARIOS.map((scenario) => {
          const Icon = scenario.icon
          const result = results[scenario.key]
          const scenarioError = errors[scenario.key]
          const busy = launching === scenario.key

          return (
            <article
              key={scenario.key}
              className="flex flex-col rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon size={17} />
                </div>
                <h2 className="text-base font-semibold text-foreground">
                  {scenario.title}
                </h2>
              </div>

              <p className="mt-3 text-sm leading-5 text-muted-foreground">
                {scenario.description}
              </p>

              <Button
                className="mt-5 h-10 gap-2"
                onClick={() => handleLaunch(scenario)}
                disabled={busy}
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                Launch scenario
              </Button>

              {scenarioError && (
                <p className="mt-3 text-xs text-destructive">{scenarioError}</p>
              )}

              {result && (
                <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-400">
                  <p>{result.instructions}</p>
                  {result.recoveryCaseId && (
                    <a
                      href={`/recovery-cases/${result.recoveryCaseId}`}
                      className="mt-2 inline-flex items-center gap-1.5 font-medium hover:underline"
                    >
                      View case
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
