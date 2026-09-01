import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface DeleteButtonProps {
  onConfirm: () => Promise<void>
  label?: string
  confirmLabel?: string
  className?: string
  size?: 'sm' | 'default'
  /** Stops the click from also triggering a parent row's onClick (e.g. a table row that navigates on click). */
  stopPropagation?: boolean
}

/**
 * A genuinely solid red delete action (not the app's translucent
 * `destructive` button variant) — the merchant asked specifically for a
 * button that reads as unambiguously destructive at a glance. Requires one
 * inline confirm click before actually calling onConfirm, matching the
 * confirm-before-destructive pattern used for the FashionKart demo reset.
 */
export function DeleteButton({
  onConfirm,
  label = 'Delete',
  confirmLabel = 'Confirm delete?',
  className,
  size = 'default',
  stopPropagation = false,
}: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const sizeClasses =
    size === 'sm' ? 'h-7 px-2.5 text-xs gap-1' : 'h-8 px-3 text-sm gap-1.5'

  async function handleConfirm(event: React.MouseEvent) {
    if (stopPropagation) event.stopPropagation()

    try {
      setBusy(true)
      await onConfirm()
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  function handleAskConfirm(event: React.MouseEvent) {
    if (stopPropagation) event.stopPropagation()
    setConfirming(true)
  }

  function handleCancel(event: React.MouseEvent) {
    if (stopPropagation) event.stopPropagation()
    setConfirming(false)
  }

  if (confirming) {
    return (
      <span
        className={cn('inline-flex items-center gap-1.5', className)}
        onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
      >
        <span className="text-xs font-medium text-destructive">
          {confirmLabel}
        </span>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-red-600 font-medium text-white transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-60',
            sizeClasses,
          )}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : 'Yes, delete'}
        </button>

        <button
          type="button"
          onClick={handleCancel}
          disabled={busy}
          className={cn(
            'inline-flex items-center justify-center rounded-full border border-border bg-background font-medium text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-60',
            sizeClasses,
          )}
        >
          Cancel
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={handleAskConfirm}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-red-600 font-medium text-white transition-colors hover:bg-red-700',
        sizeClasses,
        className,
      )}
    >
      <Trash2 size={size === 'sm' ? 13 : 14} />
      {label}
    </button>
  )
}
