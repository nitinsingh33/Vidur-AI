import { useRef } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileWarning,
  Link2,
  Receipt,
  ShieldCheck,
  TrendingUp,
  UserRound,
  WalletCards,
} from 'lucide-react'
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { LandingNavbar } from '../components/landing/LandingNavbar'
import { LandingFooter } from '../components/landing/LandingFooter'

const solutions = [
  {
    id: 'failed-payments',
    number: '01',
    icon: CircleDollarSign,
    title: 'Failed payments',
    description:
      'Identify a failed payment as a recovery case, understand the failure context, estimate recovery probability, and select an appropriate next action.',
    signals: [
      'Failure reason',
      'Payment method',
      'Retry history',
      'Customer payment history',
    ],
    actions: [
      'Retry payment',
      'Update payment method',
      'Send payment link',
      'Escalate when recovery should stop',
    ],
  },
  {
    id: 'subscriptions',
    number: '02',
    icon: CalendarClock,
    title: 'Recurring payment failures',
    description:
      'Subscription state and failed-payment counts are part of Vidur’s recovery data model, allowing recurring payment problems to be understood in customer context.',
    signals: [
      'Subscription status',
      'Failed payment count',
      'Customer history',
      'Payment failure context',
    ],
    actions: [
      'Route failed payments into recovery',
      'Apply configured retry limits',
      'Request payment method update',
      'Escalate repeated failures',
    ],
  },
  {
    id: 'payment-operations',
    number: '03',
    icon: WalletCards,
    title: 'Payment operations',
    description:
      'Give operators a structured view of recovery cases, actions, policy decisions, and outcomes instead of forcing teams to reason from raw payment failures.',
    signals: [
      'Recovery case status',
      'Risk level',
      'Recovery probability',
      'Action history',
    ],
    actions: [
      'Review recovery cases',
      'Inspect agent activity',
      'Manage policies',
      'Track recovery outcomes',
    ],
  },
  {
    id: 'revenue-leakage',
    number: '04',
    icon: TrendingUp,
    title: 'Revenue leakage',
    description:
      'Prioritize the money most likely to be lost by combining amount, recovery probability, customer history, failure context, and expected loss.',
    signals: [
      'Revenue at risk',
      'Expected loss',
      'Recovery probability',
      'Risk level',
    ],
    actions: [
      'Prioritize eligible cases',
      'Run recovery batches',
      'Observe outcomes',
      'Escalate when appropriate',
    ],
  },
]

const failureMatrix = [
  {
    failure: 'Insufficient funds',
    signal: 'Temporary payment failure',
    response: 'Retry payment',
    icon: WalletCards,
  },
  {
    failure: 'Network error',
    signal: 'Transient infrastructure issue',
    response: 'Retry payment',
    icon: Clock3,
  },
  {
    failure: 'Card expired',
    signal: 'Payment method needs updating',
    response: 'Update payment method',
    icon: Receipt,
  },
  {
    failure: 'Bank declined',
    signal: 'Issuing bank declined payment',
    response: 'Update payment method',
    icon: ShieldCheck,
  },
  {
    failure: 'Limit exceeded',
    signal: 'Current method cannot complete payment',
    response: 'Send payment link',
    icon: Link2,
  },
  {
    failure: 'Checkout abandoned',
    signal: 'Order exists without a payment',
    response: 'Send payment link',
    icon: AlertTriangle,
  },
  {
    failure: 'Invoice overdue',
    signal: 'Outstanding receivable past due',
    response: 'Follow up receivable',
    icon: FileWarning,
  },
  {
    failure: 'Repeated failure',
    signal: 'Recovery path is no longer productive',
    response: 'Escalate to human',
    icon: UserRound,
  },
]

function SectionLabel({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
      <span className="size-1.5 rounded-full bg-primary" />
      {children}
    </span>
  )
}

