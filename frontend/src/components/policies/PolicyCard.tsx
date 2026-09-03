import { ChevronRight } from 'lucide-react'
import type { Policy } from '../../api/policies'
import {
  getEffectiveDecision,
  getEffectiveDecisionLabel,
  getPolicySubtitle,
  getPolicyTitle,
  summarizePolicyLimits,
} from '../../lib/policyLabels'
import { cn } from '../../lib/utils'

const DOT_CLASS: Record<string, string> = {
  ALLOW: 'bg-emerald-500',
  REQUIRE_APPROVAL: 'bg-amber-500',
  BLOCK: 'bg-rose-500',
}

const LABEL_CLASS: Record<string, string> = {
  ALLOW: 'text-emerald-600 dark:text-emerald-400',
  REQUIRE_APPROVAL: 'text-amber-600 dark:text-amber-400',
  BLOCK: 'text-rose-600 dark:text-rose-400',
}

interface PolicyCardProps {
  policy: Policy
  canEdit: boolean
  onConfigure: () => void
}

export function PolicyCard({ policy, canEdit, onConfigure }: PolicyCardProps) {
  const effective = getEffectiveDecision(policy)

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-sm font-semibold text-foreground">
          {getPolicyTitle(policy)}
        </h3>

        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 text-xs font-medium',
            LABEL_CLASS[effective],
          )}
        >
          <span className={cn('size-1.5 rounded-full', DOT_CLASS[effective])} />
          {getEffectiveDecisionLabel(policy)}
        </span>
      </div>

      <p className="mt-1.5 text-sm text-muted-foreground">
        {getPolicySubtitle(policy)}
      </p>

      <div className="mt-4 flex items-end justify-between gap-4">
        <p className="text-sm text-foreground/80">
          {summarizePolicyLimits(policy)}
        </p>

        <button
          type="button"
          onClick={onConfigure}
          className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          {canEdit ? 'Configure' : 'View details'}
          <ChevronRight size={15} />
        </button>
      </div>
    </article>
  )
}
