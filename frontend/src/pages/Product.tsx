import { useRef } from 'react'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Database,
  Eye,
  GitBranch,
  Network,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
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

const capabilities = [
  {
    id: 'recovery-engine',
    icon: CircleDollarSign,
    eyebrow: '01',
    title: 'Recovery case detection',
    description:
      'Turn failed payments, abandoned checkouts, and overdue invoices into structured recovery cases with revenue-at-risk and recovery probability.',
    items: [
      'Failed payment detection',
      'Checkout abandonment detection',
      'Overdue invoice detection',
      'Risk level assessment',
    ],
  },
  {
    id: 'ai-decisioning',
    icon: Target,
    eyebrow: '02',
    title: 'Context-aware decisioning',
    description:
      'Vidur evaluates payment amount, failure reason, payment method, customer history, retry history, and recovery probability before selecting a recovery strategy.',
    items: [
      'Customer payment history',
      'Failure reason',
      'Retry context',
      'Recovery probability',
    ],
  },
  {
    id: 'orchestration',
    icon: Network,
    eyebrow: '03',
    title: 'Bounded recovery orchestration',
    description:
      'Selected actions pass through policy checks before execution. Recovery attempts are bounded so a failing workflow cannot continue indefinitely.',
    items: [
      'Policy validation',
      'Retry limits',
      'Amount limits',
      'Human escalation',
    ],
  },
  {
    id: 'analytics',
    icon: BarChart3,
    eyebrow: '04',
    title: 'Outcome & observability',
    description:
      'Every recovery case carries its decision, policy result, execution state, outcome, and audit history so teams can understand what happened.',
    items: [
      'Recovery outcomes',
      'Action history',
      'Policy decisions',
      'Audit trail',
    ],
  },
]

const actionRows = [
  {
    cause: 'Insufficient funds',
    action: 'Retry payment',
    tone: 'primary',
  },
  {
    cause: 'Network error',
    action: 'Retry payment',
    tone: 'primary',
  },
  {
    cause: 'Card expired',
    action: 'Update payment method',
    tone: 'blue',
  },
  {
    cause: 'Bank declined',
    action: 'Update payment method',
    tone: 'blue',
  },
  {
    cause: 'Checkout abandoned',
    action: 'Send payment link',
    tone: 'violet',
  },
  {
    cause: 'Invoice overdue',
    action: 'Follow up receivable',
    tone: 'amber',
  },
  {
    cause: 'Repeated failure',
    action: 'Escalate to human',
    tone: 'slate',
  },
]

