import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'

type ProductLink =
  | { kind: 'anchor'; label: string; href: string }
  | { kind: 'route'; label: string; route: string }

const productLinks: ProductLink[] = [
  { kind: 'anchor', label: 'Revenue Recovery', href: '#platform' },
  { kind: 'anchor', label: 'AI Recovery', href: '#intelligence' },
  { kind: 'route', label: 'Recovery Cases', route: '/recovery-cases' },
  { kind: 'route', label: 'Analytics', route: '/analytics' },
]

const solutionLinks = [
  { label: 'Failed Payments', href: '#failed-payments' },
  { label: 'Subscriptions', href: '#subscriptions' },
  { label: 'Revenue Leakage', href: '#revenue-leakage' },
  { label: 'Payment Operations', href: '#payment-operations' },
]

function FooterHeading({ children }: { children: string }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  )
}

export function LandingFooter() {
  const navigate = useNavigate()

  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <img
              src="/brand.png"
              alt="Vidur AI"
              className="h-8 w-auto shrink-0"
            />
            <p className="mt-4 max-w-[240px] text-sm leading-relaxed text-muted-foreground">
              Intelligent revenue recovery for modern payment systems.
            </p>
          </div>

          <div>
            <FooterHeading>Product</FooterHeading>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {productLinks.map((link) => {
                if (link.kind === 'anchor') {
                  return (
                    <li key={link.label}>
                      <a href={link.href} className="hover:text-foreground">
                        {link.label}
                      </a>
                    </li>
                  )
                }

                return (
                  <li key={link.label}>
                    <button
                      type="button"
                      onClick={() => navigate(link.route)}
                      className="hover:text-foreground"
                    >
                      {link.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <FooterHeading>Solutions</FooterHeading>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {solutionLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="hover:text-foreground">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <FooterHeading>Account</FooterHeading>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="hover:text-foreground"
                >
                  Sign in
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/signup')}
                  className="hover:text-foreground"
                >
                  Get started
                </button>
              </li>
            </ul>
          </div>

          <div>
            <FooterHeading>Connect</FooterHeading>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://github.com/nitinsingh33/RecoverAI-Agentic_Revenue_Recovery_Orchestrator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  GitHub
                  <ExternalLink size={13} />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-center sm:flex-row sm:text-left">
          <span className="text-xs text-muted-foreground">
            © 2026 Vidur AI. All rights reserved.
          </span>
          <span className="text-xs text-muted-foreground">
            Built for the Razorpay Buildathon.
          </span>
        </div>
      </div>
    </footer>
  )
}
