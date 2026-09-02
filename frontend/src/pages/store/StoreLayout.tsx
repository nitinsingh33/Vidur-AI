import { Link, Outlet, useParams } from 'react-router-dom'
import { ShoppingBag, Sparkles } from 'lucide-react'
import { CartProvider } from '../../context/CartContext'
import { useCart } from '../../context/useCart'

function StoreHeader({ slug }: { slug: string }) {
  const { totalItems } = useCart()

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          to={`/store/${slug}`}
          className="text-lg font-semibold tracking-[-0.02em] text-foreground"
        >
          FashionKart
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to={`/store/${slug}/plus`}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/60"
          >
            <Sparkles size={16} />
            FashionKart Plus
          </Link>

          <Link
            to={`/store/${slug}/cart`}
            className="relative inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/60"
          >
            <ShoppingBag size={16} />
            Cart
            {totalItems > 0 && (
              <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {totalItems}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}

export function StoreLayout() {
  const { slug } = useParams<{ slug: string }>()

  if (!slug) return null

  return (
    <CartProvider slug={slug}>
      <div className="min-h-screen bg-background">
        <StoreHeader slug={slug} />
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          <Outlet />
        </main>
        <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
          Powered by Vidur AI · Razorpay Test Mode — no real money is charged.
        </footer>
      </div>
    </CartProvider>
  )
}
