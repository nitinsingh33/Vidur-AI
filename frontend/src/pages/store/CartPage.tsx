import { Link, useNavigate, useParams } from 'react-router-dom'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useCart } from '../../context/useCart'
import { formatAmount } from '../../lib/status'
import { Button } from '../../components/ui/button'

export function CartPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { lines, setQuantity, removeItem, totalAmount } = useCart()

  if (lines.length === 0) {
    return (
      <section className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Link to={`/store/${slug}`} className="text-sm font-medium text-primary hover:underline">
          Continue shopping
        </Link>
      </section>
    )
  }

  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.02em] text-foreground">
        Your cart
      </h1>

      <div className="flex flex-col gap-3">
        {lines.map((line) => (
          <div
            key={line.product.id}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-3"
          >
            <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
              {line.product.imageUrl && (
                <img
                  src={line.product.imageUrl}
                  alt={line.product.name}
                  className="size-full object-cover"
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {line.product.name}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatAmount(line.product.priceAmount, line.product.currency)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity(line.product.id, line.quantity - 1)}
                className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary"
              >
                <Minus size={13} />
              </button>
              <span className="w-6 text-center text-sm font-medium">{line.quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(line.product.id, line.quantity + 1)}
                className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary"
              >
                <Plus size={13} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => removeItem(line.product.id)}
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${line.product.name}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-lg font-semibold text-foreground">
          {formatAmount(totalAmount)}
        </span>
      </div>

      <Button
        className="mt-5 h-11 w-full"
        onClick={() => navigate(`/store/${slug}/checkout`)}
      >
        Proceed to checkout
      </Button>
    </section>
  )
}
