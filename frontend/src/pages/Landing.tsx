import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  Check,
  CircleDollarSign,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { HeroRecoveryCard } from "../components/landing/HeroRecoveryCard";
import { LandingFooter } from "../components/landing/LandingFooter";
import { LandingNavbar } from "../components/landing/LandingNavbar";
import { ProductPreview } from "../components/landing/ProductPreview";

const traditionalSteps = ["Fixed retry rules", "Repeated attempts"];

const vidurSteps = [
  "Detect",
  "Diagnose",
  "Predict",
  "Decide",
  "Policy-check",
  "Orchestrate",
  "Learn",
];

const workflow = [
  {
    number: "01",
    title: "Detect",
    description: "Identify failed or at-risk payments.",
    icon: CircleDollarSign,
  },
  {
    number: "02",
    title: "Diagnose",
    description: "Understand failure reason and relevant payment/customer context.",
    icon: Search,
  },
  {
    number: "03",
    title: "Decide",
    description: "Determine recovery probability and the best next action.",
    icon: Bot,
  },
  {
    number: "04",
    title: "Orchestrate",
    description: "Execute the recovery action according to configured policies.",
    icon: ShieldCheck,
  },
  {
    number: "05",
    title: "Recover",
    description: "Measure the outcome and record the result.",
    icon: Zap,
  },
];

const intelligenceBlocks = [
  {
    icon: Activity,
    title: "Payment context",
    description: "Order, customer, and payment method history.",
  },
  {
    icon: Search,
    title: "Failure diagnosis",
    description: "The likely reason a payment failed.",
  },
  {
    icon: TrendingUp,
    title: "Recovery probability",
    description: "Estimated likelihood of recovering the payment.",
  },
  {
    icon: ShieldCheck,
    title: "Policy evaluation",
    description: "Whether the action is within configured limits.",
  },
  {
    icon: Target,
    title: "Action selection",
    description: "The recovery action Vidur AI chooses to take.",
  },
  {
    icon: Eye,
    title: "Outcome tracking",
    description: "What happened, recorded for every case.",
  },
];

const useCases = [
  {
    id: "failed-payments",
    icon: CircleDollarSign,
    title: "Failed Payments",
    description: "Recover transactions before they become lost revenue.",
  },
  {
    id: "subscriptions",
    icon: RefreshCw,
    title: "Subscriptions",
    description: "Reduce involuntary churn caused by recurring payment failures.",
  },
  {
    id: "payment-operations",
    icon: Activity,
    title: "Payment Operations",
    description: "Give teams visibility into recovery decisions and outcomes.",
  },
  {
    id: "revenue-leakage",
    icon: TrendingDown,
    title: "Revenue Leakage",
    description: "Prioritize recovery opportunities based on financial impact.",
  },
];

const whyVidur = [
  { icon: Activity, label: "Context-aware recovery" },
  { icon: Bot, label: "AI-driven decisions" },
  { icon: ShieldCheck, label: "Policy-controlled actions" },
  { icon: Zap, label: "Automated orchestration" },
  { icon: Eye, label: "Observable recovery outcomes" },
];

