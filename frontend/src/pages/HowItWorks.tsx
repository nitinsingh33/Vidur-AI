import { useRef } from 'react'
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Bot,
  CircleDollarSign,
  Database,
  Eye,
  GitBranch,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
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

const stages = [
  {
    number: '01',
    icon: CircleDollarSign,
    title: 'Detect',
    description:
      'A failed payment, abandoned checkout, or overdue invoice becomes a structured recovery case.',
    detail: 'Revenue at risk is calculated as part of the risk assessment.',
  },
  {
    number: '02',
    icon: Search,
    title: 'Load context',
    description:
      'Vidur loads the payment, customer, order, invoice, and relevant historical payment context available to the case.',
    detail: 'Context includes amount, payment method, failure reason, and retry history.',
  },
  {
    number: '03',
    icon: TrendingProbability,
    title: 'Predict recovery probability',
    description:
      'The ML service estimates the likelihood that the case can be recovered.',
    detail:
      'The current model uses payment, failure, customer-history, and retry features.',
  },
  {
    number: '04',
    icon: Target,
    title: 'Select intervention',
    description:
      'The deterministic recovery strategy maps the diagnosed root cause to an appropriate candidate action.',
    detail:
      'Examples include retry payment, payment link, payment-method update, receivable follow-up, or escalation.',
  },
  {
    number: '05',
    icon: Sparkles,
    title: 'Generate diagnosis',
    description:
      'The language-model layer produces a concise explanation of why the case is at risk and why the selected action fits.',
    detail:
      'The LLM explains the selected strategy; it does not directly control the money-moving action.',
  },
  {
    number: '06',
    icon: ShieldCheck,
    title: 'Check policy',
    description:
      'The candidate action is checked against the merchant’s configured recovery policy.',
    detail:
      'Configured limits can constrain amount, retries, contacts, and whether an action is allowed.',
  },
  {
    number: '07',
    icon: Zap,
    title: 'Execute',
    description:
      'An allowed recovery action is executed through the NestJS business layer.',
    detail:
      'The current integration path includes Razorpay Test Mode and internal recovery services.',
  },
  {
    number: '08',
    icon: Eye,
    title: 'Observe outcome',
    description:
      'The system checks whether the action recovered the case and persists the recovery outcome.',
    detail:
      'Successful recovery, failure, retry eligibility, and escalation are represented explicitly.',
  },
  {
    number: '09',
    icon: UserRound,
    title: 'Retry or escalate',
    description:
      'A failed action can continue when the workflow says another attempt is appropriate; otherwise the case moves toward escalation.',
    detail:
      'Recovery attempts are bounded so the workflow cannot retry indefinitely.',
  },
]

