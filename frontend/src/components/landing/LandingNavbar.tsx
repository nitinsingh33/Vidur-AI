import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Menu,
  Network,
  Receipt,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

type DropdownItem = {
  label: string
  href: string
  icon: typeof Zap
}

type NavLink = {
  label: string
  href?: string
  dropdown?: DropdownItem[]
}

const navLinks: NavLink[] = [
  {
    label: 'Product',
    dropdown: [
      {
        label: 'Recovery Engine',
        href: '/product#recovery-engine',
        icon: Zap,
      },
      {
        label: 'AI Decisioning',
        href: '/product#ai-decisioning',
        icon: Target,
      },
      {
        label: 'Recovery Orchestration',
        href: '/product#orchestration',
        icon: Network,
      },
      {
        label: 'Analytics & Observability',
        href: '/product#analytics',
        icon: BarChart3,
      },
    ],
  },
  {
    label: 'Solutions',
    dropdown: [
      {
        label: 'Failed Payments',
        href: '/solutions#failed-payments',
        icon: CreditCard,
      },
      {
        label: 'Subscriptions',
        href: '/solutions#subscriptions',
        icon: Receipt,
      },
      {
        label: 'Payment Operations',
        href: '/solutions#payment-operations',
        icon: CircleDollarSign,
      },
      {
        label: 'Revenue Leakage',
        href: '/solutions#revenue-leakage',
        icon: TrendingUp,
      },
    ],
  },
  {
    label: 'How it works',
    href: '/how-it-works',
  },
  {
    label: 'Developers',
    href: '/developers',
  },
  {
    label: 'Pricing',
    href: '/pricing',
  },
]

