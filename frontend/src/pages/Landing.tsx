import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Check,
  CircleDollarSign,
  Clock3,
  Eye,
  Gauge,
  GitBranch,
  Layers3,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react'
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import { Button } from '../components/ui/button'
import { LandingFooter } from '../components/landing/LandingFooter'
import { LandingNavbar } from '../components/landing/LandingNavbar'
import { ProductPreview } from '../components/landing/ProductPreview'

const signalItems = [
  'Payment context',
  'Failure reason',
  'Customer history',
  'Recovery probability',
]

const decisionSteps = [
  {
    label: 'Context',
    description: 'Payment + customer signals',
    icon: Layers3,
  },
  {
    label: 'Risk',
    description: 'Recovery probability',
    icon: Gauge,
  },
  {
    label: 'Decision',
    description: 'Next-best action',
    icon: Target,
  },
  {
    label: 'Policy',
    description: 'Allowed intervention',
    icon: ShieldCheck,
  },
]

const outcomeItems = [
  {
    label: 'Action',
    value: 'Recovery initiated',
    icon: Zap,
  },
  {
    label: 'Status',
    value: 'Outcome observed',
    icon: Eye,
  },
  {
    label: 'System',
    value: 'Decision recorded',
    icon: Activity,
  },
]

function AnimatedGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            'linear-gradient(to right, hsl(var(--border) / 0.3) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.3) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage:
            'radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 78%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 78%)',
        }}
      />
    </div>
  )
}

