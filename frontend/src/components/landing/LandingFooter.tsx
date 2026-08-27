import { motion } from 'framer-motion'
import {
  ArrowUpRight,
  GitBranch,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

const productLinks = [
  { label: 'Product', route: '/product' },
  { label: 'Solutions', route: '/solutions' },
  { label: 'How it works', route: '/how-it-works' },
]

const resourceLinks = [
  { label: 'Developers', route: '/developers' },
  { label: 'Pricing', route: '/pricing' },
]

const accountLinks = [
  { label: 'Sign in', route: '/login' },
  { label: 'Get started', route: '/signup' },
]

function FooterHeading({ children }: { children: string }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </div>
  )
}

function FooterLink({
  label,
  route,
}: {
  label: string
  route: string
}) {
  return (
    <li>
      <Link
        to={route}
        className="group inline-flex items-center text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
      >
        <span>{label}</span>

        <ArrowUpRight
          size={13}
          className="ml-1 -translate-x-0.5 translate-y-0.5 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-60"
        />
      </Link>
    </li>
  )
}

export function LandingFooter() {
  const navigate = useNavigate()

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        {/* Main footer */}
        <div className="grid gap-12 lg:grid-cols-[1.7fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <Link
              to="/"
              aria-label="Vidur AI home"
              className="inline-flex items-center"
            >
              <img
                src="/brand.png"
                alt="Vidur AI"
                className="h-9 w-auto"
              />
            </Link>

            <p className="mt-5 max-w-[280px] text-sm leading-6 text-muted-foreground">
              Intelligent revenue recovery for modern payment systems.
            </p>

            <motion.button
              type="button"
              onClick={() => navigate('/signup')}
              className="group mt-7 inline-flex items-center gap-2 text-sm font-medium text-foreground"
              whileHover={{ x: 3 }}
              transition={{ duration: 0.2 }}
            >
              Start recovering
              <ArrowUpRight
                size={15}
                className="text-primary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </motion.button>
          </div>

          {/* Product */}
          <div>
            <FooterHeading>Product</FooterHeading>

            <ul className="mt-5 space-y-3">
              {productLinks.map((link) => (
                <FooterLink
                  key={link.route}
                  label={link.label}
                  route={link.route}
                />
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <FooterHeading>Resources</FooterHeading>

            <ul className="mt-5 space-y-3">
              {resourceLinks.map((link) => (
                <FooterLink
                  key={link.route}
                  label={link.label}
                  route={link.route}
                />
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <FooterHeading>Account</FooterHeading>

            <ul className="mt-5 space-y-3">
              {accountLinks.map((link) => (
                <FooterLink
                  key={link.route}
                  label={link.label}
                  route={link.route}
                />
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-16 flex flex-col gap-5 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              © 2026 Vidur AI. All rights reserved.
            </span>

            <span className="text-xs text-muted-foreground/60">
              Revenue recovery infrastructure.
            </span>
          </div>

          <a
            href="https://github.com/nitinsingh33/RecoverAI-Agentic_Revenue_Recovery_Orchestrator"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Vidur AI on GitHub"
            className="group inline-flex w-fit items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <GitBranch
              size={15}
              className="transition-transform duration-200 group-hover:-translate-y-0.5"
            />
            GitHub
            <ArrowUpRight
              size={12}
              className="opacity-50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        </div>
      </div>
    </footer>
  )
}