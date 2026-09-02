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
 * Quiet by default — a muted icon-only button so a table of rows doesn't
 * read as a wall of red. Only escalates to solid red once the merchant has
 * already clicked it once, at the inline "Yes, delete" confirm step —
 * matching the confirm-before-destructive pattern used for the FashionKart
 * demo reset.
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

  // Icon-only in dense table rows (the common case, and the one that was
  // reading as a "wall of red") — a labeled button only for a deliberate
  // standalone action like RecoveryCaseDetails' "Delete case".
  if (size === 'sm') {
    return (
      <button
        type="button"
        onClick={handleAskConfirm}
        title={label}
        aria-label={label}
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive',
          className,
        )}
      >
        <Trash2 size={13} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleAskConfirm}
      className={cn(
        'inline-flex items-center justify-center rounded-full border border-border bg-transparent font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive',
        sizeClasses,
        className,
      )}
    >
      <Trash2 size={14} />
      {label}
    </button>
  )
}
