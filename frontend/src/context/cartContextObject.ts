import { createContext } from 'react'
import type { StorefrontProduct } from '../api/storefront'

export interface CartLine {
  product: StorefrontProduct
  quantity: number
}

export interface CartContextValue {
  lines: CartLine[]
  addItem: (product: StorefrontProduct, quantity?: number) => void
  removeItem: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  clear: () => void
  totalItems: number
  totalAmount: number
}

export const CartContext = createContext<CartContextValue | null>(null)
