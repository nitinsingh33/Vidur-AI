import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  getStorefrontProduct,
  type StorefrontProduct,
} from '../../api/storefront'
import { useCart } from '../../context/useCart'
import { formatAmount } from '../../lib/status'
import { Button } from '../../components/ui/button'

export function ProductDetail() {
  const { slug, productId } = useParams<{ slug: string; productId: string }>()
  const navigate = useNavigate()
  const { addItem } = useCart()

  const [product, setProduct] = useState<StorefrontProduct | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (!slug || !productId) return

    let cancelled = false

    getStorefrontProduct(slug, productId)
      .then((result) => {
        if (!cancelled) setProduct(result.product)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Product not found.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [slug, productId])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error ?? 'Product not found.'}
      </div>
    )
  }

  return (
    <section>
      <Link
        to={`/store/${slug}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Back to store
      </Link>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div className="aspect-[4/5] w-full overflow-hidden rounded-xl bg-secondary">
          {product.imageUrl && (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="size-full object-cover"
            />
          )}
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
            {product.name}
          </h1>
          <p className="mt-2 text-xl font-semibold text-foreground">
            {formatAmount(product.priceAmount, product.currency)}
          </p>
          {product.description && (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {product.description}
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <Button
              onClick={() => {
                addItem(product)
                setAdded(true)
              }}
              className="h-11 flex-1"
            >
              {added ? 'Added to cart' : 'Add to cart'}
            </Button>
            <Button
              variant="outline"
              className="h-11 flex-1"
              onClick={() => {
                addItem(product)
                navigate(`/store/${slug}/cart`)
              }}
            >
              Buy now
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
