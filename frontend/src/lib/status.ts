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
