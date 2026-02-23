export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00'
  if (cost < 0.01) return `$${cost.toFixed(6)}`
  return `$${cost.toFixed(4)}`
}

export function getDateRange(days: number | null): { start: string; end: string } {
  const end = new Date()
  const start = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null
  return {
    start: start?.toISOString().split('T')[0] ?? '',
    end: end.toISOString().split('T')[0]
  }
}