export function LandingNavbar() {
  const navigate = useNavigate()
  const location = useLocation()

  const [scrolled, setScrolled] = useState(false)
  const [hideNavbar, setHideNavbar] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  useEffect(() => {
    let lastScrollY = window.scrollY

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const delta = currentScrollY - lastScrollY

      setScrolled(currentScrollY > 8)

      // Always show navbar near the top
      if (currentScrollY <= 40) {
        setHideNavbar(false)
      }
      // Scroll down → hide
      else if (delta > 4 && currentScrollY > 100) {
        setHideNavbar(true)
      }
      // Scroll up → show
      else if (delta < -4) {
        setHideNavbar(false)
      }

      lastScrollY = currentScrollY
    }

    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    if (!mobileOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        setActiveDropdown(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileOpen])

  useEffect(() => {
    setMobileOpen(false)
    setActiveDropdown(null)
  }, [location.pathname])

  function closeMobileMenu() {
    setMobileOpen(false)
    setActiveDropdown(null)
  }

  function navigateTo(href: string) {
    closeMobileMenu()
    navigate(href)
  }

  function isActive(href?: string) {
    if (!href) return false

    const pathname = href.split('#')[0]

    if (pathname === '/') {
      return location.pathname === '/'
    }

    return location.pathname.startsWith(pathname)
  }

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6">
      <motion.div
        animate={{
          y: hideNavbar ? -120 : 0,
          opacity: hideNavbar ? 0 : 1,
        }}
        transition={{
          duration: 0.3,
          ease: 'easeInOut',
        }}
        className={cn(
          'relative mx-auto max-w-7xl rounded-full border transition-all duration-300',
          scrolled
            ? 'border-border/80 bg-background/90 shadow-lg shadow-foreground/[0.04] backdrop-blur-xl'
            : 'border-border/50 bg-background/80 backdrop-blur-md',
        )}
      >
        <nav className="flex items-center justify-between px-4 py-3 sm:px-5">
          {/* Logo */}
          <Link
            to="/"
            aria-label="Vidur AI home"
            className="flex shrink-0 items-center"
          >
            <img
              src="/brand.png"
              alt="Vidur AI"
              className="h-10 w-auto sm:h-11"
            />
          </Link>

          {/* Desktop navigation */}
          <div className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => {
              const hasDropdown = Boolean(link.dropdown?.length)
              const active = isActive(link.href)

              return (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => {
                    if (hasDropdown) {
                      setActiveDropdown(link.label)
                    }
                  }}
                  onMouseLeave={() => {
                    if (hasDropdown) {
                      setActiveDropdown(null)
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (link.href) {
                        navigate(link.href)
                      } else {
                        setActiveDropdown((current) =>
                          current === link.label ? null : link.label,
                        )
                      }
                    }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-4 py-2 text-[15px] font-medium transition-colors',
                      active || activeDropdown === link.label
                        ? 'text-primary'
                        : 'text-foreground hover:text-primary',
                    )}
                    aria-haspopup={hasDropdown ? 'menu' : undefined}
                    aria-expanded={
                      hasDropdown
                        ? activeDropdown === link.label
                        : undefined
                    }
                  >
                    {link.label}

                    {hasDropdown && (
                      <ChevronDown
                        size={14}
                        strokeWidth={1.8}
                        className={cn(
                          'transition-transform duration-200',
                          activeDropdown === link.label && 'rotate-180',
                        )}
                      />
                    )}
                  </button>

                  {/* Dropdown */}
                  <AnimatePresence>
                    {hasDropdown && activeDropdown === link.label && (
                      <motion.div
                        initial={{
                          opacity: 0,
                          y: 8,
                          scale: 0.98,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          scale: 1,
                        }}
                        exit={{
                          opacity: 0,
                          y: 8,
                          scale: 0.98,
                        }}
                        transition={{
                          duration: 0.16,
                          ease: 'easeOut',
                        }}
                        className="absolute left-1/2 top-full mt-3 w-[285px] -translate-x-1/2 rounded-2xl border border-border/80 bg-background/95 p-2 shadow-xl shadow-foreground/[0.06] backdrop-blur-xl"
                        role="menu"
                      >
                        <div className="space-y-0.5">
                          {link.dropdown?.map((item) => {
                            const Icon = item.icon

                            return (
                              <button
                                key={item.href}
                                type="button"
                                role="menuitem"
                                onClick={() => navigateTo(item.href)}
                                className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-secondary"
                              >
                                <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors group-hover:text-primary">
                                  <Icon
                                    size={18}
                                    strokeWidth={1.7}
                                  />
                                </span>

                                <span className="text-[14px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                                  {item.label}
                                </span>
                              </button>
                            )
                          })}
                        </div>

                        <div className="mt-1 border-t border-border/70 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              navigateTo(
                                link.label === 'Product'
                                  ? '/product'
                                  : '/solutions',
                              )
                            }
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary/5"
                          >
                            <span>
                              Explore {link.label.toLowerCase()}
                            </span>

                            <ArrowRight
                              size={14}
                              strokeWidth={1.8}
                            />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>

          {/* Desktop actions */}
          <div className="hidden items-center gap-2 lg:flex">
            <Button
              variant="ghost"
              className="rounded-full px-4 text-[15px] font-medium"
              onClick={() => navigate('/login')}
            >
              Sign in
            </Button>

            <Button
              size="lg"
              className="h-10 rounded-full px-5 text-[15px] font-semibold shadow-sm"
              onClick={() => navigate('/signup')}
            >
              Get started
              <ArrowRight size={15} strokeWidth={1.8} />
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="landing-mobile-nav"
            onClick={() => setMobileOpen((open) => !open)}
            className="flex size-10 items-center justify-center rounded-full border border-border/70 text-foreground transition-colors hover:bg-secondary lg:hidden"
          >
            {mobileOpen ? (
              <X size={19} strokeWidth={1.8} />
            ) : (
              <Menu size={19} strokeWidth={1.8} />
            )}
          </button>

          {/* Mobile navigation */}
          <AnimatePresence>
            {mobileOpen && (
              <>
                <motion.div
                  className="fixed inset-0 z-40 bg-foreground/10 backdrop-blur-[2px] lg:hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={closeMobileMenu}
                  aria-hidden="true"
                />

                <motion.div
                  id="landing-mobile-nav"
                  className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-border/80 bg-background/95 shadow-xl shadow-foreground/[0.08] backdrop-blur-xl lg:hidden"
                  initial={{
                    opacity: 0,
                    y: -8,
                    scale: 0.98,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    y: -8,
                    scale: 0.98,
                  }}
                  transition={{ duration: 0.18 }}
                >
                  <nav
                    aria-label="Mobile navigation"
                    className="p-3"
                  >
                    {navLinks.map((link) => {
                      const hasDropdown = Boolean(link.dropdown?.length)
                      const expanded =
                        activeDropdown === link.label

                      if (!hasDropdown) {
                        return (
                          <button
                            key={link.label}
                            type="button"
                            onClick={() => navigateTo(link.href!)}
                            className={cn(
                              'flex w-full items-center rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors',
                              isActive(link.href)
                                ? 'bg-primary/10 text-primary'
                                : 'text-foreground hover:bg-secondary',
                            )}
                          >
                            {link.label}
                          </button>
                        )
                      }

                      return (
                        <div key={link.label}>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveDropdown(
                                expanded ? null : link.label,
                              )
                            }
                            className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-secondary"
                            aria-expanded={expanded}
                          >
                            {link.label}

                            <ChevronDown
                              size={16}
                              strokeWidth={1.8}
                              className={cn(
                                'transition-transform duration-200',
                                expanded && 'rotate-180',
                              )}
                            />
                          </button>

                          <AnimatePresence initial={false}>
                            {expanded && (
                              <motion.div
                                initial={{
                                  height: 0,
                                  opacity: 0,
                                }}
                                animate={{
                                  height: 'auto',
                                  opacity: 1,
                                }}
                                exit={{
                                  height: 0,
                                  opacity: 0,
                                }}
                                className="overflow-hidden"
                              >
                                <div className="ml-2 space-y-0.5 border-l border-border pl-2">
                                  {link.dropdown?.map((item) => {
                                    const Icon = item.icon

                                    return (
                                      <button
                                        key={item.href}
                                        type="button"
                                        onClick={() =>
                                          navigateTo(item.href)
                                        }
                                        className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
                                      >
                                        <Icon
                                          size={16}
                                          strokeWidth={1.7}
                                          className="shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                                        />

                                        <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                                          {item.label}
                                        </span>
                                      </button>
                                    )
                                  })}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigateTo(
                                        link.label === 'Product'
                                          ? '/product'
                                          : '/solutions',
                                      )
                                    }
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-primary"
                                  >
                                    Explore all
                                    <ArrowRight
                                      size={14}
                                      strokeWidth={1.8}
                                    />
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}

                    {/* Mobile actions */}
                    <div className="mt-3 grid gap-2 border-t border-border pt-3">
                      <Button
                        variant="outline"
                        className="w-full rounded-xl"
                        onClick={() => navigateTo('/login')}
                      >
                        Sign in
                      </Button>

                      <Button
                        className="w-full rounded-xl"
                        onClick={() => navigateTo('/signup')}
                      >
                        Get started
                        <ArrowRight
                          size={15}
                          strokeWidth={1.8}
                        />
                      </Button>
                    </div>
                  </nav>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </nav>
      </motion.div>
    </header>
  )
}
