import { motion } from 'framer-motion'
import {
  ArrowRight,
  Braces,
  Check,
  CircleDot,
  Code2,
  Database,
  Lock,
  Terminal,
  Workflow,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { LandingNavbar } from '../components/landing/LandingNavbar'
import { LandingFooter } from '../components/landing/LandingFooter'

const capabilities = [
  {
    icon: Code2,
    title: 'REST API',
    text: 'Connect recovery workflows to the same backend services that power the Vidur AI application.',
  },
  {
    icon: Workflow,
    title: 'Recovery orchestration',
    text: 'Run a recovery case through diagnosis, strategy, policy validation, execution, and observation.',
  },
  {
    icon: Lock,
    title: 'Policy-controlled actions',
    text: 'Recovery actions are evaluated against configured policy boundaries before execution.',
  },
  {
    icon: Database,
    title: 'Observable outcomes',
    text: 'Recovery decisions, actions, and outcomes remain available for operational visibility and audit.',
  },
]

const apiAreas = [
  {
    method: 'GET',
    path: '/recovery-cases',
    description: 'Retrieve recovery cases and their current state.',
  },
  {
    method: 'GET',
    path: '/analytics/summary',
    description: 'Read recovery performance and revenue metrics.',
  },
  {
    method: 'POST',
    path: '/recovery/cases/:id/run-agent',
    description: 'Run the recovery agent for a specific case.',
  },
  {
    method: 'POST',
    path: '/policies/check/:case/:action',
    description: 'Validate an action against recovery policy.',
  },
]

const architecture = [
  'Payment event',
  'Recovery case',
  'Risk + ML',
  'Agent decision',
  'Policy check',
  'Action',
  'Outcome',
]

export function Developers() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <LandingNavbar />

      {/* Hero */}
      <main className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(ellipse_65%_55%_at_50%_-10%,color-mix(in_oklch,var(--primary),transparent_84%),transparent)]" />

        <section className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pt-28 lg:pb-32">
          <motion.div
            className="max-w-3xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
              <Terminal size={14} />
              Developer platform
            </div>

            <h1 className="mt-7 text-4xl font-semibold leading-[1.04] tracking-[-0.04em] sm:text-6xl lg:text-[72px]">
              Build recovery
              <span className="block bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
                into your payments.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Connect payment events to an intelligent recovery workflow that
              can diagnose failures, evaluate recovery probability, enforce
              policy, execute actions, and record the outcome.
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
                Explore the workflow
              </Button>
            </div>
          </motion.div>

          {/* Developer visual */}
          <motion.div
            className="relative mt-16 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_80px_-40px_color-mix(in_oklch,var(--foreground),transparent_70%)]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <span className="size-2.5 rounded-full bg-muted-foreground/30" />
              <span className="size-2.5 rounded-full bg-muted-foreground/30" />
              <span className="size-2.5 rounded-full bg-muted-foreground/30" />
              <span className="ml-3 text-xs text-muted-foreground">
                recovery request
              </span>
            </div>

            <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
              <div className="border-b border-border p-6 lg:border-b-0 lg:border-r lg:p-8">
                <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Braces size={14} className="text-primary" />
                  Recovery API
                </div>

                <pre className="overflow-x-auto text-sm leading-7">
                  <code>
                    <span className="text-primary">POST</span>{' '}
                    <span className="text-foreground">
                      /recovery/cases/&#123;id&#125;/run-agent
                    </span>
                    {'\n\n'}
                    <span className="text-muted-foreground">
                      {'{'}
                    </span>
                    {'\n'}
                    {'  '}
                    <span className="text-muted-foreground">
                      &quot;caseId&quot;
                    </span>
                    <span className="text-muted-foreground">: </span>
                    <span className="text-primary">
                      &quot;recovery_case_id&quot;
                    </span>
                    {',\n'}
                    {'  '}
                    <span className="text-muted-foreground">
                      &quot;mode&quot;
                    </span>
                    <span className="text-muted-foreground">: </span>
                    <span className="text-primary">
                      &quot;agent&quot;
                    </span>
                    {'\n'}
                    <span className="text-muted-foreground">
                      {'}'}
                    </span>
                  </code>
                </pre>
              </div>

              <div className="p-6 lg:p-8">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Agent execution
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    'Load recovery context',
                    'Analyze payment failure',
                    'Predict recovery probability',
                    'Select intervention',
                    'Validate policy',
                    'Execute + observe',
                  ].map((step, index) => (
                    <motion.div
                      key={step}
                      className="flex items-center gap-3"
                      initial={{ opacity: 0, x: 10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.35,
                        delay: index * 0.06,
                      }}
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {index + 1}
                      </div>
                      <span className="text-sm">{step}</span>
                      {index === 5 && (
                        <Check
                          size={15}
                          className="ml-auto text-primary"
                        />
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Capabilities */}
        <section className="border-y border-border bg-secondary/20">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="max-w-xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Built for integration
              </span>

              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                The recovery layer sits behind your payment flow.
              </h2>

              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Vidur AI separates payment infrastructure from recovery
                intelligence so the agent can reason without owning your core
                payment system.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {capabilities.map((item, index) => {
                const Icon = item.icon

                return (
                  <motion.article
                    key={item.title}
                    className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/25"
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{
                      duration: 0.45,
                      delay: index * 0.06,
                    }}
                  >
                    <div className="flex size-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                      <Icon size={18} />
                    </div>

                    <h3 className="mt-5 text-base font-semibold">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {item.text}
                    </p>
                  </motion.article>
                )
              })}
            </div>
          </div>
        </section>

        {/* API surface */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                API surface
              </span>

              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Programmatic access to recovery intelligence.
              </h2>

              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Recovery cases, analytics, policy checks, agent execution, and
                operational actions are exposed through the backend services
                powering Vidur AI.
              </p>

              <div className="mt-7 flex items-center gap-2 text-sm text-muted-foreground">
                <CircleDot size={15} className="text-primary" />
                Designed around explicit backend boundaries
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {apiAreas.map((item, index) => (
                <motion.div
                  key={item.path}
                  className="border-b border-border p-5 last:border-b-0 sm:p-6"
                  initial={{ opacity: 0, x: 15 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.4,
                    delay: index * 0.06,
                  }}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-md bg-primary/10 px-2 py-1 font-mono text-[11px] font-semibold text-primary">
                      {item.method}
                    </span>

                    <code className="text-sm text-foreground">
                      {item.path}
                    </code>
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section className="border-t border-border bg-secondary/20">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Architecture
              </span>

              <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Every recovery decision has a traceable path.
              </h2>
            </div>

            <div className="mt-14 flex flex-wrap items-center justify-center gap-2">
              {architecture.map((item, index) => (
                <div key={item} className="flex items-center gap-2">
                  <motion.div
                    className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium shadow-sm"
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.4,
                      delay: index * 0.06,
                    }}
                  >
                    {item}
                  </motion.div>

                  {index < architecture.length - 1 && (
                    <ArrowRight
                      size={15}
                      className="text-muted-foreground/50"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-primary/[0.045] px-6 py-16 text-center sm:px-12">
            <div className="pointer-events-none absolute left-1/2 top-0 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />

            <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">
              Build on top of intelligent recovery.
            </h2>

            <p className="relative mx-auto mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
              Create a Vidur AI workspace and explore the recovery system
              from the inside.
            </p>

            <Button
              size="lg"
              className="relative mt-8 h-11 px-6"
              onClick={() => navigate('/signup')}
            >
              Get started
              <ArrowRight size={16} />
            </Button>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}