function FloatingOrb({
  className,
  delay = 0,
}: {
  className: string
  delay?: number
}) {
  return (
    <motion.div
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
      animate={{
        y: [0, -18, 0],
        x: [0, 10, 0],
        scale: [1, 1.06, 1],
      }}
      transition={{
        duration: 7,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}

function RecoverySystemVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[620px]">
      <div className="absolute inset-[8%] rounded-full border border-primary/10" />
      <div className="absolute inset-[17%] rounded-full border border-primary/10" />
      <div className="absolute inset-[27%] rounded-full border border-primary/10" />

      <motion.div
        className="absolute inset-[8%] rounded-full border border-primary/15"
        animate={{ rotate: 360 }}
        transition={{
          duration: 32,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      <motion.div
        className="absolute inset-[17%] rounded-full border border-dashed border-primary/15"
        animate={{ rotate: -360 }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      <motion.div
        className="absolute left-1/2 top-1/2 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-2xl"
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <div className="absolute left-1/2 top-1/2 flex size-32 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary/25 bg-background/90 shadow-[0_0_80px_-25px_hsl(var(--primary)/0.7)] backdrop-blur-xl">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Sparkles size={28} />
        </div>
      </div>

      {[
        {
          label: 'Payment',
          icon: CircleDollarSign,
          position: 'left-[5%] top-[27%]',
        },
        {
          label: 'Context',
          icon: Layers3,
          position: 'right-[6%] top-[20%]',
        },
        {
          label: 'Risk',
          icon: Gauge,
          position: 'right-[3%] bottom-[27%]',
        },
        {
          label: 'Action',
          icon: Zap,
          position: 'left-[7%] bottom-[19%]',
        },
      ].map((node, index) => {
        const Icon = node.icon

        return (
          <motion.div
            key={node.label}
            className={`absolute ${node.position}`}
            animate={{
              y: [0, index % 2 === 0 ? -8 : 8, 0],
            }}
            transition={{
              duration: 4 + index * 0.6,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: index * 0.3,
            }}
          >
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 shadow-lg backdrop-blur-xl">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon size={14} />
              </div>
              <span className="text-xs font-medium">{node.label}</span>
            </div>
          </motion.div>
        )
      })}

      <motion.div
        className="absolute left-[20%] top-[12%] h-px w-[27%] origin-left bg-gradient-to-r from-transparent via-primary/50 to-primary"
        animate={{ opacity: [0.2, 0.8, 0.2] }}
        transition={{
          duration: 2.8,
          repeat: Infinity,
        }}
      />

      <motion.div
        className="absolute right-[17%] top-[34%] h-px w-[25%] origin-right rotate-[25deg] bg-gradient-to-l from-transparent via-primary/50 to-primary"
        animate={{ opacity: [0.15, 0.75, 0.15] }}
        transition={{
          duration: 3.2,
          repeat: Infinity,
          delay: 0.7,
        }}
      />

      <motion.div
        className="absolute bottom-[26%] right-[19%] h-px w-[28%] origin-right rotate-[-20deg] bg-gradient-to-l from-transparent via-primary/50 to-primary"
        animate={{ opacity: [0.15, 0.7, 0.15] }}
        transition={{
          duration: 3,
          repeat: Infinity,
          delay: 1.2,
        }}
      />
    </div>
  )
}

function FailureToDecisionVisual() {
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  const progress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 24,
    mass: 0.35,
  })

  const lineScale = useTransform(progress, [0.15, 0.72], [0, 1])
  const cardY = useTransform(progress, [0.15, 0.72], [70, 0])
  const cardOpacity = useTransform(progress, [0.1, 0.35], [0, 1])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative mx-auto max-w-5xl">
        <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-white/10 md:block" />

        <motion.div
          className="absolute left-1/2 top-0 hidden h-full w-px origin-top -translate-x-1/2 bg-gradient-to-b from-primary via-primary/70 to-transparent md:block"
          style={{ scaleY: lineScale }}
        />

        <div className="grid gap-16 md:grid-cols-2 md:gap-24">
          <motion.div
            className="relative"
            style={{
              y: cardY,
              opacity: cardOpacity,
            }}
          >
            <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-7 backdrop-blur-xl sm:p-9">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/40">
                  Incoming event
                </span>

                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Clock3 size={13} />
                  Just now
                </div>
              </div>

              <div className="mt-8 flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-red-400/10 text-red-300">
                  <CircleDollarSign size={22} />
                </div>

                <div>
                  <div className="font-medium text-white">
                    Payment failed
                  </div>
                  <div className="mt-1 text-sm text-white/45">
                    Recovery opportunity detected
                  </div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3">
                {signalItems.map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-white/8 bg-black/10 px-3 py-3 text-xs text-white/55"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            className="relative md:pt-28"
            style={{
              y: useTransform(progress, [0.25, 0.8], [100, 0]),
              opacity: useTransform(progress, [0.2, 0.45], [0, 1]),
            }}
          >
            <div className="rounded-3xl border border-primary/20 bg-primary/[0.07] p-7 shadow-[0_30px_100px_-50px_hsl(var(--primary)/0.8)] backdrop-blur-xl sm:p-9">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
                <Sparkles size={13} />
                Vidur decision
              </div>

              <h3 className="mt-6 text-2xl font-semibold tracking-tight text-white">
                Choose the next-best action.
              </h3>

              <p className="mt-3 text-sm leading-6 text-white/50">
                The system evaluates the available context before an
                intervention is selected.
              </p>

              <div className="mt-7 space-y-2">
                {decisionSteps.map((step, index) => {
                  const Icon = step.icon

                  return (
                    <motion.div
                      key={step.label}
                      className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/10 px-3 py-3"
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.45,
                        delay: index * 0.08,
                      }}
                    >
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon size={15} />
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white">
                          {step.label}
                        </div>
                        <div className="text-xs text-white/40">
                          {step.description}
                        </div>
                      </div>

                      <Check
                        size={14}
                        className="ml-auto shrink-0 text-primary"
                      />
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function OutcomeVisual() {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-border bg-card">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,hsl(var(--primary)/0.10),transparent_35%)]" />

      <div className="relative p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Recovery activity
            </div>
            <div className="mt-1 text-lg font-semibold">
              Decisions in motion
            </div>
          </div>

          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Activity size={17} />
          </div>
        </div>

        <div className="relative mt-10 h-[190px] overflow-hidden rounded-2xl border border-border bg-background/70">
          <svg
            viewBox="0 0 700 190"
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="recoveryLine" x1="0" x2="1">
                <stop offset="0" stopColor="currentColor" stopOpacity="0" />
                <stop offset="0.25" stopColor="currentColor" stopOpacity="0.35" />
                <stop offset="0.65" stopColor="currentColor" stopOpacity="0.8" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0.25" />
              </linearGradient>
            </defs>

            {[38, 76, 114, 152].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="700"
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.08"
              />
            ))}

            <motion.path
              d="M0 145 C75 140 90 120 145 126 C205 134 235 94 295 108 C350 120 375 70 425 84 C475 99 510 60 565 66 C610 72 640 42 700 48"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.8"
              strokeWidth="2"
              className="text-primary"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.8, ease: 'easeOut' }}
            />
          </svg>

          <div className="absolute bottom-4 left-4 text-[10px] text-muted-foreground">
            payment events
          </div>

          <div className="absolute right-4 top-4 flex items-center gap-2 text-[10px] text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            live activity
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {outcomeItems.map((item) => {
            const Icon = item.icon

            return (
              <motion.div
                key={item.label}
                className="rounded-xl border border-border bg-background/60 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg"
                whileHover={{ y: -3 }}
              >
                <Icon size={15} className="text-primary" />
                <div className="mt-3 text-[11px] text-muted-foreground">
                  {item.label}
                </div>
                <div className="mt-1 text-xs font-medium">
                  {item.value}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function Landing() {
  const navigate = useNavigate()
  const heroRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })

  const heroY = useTransform(scrollYProgress, [0, 1], [0, -110])
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.92])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0])

  const visualY = useTransform(scrollYProgress, [0, 1], [0, 90])
  const visualRotate = useTransform(scrollYProgress, [0, 1], [0, -3])

  const smoothHeroY = useSpring(heroY, {
    stiffness: 100,
    damping: 25,
  })

  const smoothVisualY = useSpring(visualY, {
    stiffness: 80,
    damping: 24,
  })

  useMotionValueEvent(scrollYProgress, 'change', () => {
    // Keeps scroll-linked motion alive without triggering React re-renders.
  })

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <LandingNavbar />

      {/* ================================================================ */}
      {/* HERO */}
      {/* ================================================================ */}

      <section
        ref={heroRef}
        className="relative -translate-y-12 min-h-[calc(100vh-96px)] overflow-hidden"
      >
        <AnimatedGrid />

        <FloatingOrb
          className="left-[8%] top-[12%] size-64 bg-primary/10"
        />

        <FloatingOrb
          className="right-[5%] top-[22%] size-72 bg-sky-400/10"
          delay={1.2}
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-20 sm:pt-24 lg:min-h-[calc(100vh-96px)] lg:grid-cols-[0.9fr_1.1fr] lg:gap-8 lg:py-16">
          <motion.div
            className="relative z-10 max-w-2xl"
            style={{
              y: smoothHeroY,
              scale: heroScale,
              opacity: heroOpacity,
            }}
          >
            <motion.h1
              className="mt-7 text-[46px] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-[64px] lg:text-[76px]"
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.08,
                ease: 'easeOut',
              }}
            >
              When a payment
              <span className="block text-muted-foreground/70">
                fails,
              </span>
              <span className="block bg-gradient-to-r from-primary via-primary to-sky-400 bg-clip-text text-transparent">
                Vidur decides.
              </span>
            </motion.h1>

            <motion.p
              className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.2,
              }}
            >
              Vidur AI turns payment failures into context-aware recovery
              decisions — so every failed transaction becomes an opportunity
              to act intelligently.
            </motion.p>

            <motion.div
              className="mt-9 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: 0.3,
              }}
            >
              <Button
                size="lg"
                className="group h-12 rounded-full px-6 shadow-[0_10px_35px_-12px_hsl(var(--primary)/0.7)]"
                onClick={() => navigate('/signup')}
              >
                Start recovering
                <ArrowRight
                  size={16}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Button>

              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById('decision-system')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }
                className="group inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-medium text-foreground transition-colors hover:text-primary"
              >
                See the system
                <ArrowDownRight
                  size={16}
                  className="transition-transform duration-300 group-hover:translate-y-1 group-hover:rotate-12"
                />
              </button>
            </motion.div>

            <motion.div
              className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.6,
                delay: 0.45,
              }}
            >
              {[
                'Context-aware',
                'Policy-controlled',
                'Observable',
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <Check size={12} className="text-primary" />
                  {item}
                </span>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            className="relative z-10"
            style={{
              y: smoothVisualY,
              rotate: visualRotate,
            }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.9,
              delay: 0.18,
              ease: 'easeOut',
            }}
          >
            <RecoverySystemVisual />
          </motion.div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* DARK STORY SECTION */}
      {/* ================================================================ */}

      <section
        id="decision-system"
        className="relative overflow-hidden bg-[#080b12] text-white"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[130px]" />

          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
              maskImage:
                'linear-gradient(to bottom, black, transparent 90%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, black, transparent 90%)',
            }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 py-28 sm:py-36">
          <motion.div
            className="mx-auto max-w-3xl text-center"
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.65 }}
          >
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles size={14} />
              The difference
            </div>

            <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
              A failed payment is not
              <span className="block text-white/40">
                the end of the transaction.
              </span>
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/45 sm:text-base">
              Most recovery systems start with a retry rule. Vidur starts by
              understanding what happened and deciding whether an action makes
              sense.
            </p>
          </motion.div>

          <div className="mt-24">
            <FailureToDecisionVisual />
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* INTELLIGENCE / LIGHT */}
      {/* ================================================================ */}

      <section className="relative overflow-hidden bg-background">
        <div className="mx-auto max-w-7xl px-6 py-28 sm:py-36">
          <div className="grid gap-16 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.65 }}
            >
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Recovery intelligence
              </span>

              <h2 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl">
                Context becomes
                <span className="block text-muted-foreground">
                  the decision.
                </span>
              </h2>

              <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">
                Vidur brings the signals around a payment together before
                deciding what should happen next. The result is a recovery
                system that can reason about the situation instead of blindly
                repeating an action.
              </p>

              <div className="mt-8">
                <Button
                  variant="outline"
                  className="group rounded-full"
                  onClick={() => navigate('/product')}
                >
                  Explore the product
                  <ArrowRight
                    size={15}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </Button>
              </div>
            </motion.div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: Layers3,
                  title: 'Payment context',
                  text: 'The transaction is evaluated with the surrounding payment context.',
                },
                {
                  icon: Gauge,
                  title: 'Recovery probability',
                  text: 'Recovery opportunity is evaluated before intervention.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Policy boundaries',
                  text: 'Actions remain inside the rules configured by the business.',
                },
                {
                  icon: Eye,
                  title: 'Observable outcome',
                  text: 'The resulting action and outcome remain visible.',
                },
              ].map((item, index) => {
                const Icon = item.icon

                return (
                  <motion.div
                    key={item.title}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-500 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_24px_60px_-40px_hsl(var(--foreground)/0.4)]"
                    initial={{ opacity: 0, y: 25 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{
                      duration: 0.5,
                      delay: index * 0.07,
                    }}
                  >
                    <div className="absolute -right-12 -top-12 size-32 rounded-full bg-primary/5 blur-2xl transition-transform duration-700 group-hover:scale-150" />

                    <div className="relative">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110">
                        <Icon size={18} />
                      </div>

                      <h3 className="mt-6 text-base font-semibold">
                        {item.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {item.text}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* DARK OUTCOME SECTION */}
      {/* ================================================================ */}

      <section className="relative overflow-hidden bg-[#080b12] text-white">
        <FloatingOrb
          className="left-[-12%] top-[30%] size-[420px] bg-primary/10"
        />

        <FloatingOrb
          className="right-[-10%] bottom-[10%] size-[380px] bg-blue-400/10"
          delay={1}
        />

        <div className="relative mx-auto max-w-7xl px-6 py-28 sm:py-36">
          <div className="grid gap-16 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.65 }}
            >
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Recovery loop
              </span>

              <h2 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl">
                Don't just
                <span className="block text-white/40">
                  take an action.
                </span>
                Learn what happened.
              </h2>

              <p className="mt-6 max-w-md text-sm leading-7 text-white/45 sm:text-base">
                Recovery becomes more useful when the system can observe the
                result. Vidur keeps the decision and outcome connected so
                recovery operations remain measurable.
              </p>

              <div className="mt-8 flex items-center gap-3 text-sm text-white/60">
                <div className="flex size-8 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                  <GitBranch size={15} />
                </div>
                Decision → action → outcome
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.7 }}
            >
              <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-2 shadow-[0_30px_100px_-50px_rgba(0,0,0,0.8)]">
                <OutcomeVisual />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* PRODUCT REVEAL */}
      {/* ================================================================ */}

      <section className="relative overflow-hidden bg-background">
        <div className="mx-auto max-w-7xl px-6 py-28 sm:py-36">
          <motion.div
            className="mx-auto max-w-2xl text-center"
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.65 }}
          >
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Inside Vidur
            </span>

            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              See recovery intelligence
              <span className="block text-muted-foreground">
                where your team uses it.
              </span>
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              Recovery cases, decisions, actions, and outcomes come together
              inside one operational view.
            </p>
          </motion.div>

          <motion.div
            className="relative mt-16"
            initial={{ opacity: 0, y: 50, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{
              duration: 0.8,
              ease: 'easeOut',
            }}
          >
            <div className="absolute -inset-10 rounded-[40px] bg-primary/[0.04] blur-3xl" />

            <div className="relative overflow-hidden rounded-[24px] border border-border shadow-[0_40px_100px_-60px_hsl(var(--foreground)/0.5)]">
              <ProductPreview />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* INTEGRATION / STRIP */}
      {/* ================================================================ */}

      <section className="border-y border-border bg-secondary/20">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Infrastructure
              </span>

              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                Designed to sit alongside your payment stack.
              </h2>
            </div>

            <motion.div
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm"
              whileHover={{
                y: -4,
                boxShadow:
                  '0 20px 50px -30px hsl(var(--foreground) / 0.4)',
              }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CircleDollarSign size={18} />
              </div>

              <div>
                <div className="text-sm font-semibold">Razorpay</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Payment infrastructure
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* FINAL CTA */}
      {/* ================================================================ */}

      <section className="relative overflow-hidden bg-[#080b12] text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[130px]" />

          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '28px 28px',
              maskImage:
                'radial-gradient(ellipse 55% 70% at 50% 50%, black, transparent)',
              WebkitMaskImage:
                'radial-gradient(ellipse 55% 70% at 50% 50%, black, transparent)',
            }}
          />
        </div>

        <div className="relative mx-auto max-w-4xl px-6 py-32 text-center sm:py-40">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
          >

            <h2 className="mt-7 text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
              Stop treating every
              <span className="block text-white/40">
                failed payment the same.
              </span>
            </h2>

            <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-white/45 sm:text-base">
              Give your payment recovery operation a system that can
              understand context, make decisions, and measure what happens
              next.
            </p>

            <div className="mt-9 flex justify-center">
              <Button
                size="lg"
                className="group h-12 rounded-full px-7 shadow-[0_15px_50px_-15px_hsl(var(--primary)/0.7)]"
                onClick={() => navigate('/signup')}
              >
                Create your workspace
                <ArrowRight
                  size={16}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}