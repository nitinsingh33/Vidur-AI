import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const APP_NAME = 'Vidur AI'

const STATIC_TITLES: Array<[RegExp, string]> = [
  [/^\/product$/, 'Product'],
  [/^\/solutions$/, 'Solutions'],
  [/^\/how-it-works$/, 'How It Works'],
  [/^\/developers$/, 'Developers'],
  [/^\/pricing$/, 'Pricing'],
  [/^\/login$/, 'Log In'],
  [/^\/signup$/, 'Sign Up'],

  [/^\/dashboard$/, 'Dashboard'],
  [/^\/recovery-cases\/[^/]+$/, 'Recovery Case'],
  [/^\/recovery-cases$/, 'Recovery Cases'],
  [/^\/batches$/, 'Recovery Batches'],
  [/^\/checkout-dropoff$/, 'Checkout Drop-off'],
  [/^\/receivables$/, 'Receivables'],
  [/^\/promise-to-pay$/, 'Promise to Pay'],
  [/^\/subscriptions$/, 'Subscriptions'],
  [/^\/mandates$/, 'Mandates'],
  [/^\/agent-activity$/, 'Agent Activity'],
  [/^\/analytics$/, 'Analytics'],
  [/^\/policies$/, 'Policies'],
  [/^\/settings$/, 'Settings'],
  [/^\/demo-detection$/, 'Demo Detection'],
  [/^\/recovery-lab$/, 'Recovery Lab'],
]

function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function storeTitle(pathname: string): string | null {
  const match = pathname.match(/^\/store\/([^/]+)(\/.*)?$/)
  if (!match) return null

  const storeName = titleCaseSlug(match[1])
  const rest = match[2] ?? ''

  if (/^\/product\//.test(rest)) return `Product · ${storeName}`
  if (/^\/cart/.test(rest)) return `Cart · ${storeName}`
  if (/^\/checkout/.test(rest)) return `Checkout · ${storeName}`
  if (/^\/plus/.test(rest)) return `${storeName} Plus`
  return storeName
}

export function DocumentTitle() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (pathname === '/') {
      document.title = `${APP_NAME} — Revenue Recovery Infrastructure`
      return
    }

    const store = storeTitle(pathname)
    if (store) {
      document.title = `${store} · ${APP_NAME}`
      return
    }

    const match = STATIC_TITLES.find(([pattern]) => pattern.test(pathname))
    document.title = match ? `${match[1]} · ${APP_NAME}` : APP_NAME
  }, [pathname])

  return null
}
