import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CartContext,
  type CartContextValue,
  type CartLine,
} from './cartContextObject'

function storageKey(slug: string) {
  return `vidur_storefront_cart_${slug}`
}

export function CartProvider({
  slug,
  children,
}: {
  slug: string
  children: ReactNode
}) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey(slug))
      return raw ? (JSON.parse(raw) as CartLine[]) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(slug), JSON.stringify(lines))
    } catch {
      // Best-effort only — a shopper without storage access just loses
      // cart persistence across reloads, nothing else breaks.
    }
  }, [slug, lines])

  const value = useMemo<CartContextValue>(() => {
    const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0)
    const totalAmount = lines.reduce(
      (sum, line) => sum + Number(line.product.priceAmount) * line.quantity,
      0,
    )

    return {
      lines,
      totalItems,
      totalAmount,
      addItem: (product, quantity = 1) => {
        setLines((current) => {
          const existing = current.find((line) => line.product.id === product.id)
          if (existing) {
            return current.map((line) =>
              line.product.id === product.id
                ? { ...line, quantity: line.quantity + quantity }
                : line,
            )
          }
          return [...current, { product, quantity }]
        })
      },
      removeItem: (productId) => {
        setLines((current) => current.filter((line) => line.product.id !== productId))
      },
      setQuantity: (productId, quantity) => {
        setLines((current) =>
          quantity <= 0
            ? current.filter((line) => line.product.id !== productId)
            : current.map((line) =>
                line.product.id === productId ? { ...line, quantity } : line,
              ),
        )
      },
      clear: () => setLines([]),
    }
  }, [lines])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
