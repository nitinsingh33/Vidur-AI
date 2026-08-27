import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ShieldCheck, Target, TrendingUp } from 'lucide-react'

interface AuthLayoutProps {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

const features = [
  {
    icon: Target,
    title: 'Decide what to do',
    text: 'AI evaluates payment context and chooses the next-best recovery action.',
  },
  {
    icon: TrendingUp,
    title: 'Recover more revenue',
    text: 'Personalized interventions help recover payments without treating every failure the same.',
  },
  {
    icon: ShieldCheck,
    title: 'Stay in control',
    text: 'Policies define what Vidur can do, with every decision fully auditable.',
  },
]

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: AuthLayoutProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* ───────────────────────── Brand Panel ───────────────────────── */}
      <aside className="relative hidden w-[46%] overflow-hidden border-r border-border lg:flex lg:min-h-screen lg:flex-col">
        {/* Base background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.07] via-background to-background" />

        {/* ───────────────── Flowing ambient gradient ───────────────── */}
        {!shouldReduceMotion && (
          <>
            {/* Large diagonal blue ribbon */}
            <motion.div
              className="pointer-events-none absolute -left-[30%] -top-[25%] h-[115%] w-[58%] rotate-[18deg] rounded-full bg-primary/[0.11] blur-[85px]"
              animate={{
                x: ['-8%', '18%', '-8%'],
                y: ['-3%', '8%', '-3%'],
                rotate: [18, 22, 18],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Soft cyan/blue middle flow */}
            <motion.div
              className="pointer-events-none absolute -right-[35%] -top-[10%] h-[120%] w-[62%] -rotate-[22deg] rounded-full bg-sky-400/[0.07] blur-[100px]"
              animate={{
                x: ['8%', '-12%', '8%'],
                y: ['-5%', '12%', '-5%'],
                rotate: [-22, -17, -22],
              }}
              transition={{
                duration: 24,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Bottom blue glow */}
            <motion.div
              className="pointer-events-none absolute -bottom-[35%] left-[15%] h-[55%] w-[75%] rounded-full bg-primary/[0.09] blur-[110px]"
              animate={{
                x: ['-4%', '8%', '-4%'],
                y: ['4%', '-5%', '4%'],
                scale: [1, 1.08, 1],
              }}
              transition={{
                duration: 18,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Fine highlight passing through the background */}
            <motion.div
              className="pointer-events-none absolute -left-[20%] top-[5%] h-[18%] w-[145%] rotate-[24deg] bg-gradient-to-r from-transparent via-primary/[0.055] to-transparent blur-[35px]"
              animate={{
                x: ['-15%', '25%', '-15%'],
              }}
              transition={{
                duration: 16,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </>
        )}

        {/* Static fallback / ambient glow for reduced motion */}
        {shouldReduceMotion && (
          <>
            <div className="pointer-events-none absolute -left-32 -top-32 h-[440px] w-[440px] rounded-full bg-primary/[0.10] blur-[140px]" />
            <div className="pointer-events-none absolute -bottom-40 right-[-80px] h-[500px] w-[500px] rounded-full bg-primary/[0.07] blur-[150px]" />
          </>
        )}

        {/* Logo */}
        <div className="relative z-10 px-10 pt-10 xl:px-12 xl:pt-12">
          <Link
            to="/"
            aria-label="Vidur AI home"
            className="inline-flex items-center"
          >
            <img
              src="/brand.png"
              alt="Vidur AI"
              className="h-10 w-auto"
            />
          </Link>
        </div>

        {/* Main brand content */}
        <div className="relative z-10 flex flex-1 items-center px-10 xl:px-12">
          <motion.div
            className="w-full max-w-[570px] -translate-y-3"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
          >
            {/* Headline */}
            <h1 className="max-w-[520px] text-[36px] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground xl:text-[42px]">
              Turn failed payments
              <br />
              <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                into recovered revenue.
              </span>
            </h1>

            {/* Supporting statement */}
            <p className="mt-5 max-w-[500px] text-[15px] leading-6 text-muted-foreground">
              Vidur AI analyzes every failed payment, decides the right
              recovery action, and learns what works.
            </p>

            {/* Feature list */}
            <div className="mt-9 space-y-3">
              {features.map((feature, index) => {
                const Icon = feature.icon

                return (
                  <motion.div
                    key={feature.title}
                    className="group flex items-start gap-4 rounded-xl border border-border/40 bg-background/25 px-4 py-3.5 backdrop-blur-[2px] transition-all duration-200 hover:border-primary/20 hover:bg-primary/[0.025]"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.4,
                      delay: 0.15 + index * 0.08,
                    }}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
                      <Icon size={17} strokeWidth={1.9} />
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold leading-5 text-foreground">
                        {feature.title}
                      </h3>

                      <p className="mt-1 max-w-[450px] text-[13px] leading-5 text-muted-foreground">
                        {feature.text}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="relative z-10 px-10 pb-9 xl:px-12 xl:pb-10">
          <p className="text-xs text-muted-foreground/80">
            © 2026 Vidur AI
          </p>
        </div>
      </aside>

      {/* ───────────────────────── Auth Panel ───────────────────────── */}
      <main className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden">
        {/* Very subtle auth-side ambient glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/[0.025] blur-[100px]" />

        <motion.div
          className="relative z-10 w-full max-w-[430px] px-5 py-10 sm:px-8 sm:py-12 lg:px-10 lg:py-14"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          {/* Mobile logo */}
          <Link
            to="/"
            aria-label="Vidur AI home"
            className="mb-10 inline-flex lg:hidden"
          >
            <img
              src="/brand_logo.png"
              alt="Vidur AI"
              className="h-9 w-auto"
            />
          </Link>

          {/* Heading */}
          <header>
            <h2 className="text-[26px] font-semibold leading-8 tracking-[-0.025em] text-foreground">
              {title}
            </h2>

            <p className="mt-2.5 max-w-[390px] text-[15px] leading-6 text-muted-foreground">
              {description}
            </p>
          </header>

          {/* Form */}
          <div className="mt-9">
            {children}
          </div>

          {/* Footer */}
          <div className="mt-8 text-sm leading-5 text-muted-foreground">
            {footer}
          </div>
        </motion.div>
      </main>
    </div>
  )
}