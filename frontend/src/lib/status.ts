export function formatLabel(value: string | null | undefined) {
  if (!value) return '—'

  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function formatAmount(amount: string | number, currency = 'INR') {
  const symbol = currency === 'INR' ? '₹' : `${currency} `
  return `${symbol}${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const TONE_CLASSES = {
  neutral: 'bg-secondary text-secondary-foreground border-transparent',
  primary: 'bg-primary/10 text-primary border-primary/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
} as const

export type Tone = keyof typeof TONE_CLASSES

const CASE_STATUS_TONE: Record<string, Tone> = {
  OPEN: 'sky',
  ELIGIBLE: 'sky',
  IN_PROGRESS: 'amber',
  RECOVERED: 'emerald',
  EXHAUSTED: 'rose',
  ESCALATED: 'amber',
  STOPPED: 'neutral',
}

const RISK_TONE: Record<string, Tone> = {
  LOW: 'emerald',
  MEDIUM: 'amber',
  HIGH: 'rose',
  CRITICAL: 'rose',
}

const ACTION_STATUS_TONE: Record<string, Tone> = {
  PENDING: 'neutral',
  APPROVED: 'sky',
  BLOCKED: 'rose',
  EXECUTING: 'amber',
  SUCCESS: 'emerald',
  FAILED: 'rose',
}

const POLICY_TONE: Record<string, Tone> = {
  ALLOW: 'emerald',
  BLOCK: 'rose',
  REQUIRE_APPROVAL: 'amber',
}

const BATCH_STATUS_TONE: Record<string, Tone> = {
  DETECTED: 'sky',
  RUNNING: 'amber',
  COMPLETED: 'emerald',
}

const INVOICE_STATUS_TONE: Record<string, Tone> = {
  DRAFT: 'neutral',
  ISSUED: 'sky',
  PARTIALLY_PAID: 'amber',
  PAID: 'emerald',
  OVERDUE: 'rose',
  CANCELLED: 'neutral',
}

const SUBSCRIPTION_STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'emerald',
  PAUSED: 'neutral',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
  PAYMENT_FAILED: 'rose',
}

const MANDATE_STATUS_TONE: Record<string, Tone> = {
  CREATED: 'sky',
  CONFIRMED: 'emerald',
  REJECTED: 'rose',
  PAUSED: 'amber',
  CANCELLED: 'neutral',
}

const PROMISE_STATUS_TONE: Record<string, Tone> = {
  PENDING: 'amber',
  KEPT: 'emerald',
  MISSED: 'rose',
}

export function promiseStatusTone(status: string | null | undefined): Tone {
  return PROMISE_STATUS_TONE[status ?? ''] ?? 'neutral'
}

export function toneClasses(tone: Tone) {
  return TONE_CLASSES[tone]
}

export function caseStatusTone(status: string): Tone {
  return CASE_STATUS_TONE[status] ?? 'neutral'
}

export function riskTone(level: string): Tone {
  return RISK_TONE[level] ?? 'neutral'
}

export function actionStatusTone(status: string): Tone {
  return ACTION_STATUS_TONE[status] ?? 'neutral'
}

export function policyTone(decision: string): Tone {
  return POLICY_TONE[decision] ?? 'neutral'
}

export function batchStatusTone(status: string): Tone {
  return BATCH_STATUS_TONE[status] ?? 'neutral'
}

export function invoiceStatusTone(status: string): Tone {
  return INVOICE_STATUS_TONE[status] ?? 'neutral'
}

export function subscriptionStatusTone(status: string): Tone {
  return SUBSCRIPTION_STATUS_TONE[status] ?? 'neutral'
}

export function mandateStatusTone(status: string): Tone {
  return MANDATE_STATUS_TONE[status] ?? 'neutral'
}

export type RecoveryCaseCategory =
  | 'CHECKOUT_ABANDONMENT'
  | 'PAYMENT_FAILURE'
  | 'SUBSCRIPTION_FAILURE'
  | 'RECEIVABLE_OVERDUE'
  | 'MANDATE_FAILURE'

interface RecoveryCaseLinks {
  payment?: unknown
  subscription?: unknown
  invoice?: unknown
  mandate?: unknown
}

/**
 * A case's category is derived from which record is actually attached, not
 * from the free-text rootCause string — a checkout-abandonment case that
 * later gets a real failed payment linked (see
 * RazorpayWebhookService.handleWebhook's existingOrderCase branch) correctly
 * flips to PAYMENT_FAILURE here too, matching that re-classification.
 */
export function recoveryCaseCategory(
  recoveryCase: RecoveryCaseLinks,
): RecoveryCaseCategory {
  if (recoveryCase.payment) return 'PAYMENT_FAILURE'
  if (recoveryCase.subscription) return 'SUBSCRIPTION_FAILURE'
  if (recoveryCase.invoice) return 'RECEIVABLE_OVERDUE'
  if (recoveryCase.mandate) return 'MANDATE_FAILURE'
  return 'CHECKOUT_ABANDONMENT'
}

const CATEGORY_META: Record<
  RecoveryCaseCategory,
  { label: string; caption: string; tone: Tone }
> = {
  CHECKOUT_ABANDONMENT: {
    label: 'Checkout abandonment',
    caption: 'Customer left checkout before attempting to pay.',
    tone: 'sky',
  },
  PAYMENT_FAILURE: {
    label: 'Payment failure',
    caption: 'Identified from a real, failed payment attempt.',
    tone: 'rose',
  },
  SUBSCRIPTION_FAILURE: {
    label: 'Subscription failure',
    caption: 'A recurring billing charge failed to go through.',
    tone: 'amber',
  },
  RECEIVABLE_OVERDUE: {
    label: 'Receivable overdue',
    caption: 'An invoice has passed its due date unpaid.',
    tone: 'amber',
  },
  MANDATE_FAILURE: {
    label: 'Mandate failure',
    caption: 'An autopay mandate registration or debit failed.',
    tone: 'rose',
  },
}

export function recoveryCaseCategoryMeta(category: RecoveryCaseCategory) {
  return CATEGORY_META[category]
}
