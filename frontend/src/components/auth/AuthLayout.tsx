import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Bot, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden border-r border-border bg-gradient-to-br from-primary/15 via-background to-background p-12 lg:flex">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/25 blur-[110px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-primary/10 blur-[130px]" />

        <Link
          to="/"
          className="relative z-10 flex items-center"
        >
          <img
            src="/brand_logo.png"
            alt="Vidur AI"
            className="h-10 w-auto shrink-0"
          />
        </Link>

        <motion.div
          className="relative z-10 space-y-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight text-foreground">
            Every failed payment deserves a decision.
          </h1>

          <div className="space-y-4">
            {[
              {
                icon: Bot,
                title: 'Agentic decisions',
                text: 'Vidur evaluates risk and selects the intervention automatically.',
              },
              {
                icon: ShieldCheck,
                title: 'Policy controlled',
                text: 'Every recovery action is checked against your policy boundaries.',
              },
              {
                icon: Sparkles,
                title: 'Fully observable',
                text: 'A complete audit trail for every decision the agent makes.',
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <item.icon size={16} />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {item.title}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {item.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="relative z-10 text-xs text-muted-foreground">
          © 2026 Vidur AI — Revenue recovery infrastructure
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <Link
            to="/"
            className="mb-8 flex items-center lg:hidden"
          >
            <img
              src="/brand_logo.png"
              alt="Vidur AI"
              className="h-9 w-auto shrink-0"
            />
          </Link>

          <h2 className="text-xl font-semibold text-foreground">
            {title}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {description}
          </p>

          <div className="mt-8">{children}</div>

          <div className="mt-6 text-sm text-muted-foreground">
            {footer}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
