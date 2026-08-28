import { motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  CircleHelp,
  Gauge,
  Layers3,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { LandingNavbar } from '../components/landing/LandingNavbar'
import { LandingFooter } from '../components/landing/LandingFooter'

const principles = [
  {
    icon: Gauge,
    title: 'Based on recovery volume',
    text: 'Pricing should scale with the amount of payment recovery your system processes.',
  },
  {
    icon: Layers3,
    title: 'Built around your workflow',
    text: 'Recovery cases, batch orchestration, policy controls, and operational requirements can vary by business.',
  },
  {
    icon: ShieldCheck,
    title: 'Controlled automation',
    text: 'Policy boundaries remain part of the recovery workflow rather than becoming an optional add-on.',
  },
]

const included = [
  'Recovery case intelligence',
  'Failure diagnosis',
  'Recovery probability scoring',
  'Agent-driven intervention selection',
  'Policy-controlled actions',
  'Recovery outcome tracking',
  'Batch recovery orchestration',
  'Operational analytics',
  'Audit visibility',
]

export function Pricing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <LandingNavbar />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_60%_55%_at_50%_-10%,color-mix(in_oklch,var(--primary),transparent_82%),transparent)]" />

          <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 text-center sm:pt-28 lg:pb-24">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              <div className="invisible mx-auto inline-flex items-center gap-2 px-3 py-1.5 text-xs">
                <Sparkles size={14} />
                Pricing
              </div>

              <h1 className="mx-auto mt-7 max-w-4xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-[68px]">
                Pricing that scales with
                <span className="block bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
                  the revenue you recover.
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Revenue recovery is different for every payment operation.
                Vidur AI is designed around recovery volume, workflow
                complexity, and the level of automation your business needs.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Main pricing card */}
        <section className="mx-auto max-w-5xl px-6 pb-24">
          <motion.div
            className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_30px_100px_-55px_color-mix(in_oklch,var(--foreground),transparent_65%)]"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
          >
            <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
              <div className="relative overflow-hidden bg-foreground p-8 text-background sm:p-10 lg:p-12">
                <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/30 blur-3xl" />

                <div className="relative">
                  <span className="text-xs font-semibold uppercase tracking-wider text-background/55">
                    Vidur AI
                  </span>

                  <h2 className="mt-5 text-3xl font-semibold tracking-tight">
                    Recovery intelligence
                  </h2>

                  <p className="mt-4 text-sm leading-6 text-background/65">
                    A recovery platform designed to make every intervention
                    measurable, policy-aware, and connected to revenue
                    outcomes.
                  </p>

                  <div className="mt-10 border-t border-background/10 pt-7">
                    <div className="text-sm text-background/55">
                      Commercial model
                    </div>

                    <div className="mt-2 text-2xl font-semibold">
                      Usage-based
                    </div>

                    <p className="mt-2 text-sm leading-6 text-background/55">
                      Final pricing can be aligned with recovery volume and
                      operational requirements.
                    </p>
                  </div>

                  <Button
                    size="lg"
                    className="mt-8 h-11 bg-background px-6 text-foreground hover:bg-background/90"
                    onClick={() => navigate('/signup')}
                  >
                    Get started
                    <ArrowRight size={16} />
                  </Button>
                </div>
              </div>

              <div className="p-8 sm:p-10 lg:p-12">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck size={19} />
                  </div>

                  <div>
                    <h3 className="font-semibold">
                      Recovery platform capabilities
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Included in the core product
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {included.map((item, index) => (
                    <motion.div
                      key={item}
                      className="flex items-start gap-3"
                      initial={{ opacity: 0, x: 8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.35,
                        delay: index * 0.04,
                      }}
                    >
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Check size={12} strokeWidth={2.5} />
                      </span>

                      <span className="text-sm leading-5 text-muted-foreground">
                        {item}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Principles */}
        <section className="border-y border-border bg-secondary/20">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="max-w-xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                What determines cost
              </span>

              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Pay for the recovery system you actually need.
              </h2>

              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                The goal is simple: align platform cost with the scale and
                complexity of the revenue recovery problem.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {principles.map((item, index) => {
                const Icon = item.icon

                return (
                  <motion.article
                    key={item.title}
                    className="rounded-2xl border border-border bg-card p-6"
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{
                      duration: 0.45,
                      delay: index * 0.07,
                    }}
                  >
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
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

        {/* FAQ-ish section */}
        <section className="mx-auto max-w-4xl px-6 py-24">
          <div className="text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CircleHelp size={18} />
            </div>

            <h2 className="mt-5 text-3xl font-semibold tracking-tight">
              A recovery platform should earn its place.
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              The value of Vidur AI is measured by what happens after a
              payment fails: the decision made, the action taken, and the
              revenue actually recovered.
            </p>
          </div>

          <div className="mt-12 divide-y divide-border rounded-2xl border border-border bg-card">
            <div className="p-6">
              <h3 className="text-sm font-semibold">
                Is pricing based on the number of users?
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The product is fundamentally a revenue-recovery system, so
                recovery volume and workflow requirements are more meaningful
                than simply counting dashboard users.
              </p>
            </div>

            <div className="p-6">
              <h3 className="text-sm font-semibold">
                Can recovery actions be controlled?
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Yes. Recovery actions pass through policy controls before
                execution, allowing the automation boundary to be explicitly
                defined.
              </p>
            </div>

            <div className="p-6">
              <h3 className="text-sm font-semibold">
                Can I see what the agent did?
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Yes. Recovery cases and operational analytics provide
                visibility into decisions, actions, and outcomes.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="rounded-3xl border border-border bg-card px-6 py-16 text-center sm:px-12">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to see what Vidur can recover?
            </h2>

            <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
              Create a workspace and explore the recovery system with your
              payment data and policies.
            </p>

            <Button
              size="lg"
              className="mt-8 h-11 px-6"
              onClick={() => navigate('/signup')}
            >
              Create your workspace
              <ArrowRight size={16} />
            </Button>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}