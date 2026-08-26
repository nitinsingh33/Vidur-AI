import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Menu, X } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

const navLinks = [
  { label: 'Product', href: '#platform' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'How it works', href: '#workflow' },
]

export function LandingNavbar() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 8)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen])

  function closeMobileMenu() {
    setMobileOpen(false)
  }

  return (
    <div
      className={cn(
        'sticky top-0 z-40 transition-colors duration-200',
        scrolled
          ? 'border-b border-border bg-background/95'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <a href="/" aria-label="Vidur AI home" className="flex items-center">
          <img src="/brand.png" alt="Vidur AI" className="h-11 w-auto shrink-0" />
        </a>

        <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" onClick={() => navigate('/login')}>
            Sign in
          </Button>
          <Button onClick={() => navigate('/signup')}>
            Get started
            <ArrowRight size={15} />
          </Button>
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="landing-mobile-nav"
          onClick={() => setMobileOpen((open) => !open)}
          className="flex size-9 items-center justify-center rounded-lg text-foreground md:hidden"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 top-[84px] z-30 bg-foreground/10 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={closeMobileMenu}
              aria-hidden="true"
            />

            <motion.div
              id="landing-mobile-nav"
              className="absolute inset-x-0 top-full z-30 border-b border-border bg-background md:hidden"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <nav
                aria-label="Mobile"
                className="flex flex-col gap-1 px-6 py-4"
              >
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={closeMobileMenu}
                    className="rounded-lg px-2 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
                  >
                    {link.label}
                  </a>
                ))}

                <div className="mt-2 flex flex-col gap-2 border-t border-border pt-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      closeMobileMenu()
                      navigate('/login')
                    }}
                  >
                    Sign in
                  </Button>
                  <Button
                    className="w-full"
                    onClick={() => {
                      closeMobileMenu()
                      navigate('/signup')
                    }}
                  >
                    Get started
                    <ArrowRight size={15} />
                  </Button>
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
