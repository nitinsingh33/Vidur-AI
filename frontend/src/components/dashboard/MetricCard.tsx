import './MetricCard.css'
interface MetricCardProps {
  label: string
  value: string
  description: string
}

export function MetricCard({
  label,
  value,
  description,
}: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className="metric-label">{label}</div>

      <div className="metric-value">{value}</div>

      <div className="metric-description">
        {description}
      </div>
    </article>
  )
}