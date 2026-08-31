import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { getStorefront, type StorefrontResponse } from '../../api/storefront'
import { formatAmount } from '../../lib/status'

export function StoreHome() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<StorefrontResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return

    let cancelled = false

    getStorefront(slug)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load store.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error ?? 'Store not found.'}
      </div>
    )
  }

  return (
    <section>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
          {data.merchant.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real Razorpay Test Mode checkout — recovered automatically by Vidur AI if a payment fails.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {data.products.map((product) => (
          <Link
            key={product.id}
            to={`/store/${slug}/product/${product.id}`}
            className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
          >
            <div className="aspect-[4/5] w-full overflow-hidden bg-secondary">
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-3">
              <h2 className="text-sm font-medium text-foreground">{product.name}</h2>
              <p className="mt-auto text-sm font-semibold text-foreground">
                {formatAmount(product.priceAmount, product.currency)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
