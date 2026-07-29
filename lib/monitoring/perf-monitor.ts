// Performance monitoring and analytics
// Tracks API response times, cache hit rates, and overall app health

type PerformanceMetric = {
  name: string
  duration: number
  timestamp: number
  status: 'success' | 'error'
}

const metrics: PerformanceMetric[] = []
const MAX_METRICS = 1000

export function recordMetric(name: string, duration: number, status: 'success' | 'error' = 'success') {
  metrics.push({
    name,
    duration,
    timestamp: Date.now(),
    status,
  })

  // Keep only recent metrics to avoid memory bloat
  if (metrics.length > MAX_METRICS) {
    metrics.shift()
  }
}

export function getPerformanceStats() {
  if (metrics.length === 0) {
    return {
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
      totalRequests: 0,
      successRate: 0,
    }
  }

  const durations = metrics.map(m => m.duration).sort((a, b) => a - b)
  const errors = metrics.filter(m => m.status === 'error').length
  const total = metrics.length

  return {
    avgResponseTime: Math.round(durations.reduce((a, b) => a + b, 0) / total),
    p95ResponseTime: durations[Math.floor(total * 0.95)],
    p99ResponseTime: durations[Math.floor(total * 0.99)],
    errorRate: (errors / total) * 100,
    totalRequests: total,
    successRate: ((total - errors) / total) * 100,
  }
}

export function getMetricsByName(name: string) {
  const filtered = metrics.filter(m => m.name === name)
  if (filtered.length === 0) return null

  const durations = filtered.map(m => m.duration).sort((a, b) => a - b)
  const errors = filtered.filter(m => m.status === 'error').length
  const total = filtered.length

  return {
    name,
    count: total,
    avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / total),
    minDuration: durations[0],
    maxDuration: durations[total - 1],
    p95Duration: durations[Math.floor(total * 0.95)],
    errorCount: errors,
    successRate: ((total - errors) / total) * 100,
  }
}

export function clearMetrics() {
  metrics.length = 0
}

// Auto-clear old metrics every 10 minutes
if (typeof global !== 'undefined') {
  setInterval(() => {
    const tenMinutesAgo = Date.now() - 600000
    while (metrics.length > 0 && metrics[0].timestamp < tenMinutesAgo) {
      metrics.shift()
    }
  }, 300000)
}