function RevenueRiskVisual() {
  const ref = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const x = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    shouldReduceMotion ? [0, 0, 0] : [28, -10, 18],
  )

  const smoothX = useSpring(x, {
    stiffness: 75,
    damping: 20,
  })

  return (
    <motion.div
      ref={ref}
      style={{ x: smoothX }}
      className="relative"
    >
      <div className="absolute -inset-12 rounded-full bg-primary/[0.08] blur-[100px]" />

      <div className="relative overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_30px_90px_-45px_rgba(0,0,0,0.24)]">
        <div className="border-b border-border bg-secondary/25 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Revenue risk
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                Recovery opportunities
              </p>
            </div>

            <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground">
              Live view
            </span>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['At risk', '₹18.4L'],
              ['Cases', '32'],
              ['Probability', '68%'],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-border p-3"
              >
                <p className="text-[10px] text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                Case priority
              </span>
              <span className="text-[11px] text-muted-foreground">
                Expected loss
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {[
                ['₹42,800', 'HIGH', 84],
                ['₹18,500', 'MEDIUM', 62],
                ['₹9,400', 'MEDIUM', 47],
              ].map(([amount, risk, width]) => (
                <div key={amount}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {amount}
                    </span>
                    <span className="text-muted-foreground">
                      {risk}
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${width}%` }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.9,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CheckCircle2 size={17} />
            </div>

            <div>
              <p className="text-xs font-semibold text-foreground">
                Prioritize the recovery opportunity
              </p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                Amount and recovery probability inform the risk assessment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function Solutions() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <LandingNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-10%] top-[-180px] h-[520px] w-[520px] rounded-full bg-primary/[0.10] blur-[140px]" />

          <div
            className="absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                'radial-gradient(circle, hsl(var(--foreground) / 0.2) 1px, transparent 1px)',
              backgroundSize: '30px 30px',
              maskImage:
                'linear-gradient(to bottom, black, transparent 72%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, black, transparent 72%)',
            }}
          />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-20 lg:grid-cols-[1fr_0.9fr] lg:px-10 lg:pb-32 lg:pt-28">
          <div className="max-w-2xl">
            <motion.div
              initial={{
                opacity: 0,
                y: 12,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <SectionLabel>Solutions</SectionLabel>
            </motion.div>

            <h1 className="mt-6 text-[46px] font-semibold leading-[0.98] tracking-[-0.045em] text-foreground sm:text-[62px] lg:text-[70px]">
              Recover revenue where it starts to{' '}
              <span className="bg-gradient-to-r from-primary to-sky-500 bg-clip-text text-transparent">
                leak.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-[17px]">
              Vidur applies the same recovery loop to different revenue-risk
              situations — from failed payments to abandoned checkouts and
              overdue receivables.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="h-11 px-6"
                onClick={() => navigate('/signup')}
              >
                  Start recovering
                  <ArrowRight size={16} />
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="h-11 px-6"
                onClick={() => navigate('/how-it-works')}
              >
                  Explore the workflow
              </Button>
            </div>
          </div>

          <RevenueRiskVisual />
        </div>
      </section>

      {/* Solutions grid */}
      <section>
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
          <div className="max-w-2xl">
            <SectionLabel>Where Vidur fits</SectionLabel>

            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
              One recovery system. Multiple revenue-risk moments.
            </h2>

            <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
              The underlying recovery model is shared: create a case, assess
              the risk, choose an action, enforce policy, execute, and observe
              the result.
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            {solutions.map((solution, index) => {
              const Icon = solution.icon

              return (
                <motion.article
                  key={solution.id}
                  id={solution.id}
                  className="scroll-mt-28 rounded-[26px] border border-border bg-card p-6 sm:p-8"
                  initial={{
                    opacity: 0,
                    scale: 0.97,
                  }}
                  whileInView={{
                    opacity: 1,
                    scale: 1,
                  }}
                  viewport={{
                    once: true,
                    amount: 0.2,
                  }}
                  transition={{
                    duration: 0.65,
                    delay: index * 0.06,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                      <Icon size={18} />
                    </div>

                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                      {solution.number}
                    </span>
                  </div>

                  <h3 className="mt-6 text-xl font-semibold tracking-tight text-foreground">
                    {solution.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {solution.description}
                  </p>

                  <div className="mt-7 grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Signals
                      </p>

                      <div className="mt-3 space-y-2.5">
                        {solution.signals.map((signal) => (
                          <div
                            key={signal}
                            className="flex items-center gap-2 text-xs text-foreground"
                          >
                            <span className="size-1.5 rounded-full bg-primary/60" />
                            {signal}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Recovery operations
                      </p>

                      <div className="mt-3 space-y-2.5">
                        {solution.actions.map((action) => (
                          <div
                            key={action}
                            className="flex items-start gap-2 text-xs text-muted-foreground"
                          >
                            <ArrowRight
                              size={13}
                              className="mt-0.5 shrink-0 text-primary"
                            />
                            {action}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </div>
        </div>
      </section>

      {/* Matrix */}
      <section className="border-y border-border bg-secondary/20">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
          <div className="grid gap-14 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <SectionLabel>Recovery matrix</SectionLabel>

              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
                The failure determines the recovery path.
              </h2>

              <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
                These mappings are part of the current deterministic recovery
                strategy service. They are deliberately explicit so recovery
                behavior can be tested and audited.
              </p>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-border bg-card">
              <div className="grid grid-cols-[1fr_0.9fr] border-b border-border bg-secondary/30 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:px-6">
                <span>Revenue-risk signal</span>
                <span>Current strategy</span>
              </div>

              <div className="divide-y divide-border">
                {failureMatrix.map((row, index) => {
                  const Icon = row.icon

                  return (
                    <motion.div
                      key={row.failure}
                      className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_0.9fr] sm:items-center sm:px-6"
                      initial={{
                        opacity: 0,
                        x: 18,
                      }}
                      whileInView={{
                        opacity: 1,
                        x: 0,
                      }}
                      viewport={{
                        once: true,
                        amount: 0.55,
                      }}
                      transition={{
                        duration: 0.4,
                        delay: index * 0.035,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                          <Icon size={15} />
                        </div>

                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {row.failure}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {row.signal}
                          </p>
                        </div>
                      </div>

                      <span className="ml-11 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground sm:ml-0">
                        {row.response}
                      </span>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Control section */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute right-[-180px] top-[-160px] size-[500px] rounded-full bg-primary/[0.07] blur-[130px]" />

        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <SectionLabel>Recovery without runaway automation</SectionLabel>

            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
              Every action has a boundary.
            </h2>

            <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
              Policies can constrain recovery by action type, retry count,
              contact limits, and amount. If the policy does not permit the
              action, the recovery workflow does not blindly execute it.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: 'Policy check',
                text: 'Validate the selected recovery action against merchant policy.',
              },
              {
                icon: Clock3,
                title: 'Attempt limits',
                text: 'Bound repeated attempts so a failing action eventually converges.',
              },
              {
                icon: UserRound,
                title: 'Escalation',
                text: 'Move cases toward human review when automated recovery is no longer appropriate.',
              },
            ].map((item, index) => {
              const Icon = item.icon

              return (
                <motion.div
                  key={item.title}
                  className="rounded-2xl border border-border bg-card p-6"
                  initial={{
                    opacity: 0,
                    y: 20,
                  }}
                  whileInView={{
                    opacity: 1,
                    y: 0,
                  }}
                  viewport={{
                    once: true,
                    amount: 0.3,
                  }}
                  transition={{
                    duration: 0.55,
                    delay: index * 0.08,
                  }}
                >
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon size={17} />
                  </div>

                  <h3 className="mt-5 text-sm font-semibold text-foreground">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {item.text}
                  </p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-24 lg:px-10 lg:pb-32">
        <div className="overflow-hidden rounded-[30px] border border-primary/15 bg-primary/[0.045] px-7 py-14 text-center sm:px-12">
          <SectionLabel>Explore Vidur</SectionLabel>

          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
            Revenue recovery starts with knowing what to do next.
          </h2>

          <Button
            size="lg"
            className="mt-8 h-11 px-6"
            onClick={() => navigate('/signup')}
          >
              Get started
              <ArrowRight size={16} />
          </Button>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}