const infrastructure = [
  {
    icon: Zap,
    title: 'NestJS',
    text: 'Business and recovery orchestration layer.',
  },
  {
    icon: Sparkles,
    title: 'LangGraph',
    text: 'Stateful recovery workflow.',
  },
  {
    icon: Activity,
    title: 'FastAPI + ML',
    text: 'Recovery probability service.',
  },
  {
    icon: Database,
    title: 'PostgreSQL',
    text: 'Recovery and audit data layer.',
  },
  {
    icon: GitBranch,
    title: 'BullMQ + Redis',
    text: 'Asynchronous recovery processing.',
  },
  {
    icon: ShieldCheck,
    title: 'Policy engine',
    text: 'Bounded action execution.',
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

function ProductVisual() {
  const ref = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const rotate = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    shouldReduceMotion ? [0, 0, 0] : [-2, 1.5, -2],
  )

  const y = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    shouldReduceMotion ? [0, 0, 0] : [24, -8, 18],
  )

  const smoothY = useSpring(y, {
    stiffness: 90,
    damping: 22,
    mass: 0.7,
  })

  return (
    <motion.div
      ref={ref}
      style={{ rotate, y: smoothY }}
      className="relative mx-auto w-full max-w-[570px]"
    >
      <div className="absolute -inset-10 rounded-[40px] bg-primary/[0.08] blur-3xl" />

      <div className="relative overflow-hidden rounded-[26px] border border-border/80 bg-card shadow-[0_30px_90px_-35px_rgba(0,0,0,0.22)]">
        <div className="relative overflow-hidden border-b border-border bg-secondary/25 px-5 py-4">
          <motion.div
            className="absolute -left-20 top-0 h-full w-40 bg-primary/10 blur-2xl"
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    x: [0, 420, 0],
                  }
            }
            transition={{
              duration: 9,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Recovery case
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                RC-2298
              </p>
            </div>

            <span className="flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <span className="relative flex size-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
                <span className="relative size-1.5 rounded-full bg-primary" />
              </span>
              Processing
            </span>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground">
                Revenue at risk
              </p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                ₹12,499
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Payment amount
              </p>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground">
                Recovery probability
              </p>

              <div className="mt-2 flex items-end gap-2">
                <p className="text-xl font-semibold tracking-tight text-foreground">
                  68%
                </p>
                <TrendingUp
                  size={15}
                  className="mb-1 text-primary"
                />
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  whileInView={{ width: '68%' }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 1.1,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </div>
            </div>
          </div>

          <div className="relative mt-4 rounded-2xl border border-border p-4">
            <div className="absolute left-6 top-12 bottom-5 w-px bg-border" />

            {[
              {
                icon: Activity,
                label: 'Context loaded',
                value: 'Payment + customer history',
              },
              {
                icon: Bot,
                label: 'Recovery strategy',
                value: 'Retry payment',
              },
              {
                icon: ShieldCheck,
                label: 'Policy check',
                value: 'ALLOW',
              },
              {
                icon: Zap,
                label: 'Next action',
                value: 'Scheduled recovery',
              },
            ].map((item, index) => {
              const Icon = item.icon

              return (
                <motion.div
                  key={item.label}
                  className="relative flex gap-3 py-2.5 first:pt-0 last:pb-0"
                  initial={{
                    opacity: 0,
                    x: -8,
                  }}
                  whileInView={{
                    opacity: 1,
                    x: 0,
                  }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.45,
                    delay: index * 0.08,
                  }}
                >
                  <div className="z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
                    <Icon size={14} />
                  </div>

                  <div className="min-w-0 pt-0.5">
                    <p className="text-xs text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                      {item.value}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <Eye size={15} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Outcome tracking enabled
              </span>
            </div>

            <span className="text-xs font-medium text-primary">
              Audit trail
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function Product() {
  const navigate = useNavigate()
  const heroRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })

  const heroY = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? [0, 0] : [0, -70],
  )

  const heroOpacity = useTransform(
    scrollYProgress,
    [0, 0.75, 1],
    shouldReduceMotion ? [1, 1, 1] : [1, 0.9, 0],
  )

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <LandingNavbar />

      {/* Hero */}
      <section
        ref={heroRef}
        className="relative overflow-hidden border-b border-border"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[10%] top-[-180px] h-[520px] w-[520px] rounded-full bg-primary/[0.09] blur-[130px]" />
          <div className="absolute right-[-10%] top-[10%] h-[500px] w-[500px] rounded-full bg-sky-400/[0.07] blur-[140px]" />

          <div
            className="absolute inset-0 opacity-[0.22]"
            style={{
              backgroundImage:
                'radial-gradient(circle, hsl(var(--foreground) / 0.22) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
              maskImage:
                'linear-gradient(to bottom, black, transparent 72%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, black, transparent 72%)',
            }}
          />
        </div>

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-20 lg:grid-cols-[1fr_0.9fr] lg:px-10 lg:pb-32 lg:pt-28"
        >
          <div className="max-w-2xl">
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.96,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              transition={{
                duration: 0.65,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <SectionLabel>Recovery platform</SectionLabel>
            </motion.div>

            <h1 className="mt-6 max-w-3xl text-[46px] font-semibold leading-[0.98] tracking-[-0.045em] text-foreground sm:text-[62px] lg:text-[72px]">
              The decision layer between{' '}
              <span className="bg-gradient-to-r from-primary via-primary to-sky-500 bg-clip-text text-transparent">
                payment failure
              </span>{' '}
              and recovery.
            </h1>

            <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-[17px]">
              Vidur turns revenue-risk signals into bounded recovery
              workflows — combining customer context, recovery probability,
              strategy selection, policy checks, execution, and outcome
              tracking.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="h-11 px-6"
                onClick={() => navigate('/signup')}
              >
                  Get started
                  <ArrowRight size={16} />
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="h-11 px-6"
                onClick={() => navigate('/how-it-works')}
              >
                  See how it works
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground">
              {[
                'Context-aware',
                'Policy-controlled',
                'Fully observable',
              ].map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-2"
                >
                  <CheckCircle2
                    size={14}
                    className="text-primary"
                  />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <ProductVisual />
        </motion.div>
      </section>

      {/* Product overview */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
          <div className="max-w-2xl">
            <SectionLabel>What Vidur actually does</SectionLabel>

            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
              A recovery workflow built around decisions, not blind retries.
            </h2>

            <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
              A recovery case carries the information needed to decide what
              should happen next. Vidur evaluates the case, selects a
              strategy, checks whether that action is permitted, executes it,
              and records the result.
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            {capabilities.map((item, index) => {
              const Icon = item.icon

              return (
                <motion.article
                  key={item.id}
                  id={item.id}
                  className="group relative scroll-mt-28 overflow-hidden rounded-[24px] border border-border bg-card p-6 sm:p-8"
                  initial={{
                    opacity: 0,
                    clipPath: 'inset(10% 0% 0% 0% round 24px)',
                  }}
                  whileInView={{
                    opacity: 1,
                    clipPath: 'inset(0% 0% 0% 0% round 24px)',
                  }}
                  viewport={{
                    once: true,
                    amount: 0.18,
                  }}
                  transition={{
                    duration: 0.75,
                    delay: index * 0.07,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  whileHover={{
                    y: -4,
                  }}
                >
                  <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/[0.045] blur-3xl transition-opacity duration-300 group-hover:opacity-100" />

                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <div className="flex size-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                        <Icon size={18} />
                      </div>

                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        {item.eyebrow}
                      </span>
                    </div>

                    <h3 className="mt-6 text-xl font-semibold tracking-tight text-foreground">
                      {item.title}
                    </h3>

                    <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </p>

                    <div className="mt-6 grid gap-2 sm:grid-cols-2">
                      {item.items.map((entry) => (
                        <div
                          key={entry}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <span className="size-1.5 rounded-full bg-primary/60" />
                          {entry}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </div>
        </div>
      </section>

      {/* Decision map */}
      <section className="border-y border-border bg-secondary/20">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
          <div className="grid gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <SectionLabel>Decision engine</SectionLabel>

              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
                Different failures can lead to different actions.
              </h2>

              <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
                Vidur's current recovery strategy service maps the diagnosed
                root cause to an appropriate recovery action instead of
                applying one retry rule to every case.
              </p>

              <div className="mt-8 rounded-2xl border border-primary/15 bg-primary/[0.045] p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    size={18}
                    className="mt-0.5 shrink-0 text-primary"
                  />

                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      The action still needs policy approval.
                    </p>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                      If the configured policy blocks the action, Vidur
                      routes the case toward escalation instead of executing
                      it.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-border bg-card">
              <div className="grid grid-cols-[1fr_auto] border-b border-border bg-secondary/30 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <span>Case signal</span>
                <span>Recovery strategy</span>
              </div>

              <div className="divide-y divide-border">
                {actionRows.map((row, index) => (
                  <motion.div
                    key={row.cause}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 sm:px-6"
                    initial={{
                      opacity: 0,
                      x: 20,
                    }}
                    whileInView={{
                      opacity: 1,
                      x: 0,
                    }}
                    viewport={{
                      once: true,
                      amount: 0.6,
                    }}
                    transition={{
                      duration: 0.45,
                      delay: index * 0.045,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <CircleDollarSign size={13} />
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {row.cause}
                      </span>
                    </div>

                    <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {row.action}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Safe AI */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute right-[-120px] top-[-100px] h-[400px] w-[400px] rounded-full bg-primary/[0.07] blur-[120px]" />

        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionLabel>AI, with boundaries</SectionLabel>

              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
                Let AI explain the case.
                <span className="block text-muted-foreground">
                  Keep money-moving decisions bounded.
                </span>
              </h2>

              <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted-foreground">
                Vidur uses the AI layer to generate a concise diagnosis of
                why a case is at risk and why the selected action makes
                sense. The deterministic recovery strategy and policy layer
                remain responsible for what can actually execute.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <span className="rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground">
                  Strategy selection
                </span>
                <span className="rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground">
                  Policy validation
                </span>
                <span className="rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground">
                  Audit logging
                </span>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-[26px] border border-border bg-card p-5 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.2)] sm:p-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-2">
                    <Bot size={17} className="text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      Recovery reasoning
                    </span>
                  </div>

                  <span className="text-[11px] text-muted-foreground">
                    AI-generated
                  </span>
                </div>

                <div className="mt-5 rounded-2xl bg-secondary/45 p-5">
                  <p className="text-sm leading-6 text-foreground">
                    “The payment failed because of insufficient funds. The
                    customer has prior successful payments, making a later
                    retry a reasonable recovery path.”
                  </p>
                </div>

                <div className="mt-4 grid gap-2">
                  {[
                    ['Strategy', 'RETRY_PAYMENT'],
                    ['Policy', 'ALLOW'],
                    ['Execution', 'SCHEDULED'],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
                    >
                      <span className="text-xs text-muted-foreground">
                        {label}
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <motion.div
                className="absolute -right-3 -top-3 flex size-11 items-center justify-center rounded-full border border-primary/20 bg-background text-primary shadow-lg"
                animate={
                  shouldReduceMotion
                    ? undefined
                    : {
                        y: [-4, 4, -4],
                        rotate: [0, 5, 0],
                      }
                }
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Sparkles size={18} />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Infrastructure */}
      <section className="border-t border-border bg-secondary/20">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-28">
          <div className="max-w-2xl">
            <SectionLabel>Under the hood</SectionLabel>

            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
              Recovery intelligence backed by a real application stack.
            </h2>

            <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
              The product is not a frontend-only simulation. Recovery cases,
              policies, actions, outcomes, and audit events live in the
              backend data model and the agent communicates with the business
              layer through defined service boundaries.
            </p>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {infrastructure.map((item, index) => {
              const Icon = item.icon

              return (
                <motion.div
                  key={item.title}
                  className="rounded-2xl border border-border bg-card p-5"
                  initial={{
                    opacity: 0,
                    y: 18,
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
                    duration: 0.5,
                    delay: index * 0.05,
                  }}
                >
                  <Icon
                    size={18}
                    className="text-primary"
                  />

                  <h3 className="mt-4 text-sm font-semibold text-foreground">
                    {item.title}
                  </h3>

                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    {item.text}
                  </p>
                </motion.div>
              )
            })}
          </div>

          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck
                size={18}
                className="mt-0.5 shrink-0 text-primary"
              />

              <div>
                <p className="text-sm font-semibold text-foreground">
                  Current integration boundary
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Razorpay Test Mode is accessed through the NestJS business
                  layer rather than directly from the agent.
                </p>
              </div>
            </div>

            <span className="shrink-0 rounded-full border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
              Test environment
            </span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
        <div className="relative overflow-hidden rounded-[30px] border border-primary/15 bg-primary/[0.045] px-7 py-14 text-center sm:px-12">
          <div className="pointer-events-none absolute left-1/2 top-0 size-[400px] -translate-x-1/2 rounded-full bg-primary/[0.08] blur-[110px]" />

          <div className="relative mx-auto max-w-2xl">
            <SectionLabel>Start with Vidur</SectionLabel>

            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
              Give every recovery case a decision.
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              Explore the workflow, inspect the recovery model, and connect
              the product to your recovery operations.
            </p>

            <Button
              size="lg"
              className="mt-8 h-11 px-6"
              onClick={() => navigate('/signup')}
            >
                Get started
                <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}