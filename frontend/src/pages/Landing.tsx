import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Bot,
  Check,
  CircleDollarSign,
  GitBranch,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Button } from '../components/ui/button'

const workflow = [
  {
    number: '01',
    title: 'Detect',
    description: 'Identify payment failures and open a recovery case.',
    icon: CircleDollarSign,
  },
  {
    number: '02',
    title: 'Assess',
    description: 'Estimate recovery probability and revenue exposure.',
    icon: GitBranch,
  },
  {
    number: '03',
    title: 'Decide',
    description: 'Select the safest recovery intervention for the case.',
    icon: Bot,
  },
  {
    number: '04',
    title: 'Protect',
    description: 'Evaluate the action against merchant recovery policies.',
    icon: ShieldCheck,
  },
  {
    number: '05',
    title: 'Recover',
    description: 'Execute, observe the outcome, or escalate to humans.',
    icon: Zap,
  },
]

const capabilities = [
  {
    icon: Bot,
    title: 'Agentic decisions',
    description:
      'Vidur evaluates recovery context and selects an intervention instead of relying on a fixed retry script.',
  },
  {
    icon: ShieldCheck,
    title: 'Policy controlled',
    description:
      'Recovery actions are checked against merchant-defined limits before execution.',
  },
  {
    icon: GitBranch,
    title: 'Observable recovery',
    description:
      'Every action, decision, policy result, and outcome becomes part of the recovery timeline.',
  },
]