function TrendingProbability(props: { size?: number; className?: string }) {
  return (
    <div
      className={props.className}
      style={{
        width: props.size ?? 18,
        height: props.size ?? 18,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="size-full"
      >
        <path d="M3 17l5-5 4 3 7-8" />
        <path d="M15 7h4v4" />
      </svg>
    </div>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
      <span className="size-1.5 rounded-full bg-primary" />
      {children}
    </span>
  )
}

function WorkflowRail() {
  const ref = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 75%', 'end 25%'],
  })

  const lineScale = useSpring(
    useTransform(
      scrollYProgress,
      [0, 1],
      shouldReduceMotion ? [1, 1] : [0, 1],
    ),
    {
      stiffness: 90,
      damping: 24,
    },
  )

  return (
    <div ref={ref} className="relative">
      <div className="absolute left-[22px] top-5 bottom-5 w-px bg-border" />

      <motion.div
        className="absolute left-[22px] top-5 w-px origin-top bg-primary"
        style={{
          height: 'calc(100% - 40px)',
          scaleY: lineScale,
        }}
      />

      <div className="space-y-5">
        {stages.map((stage, index) => {
          const Icon = stage.icon

          return (
            <motion.article
              key={stage.number}
              className="relative grid grid-cols-[45px_1fr] gap-4"
              initial={{
                opacity: 0,
                x: 22,
              }}
              whileInView={{
                opacity: 1,
                x: 0,
              }}
              viewport={{
                once: true,
                amount: 0.25,
              }}
              transition={{
                duration: 0.6,
                delay: index * 0.035,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <motion.div
                className="relative z-10 flex size-[45px] items-center justify-center rounded-full border border-border bg-background text-primary"
                whileInView={{
                  borderColor: 'color-mix(in oklch, var(--primary), transparent 65%)',
                  backgroundColor:
                    'color-mix(in oklch, var(--primary), transparent 92%)',
                }}
                viewport={{
                  once: true,
                }}
                transition={{
                  duration: 0.5,
                }}
              >
                <Icon size={17} />
              </motion.div>

              <div className="rounded-[22px] border border-border bg-card p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Step {stage.number}
                    </span>

                    <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                      {stage.title}
                    </h3>
                  </div>

                  {index < stages.length - 1 && (
                    <ArrowDown
                      size={15}
                      className="text-border"
                    />
                  )}
                </div>

                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {stage.description}
                </p>

                <div className="mt-4 rounded-xl bg-secondary/45 px-4 py-3">
                  <p className="text-xs leading-5 text-muted-foreground">
                    {stage.detail}
                  </p>
                </div>
              </div>
            </motion.article>
          )
        })}
      </div>
    </div>
  )
}

function AgentStateVisual() {
  const shouldReduceMotion = useReducedMotion()

  const nodes = [
    { label: 'Context', icon: Database },
    { label: 'Probability', icon: TrendingProbability },
    { label: 'Strategy', icon: Target },
    { label: 'Policy', icon: ShieldCheck },
    { label: 'Action', icon: Zap },
  ]

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-border bg-card p-5 shadow-[0_30px_90px_-50px_rgba(0,0,0,0.25)] sm:p-7">
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 size-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10"
        animate={
          shouldReduceMotion
            ? undefined
            : {
                scale: [0.95, 1.05, 0.95],
                rotate: [0, 12, 0],
              }
        }
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <div className="relative">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Agent state
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              Recovery decision path
            </p>
          </div>

          <span className="flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            bounded
          </span>
        </div>

        <div className="relative mx-auto mt-7 max-w-md">
          <div className="absolute left-1/2 top-7 bottom-7 w-px -translate-x-1/2 bg-border" />

          <div className="space-y-3">
            {nodes.map((node, index) => {
              const Icon = node.icon

              return (
                <motion.div
                  key={node.label}
                  className="relative z-10 flex items-center justify-center"
                  initial={{
                    opacity: 0,
                    scale: 0.92,
                  }}
                  whileInView={{
                    opacity: 1,
                    scale: 1,
                  }}
                  viewport={{
                    once: true,
                  }}
                  transition={{
                    duration: 0.45,
                    delay: index * 0.08,
                  }}
                >
                  <div className="flex w-full max-w-[270px] items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon size={15} />
                    </div>

                    <span className="text-sm font-medium text-foreground">
                      {node.label}
                    </span>

                    {index < nodes.length - 1 && (
                      <ArrowRight
                        size={14}
                        className="ml-auto text-muted-foreground"
                      />
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border p-4">
            <p className="text-[11px] text-muted-foreground">
              If policy allows
            </p>
            <p className="mt-1.5 text-sm font-semibold text-foreground">
              Execute action
            </p>
          </div>

          <div className="rounded-xl border border-border p-4">
            <p className="text-[11px] text-muted-foreground">
              If recovery fails
            </p>
            <p className="mt-1.5 text-sm font-semibold text-foreground">
              Retry or escalate
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function HowItWorks() {
  const navigate = useNavigate()
  const heroRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })

  const heroScale = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? [1, 1] : [1, 0.94],
  )

  const heroY = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? [0, 0] : [0, -60],
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
          <div className="absolute left-[25%] top-[-220px] size-[620px] rounded-full bg-primary/[0.10] blur-[150px]" />

          <div
            className="absolute inset-0 opacity-[0.17]"
            style={{
              backgroundImage:
                'radial-gradient(circle, hsl(var(--foreground) / 0.2) 1px, transparent 1px)',
              backgroundSize: '30px 30px',
              maskImage:
                'linear-gradient(to bottom, black, transparent 75%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, black, transparent 75%)',
            }}
          />
        </div>

        <motion.div
          style={{
            scale: heroScale,
            y: heroY,
          }}
          className="relative mx-auto max-w-5xl px-6 pb-24 pt-20 text-center lg:px-10 lg:pb-32 lg:pt-28"
        >
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.94,
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
            <SectionLabel>How Vidur works</SectionLabel>
          </motion.div>

          <h1 className="mx-auto mt-6 max-w-4xl text-[48px] font-semibold leading-[0.98] tracking-[-0.045em] text-foreground sm:text-[64px] lg:text-[76px]">
            From revenue risk to a{' '}
            <span className="bg-gradient-to-r from-primary via-primary to-sky-500 bg-clip-text text-transparent">
              bounded recovery action.
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-muted-foreground sm:text-[17px]">
            Vidur connects detection, context, probability, strategy,
            reasoning, policy, execution, and outcome tracking into one
            recovery workflow.
          </p>

          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-2">
            {[
              'Detect',
              'Context',
              'Predict',
              'Decide',
              'Explain',
              'Policy',
              'Execute',
              'Observe',
              'Escalate',
            ].map((step, index, array) => (
              <div
                key={step}
                className="flex items-center gap-2"
              >
                <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                  {step}
                </span>

                {index < array.length - 1 && (
                  <ArrowRight
                    size={12}
                    className="text-muted-foreground/60"
                  />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Workflow */}
      <section>
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
          <div className="grid gap-14 lg:grid-cols-[0.65fr_1.35fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <SectionLabel>The recovery loop</SectionLabel>

              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
                Every step leaves a trace.
              </h2>

              <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
                Recovery is represented as an explicit workflow state rather
                than a hidden background process. Cases, actions, outcomes,
                policies, and audit events remain observable.
              </p>

              <div className="mt-8 rounded-2xl border border-border bg-secondary/35 p-5">
                <div className="flex items-start gap-3">
                  <Activity
                    size={18}
                    className="mt-0.5 shrink-0 text-primary"
                  />

                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Outcome is part of the workflow.
                    </p>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                      Vidur doesn't stop at recommending an action. The
                      execution result is observed and persisted.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <WorkflowRail />
          </div>
        </div>
      </section>

      {/* Decision architecture */}
      <section className="border-y border-border bg-secondary/20">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionLabel>Agent architecture</SectionLabel>

              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
                The agent is a stateful workflow, not a chat box.
              </h2>

              <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted-foreground">
                The current recovery agent is implemented as a LangGraph
                state machine. It loads the case, enriches the state,
                obtains recovery probability, selects a strategy, generates
                diagnosis, checks policy, executes, observes the outcome,
                and routes the case accordingly.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    icon: GitBranch,
                    title: 'Stateful',
                    text: 'Recovery state is carried through the workflow.',
                  },
                  {
                    icon: ShieldCheck,
                    title: 'Bounded',
                    text: 'Policy and attempt limits constrain execution.',
                  },
                  {
                    icon: Eye,
                    title: 'Observable',
                    text: 'Execution and outcomes are persisted.',
                  },
                  {
                    icon: Database,
                    title: 'Persistent',
                    text: 'Recovery data lives in PostgreSQL.',
                  },
                ].map((item, index) => {
                  const Icon = item.icon

                  return (
                    <motion.div
                      key={item.title}
                      className="rounded-2xl border border-border bg-card p-5"
                      initial={{
                        opacity: 0,
                        y: 16,
                      }}
                      whileInView={{
                        opacity: 1,
                        y: 0,
                      }}
                      viewport={{
                        once: true,
                        amount: 0.25,
                      }}
                      transition={{
                        duration: 0.5,
                        delay: index * 0.06,
                      }}
                    >
                      <Icon
                        size={17}
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
            </div>

            <AgentStateVisual />
          </div>
        </div>
      </section>

      {/* ML + LLM distinction */}
      <section>
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <SectionLabel>Two different intelligence layers</SectionLabel>

            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
              Prediction and explanation have different jobs.
            </h2>

            <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
              Vidur deliberately separates the recovery-probability model
              from the language-model diagnosis layer.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-2">
            <motion.div
              className="rounded-[26px] border border-border bg-card p-7"
              initial={{
                opacity: 0,
                x: -24,
              }}
              whileInView={{
                opacity: 1,
                x: 0,
              }}
              viewport={{
                once: true,
                amount: 0.3,
              }}
              transition={{
                duration: 0.65,
              }}
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <TrendingProbability size={19} />
              </div>

              <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                ML layer
              </p>

              <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                Recovery probability
              </h3>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The FastAPI service hosts the recovery-probability model.
                Features include amount, failure reason, payment method,
                customer history, previous failures and successes, customer
                value, retry count, and retry failures.
              </p>

              <div className="mt-6 rounded-2xl border border-border bg-secondary/35 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Example output
                  </span>
                  <span className="text-lg font-semibold text-foreground">
                    68%
                  </span>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="rounded-[26px] border border-border bg-card p-7"
              initial={{
                opacity: 0,
                x: 24,
              }}
              whileInView={{
                opacity: 1,
                x: 0,
              }}
              viewport={{
                once: true,
                amount: 0.3,
              }}
              transition={{
                duration: 0.65,
                delay: 0.08,
              }}
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bot size={19} />
              </div>

              <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Language model
              </p>

              <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                Case diagnosis
              </h3>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Gemini generates a concise explanation of why the case is at
                risk and why the already-selected recovery action fits the
                available context.
              </p>

              <div className="mt-6 rounded-2xl border border-border bg-secondary/35 p-4">
                <p className="text-xs leading-5 text-muted-foreground">
                  “Insufficient funds were identified. Prior successful
                  payments make a later retry a reasonable recovery path.”
                </p>
              </div>
            </motion.div>
          </div>

          <div className="mx-auto mt-6 flex max-w-5xl items-start gap-3 rounded-2xl border border-primary/15 bg-primary/[0.045] p-5">
            <ShieldCheck
              size={18}
              className="mt-0.5 shrink-0 text-primary"
            />

            <p className="text-xs leading-5 text-muted-foreground">
              <span className="font-semibold text-foreground">
                Safety boundary:
              </span>{' '}
              the current LLM diagnosis is best-effort and does not decide
              which money-moving action is executed. Deterministic strategy
              selection and policy validation remain in the application
              layer.
            </p>
          </div>
        </div>
      </section>

      {/* Bounded execution */}
      <section className="border-t border-border bg-secondary/20">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <SectionLabel>Bounded execution</SectionLabel>

            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
              Recovery should converge, not loop forever.
            </h2>

            <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
              The recovery service limits attempts for an action type. When
              an action repeatedly fails, the case can become exhausted or
              move toward escalation instead of continuing indefinitely.
            </p>
          </div>

          <div className="mx-auto mt-14 max-w-4xl">
            <div className="grid gap-3 md:grid-cols-5">
              {[
                ['Attempt', '1'],
                ['Attempt', '2'],
                ['Attempt', '3'],
                ['Limit', 'Reached'],
                ['Next', 'Escalate'],
              ].map(([label, value], index) => (
                <motion.div
                  key={`${label}-${value}`}
                  className="relative rounded-2xl border border-border bg-card p-5 text-center"
                  initial={{
                    opacity: 0,
                    scale: 0.92,
                  }}
                  whileInView={{
                    opacity: 1,
                    scale: 1,
                  }}
                  viewport={{
                    once: true,
                    amount: 0.4,
                  }}
                  transition={{
                    duration: 0.45,
                    delay: index * 0.08,
                  }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {label}
                  </p>

                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {value}
                  </p>

                  {index < 4 && (
                    <ArrowRight
                      size={13}
                      className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 text-muted-foreground md:block"
                    />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
        <div className="relative overflow-hidden rounded-[30px] border border-primary/15 bg-primary/[0.045] px-7 py-14 text-center sm:px-12">
          <div className="pointer-events-none absolute left-1/2 top-[-160px] size-[420px] -translate-x-1/2 rounded-full bg-primary/[0.09] blur-[120px]" />

          <div className="relative">
            <SectionLabel>See Vidur in action</SectionLabel>

            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
              From failure detection to an observable recovery outcome.
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              Create a workspace and explore the recovery system from the
              operator side.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
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
                onClick={() => navigate('/product')}
              >
                  Explore product
              </Button>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}