export function Landing() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] opacity-40 [background-image:radial-gradient(circle,color-mix(in_oklch,var(--foreground),transparent_82%)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,color-mix(in_oklch,var(--primary),transparent_82%),transparent)]" />

      {/* Navigation */}
      <LandingNavbar />

      {/* Hero */}
      <main className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <motion.div
            className="inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}>
            AI-Powered Revenue Recovery
          </motion.div>

          <motion.h1
            className="mt-6 font-heading text-[44px] font-medium leading-[1.04] tracking-[-0.02em] text-foreground sm:text-[56px] lg:text-[68px]"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}>
            <span className="bg-gradient-to-r from-sky-400 to-primary bg-clip-text text-transparent">
              Every failed payment
            </span>
            <span className="block text-foreground">deserves a decision.</span>
          </motion.h1>

          <motion.p
            className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}>
            Vidur AI turns payment failures into intelligent recovery
            workflows — diagnosing why payments fail, deciding what to do
            next, and orchestrating recovery automatically.
          </motion.p>

          <motion.div
            className="mt-9 flex flex-wrap items-center gap-5"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28 }}>
            <Button
              size="lg"
              className="h-11 px-6"
              onClick={() => navigate("/signup")}>
              Get started
              <ArrowRight size={17} />
            </Button>

            <a
              href="#workflow"
              className="text-sm font-medium text-foreground hover:text-primary">
              See how it works
            </a>
          </motion.div>

          <motion.div
            className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}>
            {["Risk aware", "Policy controlled", "Fully observable"].map(
              (item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <Check size={13} className="text-primary" />
                  {item}
                </span>
              ),
            )}
          </motion.div>
        </div>

        {/* Hero recovery decision visual */}
        <motion.div
          initial={{ opacity: 0, x: 45 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}>
          <HeroRecoveryCard />
        </motion.div>
      </main>

      {/* Product / value positioning */}
      <section id="platform" className="border-y border-border bg-secondary/20">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="max-w-lg">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Product
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              Not a retry system. A recovery decision engine.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Traditional recovery tools retry blindly. Vidur AI evaluates
              context and decides.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-background/60 p-6">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Traditional recovery
              </span>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {traditionalSteps.map((step, index) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground">
                      {step}
                    </span>
                    {index < traditionalSteps.length - 1 && (
                      <ArrowRight size={14} className="text-muted-foreground/50" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-6">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Vidur AI
              </span>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {vidurSteps.map((step, index) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className="rounded-full border border-primary/30 bg-card px-3 py-1.5 text-sm font-medium text-foreground">
                      {step}
                    </span>
                    {index < vidurSteps.length - 1 && (
                      <ArrowRight size={14} className="text-primary/50" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-lg">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            How it works
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            From payment failure to recovery outcome.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Vidur AI connects detection, diagnosis, decisioning,
            orchestration, and outcome tracking into one recovery loop.
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
              transition={{ duration: 0.5, delay: index * 0.06 }}>
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
      <section id="intelligence" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-2">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Recovery intelligence
              </span>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-foreground">
                Decisions backed by
                <span className="block text-muted-foreground">
                  context, not guesswork.
                </span>
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                A recovery case is more than a failed transaction. Vidur AI
                evaluates payment context, diagnoses the failure, estimates
                recovery probability, checks policy, selects an action, and
                tracks the outcome.
              </p>

              <Button
                variant="outline"
                className="mt-6"
                onClick={() => navigate("/signup")}>
                View live dashboard
                <ArrowRight size={15} />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {intelligenceBlocks.map((block) => (
                <div
                  key={block.title}
                  className="rounded-xl border border-border bg-card p-4.5"
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <block.icon size={16} />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">
                    {block.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {block.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="solutions" className="border-t border-border bg-secondary/20">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="max-w-lg">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Solutions
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              Built for where revenue leaks.
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {useCases.map((item, index) => (
              <motion.article
                key={item.title}
                id={item.id}
                className="rounded-xl border border-border bg-card p-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}>
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
        </div>
      </section>

      {/* Product preview */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-xl text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            Product preview
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            A window into the Vidur AI dashboard.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The same recovery intelligence merchants see inside the product
            — revenue at risk, recovery probability, and every decision in
            the timeline.
          </p>
        </div>

        <motion.div
          className="mt-10"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}>
          <ProductPreview />
        </motion.div>
      </section>

      {/* Why Vidur AI */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            Why Vidur AI
          </span>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground">
            Recovery shouldn't be a retry loop. It should be intelligent.
          </h2>

          <div className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-5">
            {whyVidur.map((item) => (
              <span
                key={item.label}
                className="flex items-center gap-2 text-sm font-medium text-foreground"
              >
                <item.icon size={16} className="text-primary" />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Integration / infrastructure */}
      <section className="border-t border-border bg-secondary/20">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            Infrastructure
          </span>
          <h2 className="mx-auto mt-3 max-w-xl text-2xl font-semibold tracking-tight text-foreground">
            Built on modern payment infrastructure.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Vidur AI's recovery actions run against Razorpay's payment APIs,
            designed to extend to additional payment infrastructure as
            recovery workflows mature.
          </p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground">
            <CircleDollarSign size={15} className="text-primary" />
            Razorpay
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-10 sm:p-14">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Don't let failed payments become lost revenue.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Start recovering intelligently.
          </p>

          <Button
            size="lg"
            className="mt-7"
            onClick={() => navigate("/signup")}>
            Get started
            <ArrowRight size={17} />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