export function Landing() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,color-mix(in_oklch,var(--primary),transparent_78%),transparent)]" />

      {/* Navigation */}
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <a href="/" aria-label="Vidur AI home" className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            V
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-foreground">Vidur AI</div>
            <div className="text-[11px] text-muted-foreground">
              Agentic Revenue Recovery
            </div>
          </div>
        </a>

        <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#platform" className="hover:text-foreground">Platform</a>
          <a href="#workflow" className="hover:text-foreground">How it works</a>
          <a href="#intelligence" className="hover:text-foreground">Intelligence</a>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate('/login')}>
            Sign in
          </Button>
          <Button onClick={() => navigate('/signup')}>
            Get started
            <ArrowRight size={15} />
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <motion.div
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Sparkles size={13} />
            Agentic revenue recovery
          </motion.div>

          <motion.h1
            className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
          >
            Every failed payment
            <span className="block text-muted-foreground">deserves a decision.</span>
          </motion.h1>

          <motion.p
            className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
          >
            Vidur AI turns payment failures into intelligent recovery
            workflows — assessing risk, selecting interventions, enforcing
            policies, and observing the outcome.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap items-center gap-5"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28 }}
          >
            <Button size="lg" onClick={() => navigate('/signup')}>
              Explore Vidur AI
              <ArrowRight size={17} />
            </Button>

            <a href="#workflow" className="text-sm font-medium text-foreground hover:text-primary">
              See how it works
            </a>
          </motion.div>

          <motion.div
            className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
          >
            {['Risk aware', 'Policy controlled', 'Fully observable'].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <Check size={13} className="text-primary" />
                {item}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Hero intelligence visual */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, x: 45 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.85, delay: 0.2 }}
        >
          <div className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-primary/20 blur-[100px]" />

          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/20">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Recovery intelligence
                </span>
                <h2 className="mt-1 text-base font-semibold text-foreground">
                  Agent decision
                </h2>
              </div>

              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Operational
              </span>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-secondary/40 p-4">
              <span className="text-xs text-muted-foreground">Revenue at risk</span>
              <strong className="mt-1 block text-3xl font-semibold tracking-tight text-foreground">
                ₹5,388.92
              </strong>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Recovery case</span>
                <span className="font-medium text-amber-400">MEDIUM RISK</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border p-3.5">
                <span className="text-xs text-muted-foreground">Recovery probability</span>
                <strong className="mt-1 block text-sm font-semibold text-foreground">40%</strong>
              </div>
              <div className="rounded-xl border border-border p-3.5">
                <span className="text-xs text-muted-foreground">Failure reason</span>
                <strong className="mt-1 block text-sm font-semibold text-foreground">
                  Insufficient funds
                </strong>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Bot size={16} />
              </div>
              <div className="flex-1">
                <span className="block text-xs text-muted-foreground">
                  Recommended intervention
                </span>
                <strong className="block text-sm font-semibold text-foreground">
                  Retry payment
                </strong>
              </div>
              <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-400">
                ALLOW
              </span>
            </div>

            <div className="mt-5 flex items-center justify-between px-1">
              {[Bot, ShieldCheck, Check].map((Icon, index) => (
                <div key={index} className="flex flex-1 items-center">
                  <span
                    className={`flex size-7 items-center justify-center rounded-full ${
                      index === 0
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border text-muted-foreground'
                    }`}
                  >
                    <Icon size={13} />
                  </span>
                  {index < 2 && <span className="h-px flex-1 bg-border" />}
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
              <span>Agent</span>
              <span>Policy</span>
              <span>Outcome</span>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
              <span className="text-muted-foreground">Policy check</span>
              <strong className="text-foreground">Passed</strong>
            </div>
          </div>

          <motion.div
            className="absolute -top-5 left-10 z-10 hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-lg sm:flex"
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Bot size={14} className="text-primary" />
            Agent active
          </motion.div>

          <motion.div
            className="absolute -bottom-5 right-10 z-10 hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-lg sm:flex"
            animate={{ y: [0, 7, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ShieldCheck size={14} className="text-emerald-400" />
            Policy verified
          </motion.div>
        </motion.div>
      </main>

      {/* Value strip */}
      <section id="platform" className="border-y border-border bg-secondary/20">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Vidur AI
            </span>
            <p className="mt-1 text-lg font-semibold leading-snug text-foreground">
              A recovery system that thinks beyond retries.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {[
              { label: 'Risk', desc: 'Understand the case' },
              { label: 'Strategy', desc: 'Choose the intervention' },
              { label: 'Policy', desc: 'Stay within boundaries' },
              { label: 'Outcome', desc: 'Learn from execution' },
            ].map((item) => (
              <div key={item.label}>
                <strong className="text-sm font-semibold text-foreground">
                  {item.label}
                </strong>
                <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-lg">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            The recovery loop
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            From payment failure to recovery outcome.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Vidur connects detection, risk assessment, strategy, policy
            enforcement, execution, and observation into one recovery loop.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {workflow.map((item, index) => (
            <motion.article
              key={item.number}
              className="relative rounded-xl border border-border bg-card p-5"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold">{item.number}</span>
                <item.icon size={18} className="text-primary" />
              </div>

              <h3 className="mt-3 text-sm font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Intelligence */}
      <section id="intelligence" className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Recovery intelligence
            </span>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-foreground">
              Decisions backed by
              <span className="block text-muted-foreground">context, not guesswork.</span>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              A recovery case is more than a failed transaction. Vidur
              evaluates payment context, customer history, failure signals,
              recovery probability, and policy boundaries before an action
              is executed.
            </p>

            <Button variant="outline" className="mt-6" onClick={() => navigate('/signup')}>
              View live dashboard
              <ArrowRight size={15} />
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Case analysis
                </span>
                <strong className="mt-1 block text-sm font-semibold text-foreground">
                  Recovery signal
                </strong>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                Analyzing
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {[
                ['Payment method', 'UPI'],
                ['Failure reason', 'Insufficient funds'],
                ['Previous payment history', 'Available'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-border pb-3 text-sm"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <strong className="text-foreground">{value}</strong>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Recovery probability</span>
                <strong className="text-foreground">40%</strong>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  whileInView={{ width: '40%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1 }}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Bot size={16} />
              </div>
              <div className="flex-1">
                <span className="block text-xs text-muted-foreground">
                  Agent recommendation
                </span>
                <strong className="block text-sm font-semibold text-foreground">
                  Retry payment later
                </strong>
              </div>
              <Check size={17} className="text-emerald-400" />
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-xl text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            Built for control
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            Autonomous where it should be.
            <span className="block text-muted-foreground">Controlled where it matters.</span>
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {capabilities.map((item, index) => (
            <motion.article
              key={item.title}
              className="rounded-xl border border-border bg-card p-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon size={18} />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-64 w-[80%] rounded-full bg-primary/15 blur-[100px]" />

        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Vidur AI
        </span>
        <h2 className="mx-auto mt-3 max-w-xl text-3xl font-semibold tracking-tight text-foreground">
          Turn failed payments into recoverable revenue.
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          See the recovery system behind the interface.
        </p>

        <Button size="lg" className="mt-7" onClick={() => navigate('/signup')}>
          Open Vidur AI Dashboard
          <ArrowRight size={17} />
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
              V
            </div>
            <div className="leading-tight">
              <strong className="block text-sm text-foreground">Vidur AI</strong>
              <span className="text-xs text-muted-foreground">
                Agentic Revenue Recovery
              </span>
            </div>
          </div>

          <span className="text-xs text-muted-foreground">
            Revenue recovery infrastructure for modern payment systems.
          </span>

          <span className="text-xs text-muted-foreground">© 2026 Vidur AI</span>
        </div>
      </footer>
    </div>
  )
}
