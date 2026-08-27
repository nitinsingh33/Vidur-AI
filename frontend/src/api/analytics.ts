const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface RevenueAtRiskResponse {
  revenueAtRisk: string
  currency: string
  recoveryCases: number
}

export interface RevenueRecoveredResponse {
  revenueRecovered: string
  currency: string
  successfulRecoveries: number
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`)

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    )
  }

  return response.json()
}

export function getRevenueAtRisk() {
  return fetchJson<RevenueAtRiskResponse>(
    '/analytics/revenue-at-risk',
  )
}

export function getRevenueRecovered() {
  return fetchJson<RevenueRecoveredResponse>(
    '/analytics/revenue-recovered',
  )
}

export interface AnalyticsSummaryResponse {
  activeRecoveryCases: number
  agentActions: number
  failedActions: number
  escalations: number
}

export function getAnalyticsSummary() {
  return fetchJson<AnalyticsSummaryResponse>(
    '/analytics/summary',
  )
}