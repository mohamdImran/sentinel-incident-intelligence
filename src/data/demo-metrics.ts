import type { TimeSeries, TimeSeriesPoint, ESQLQueryResult } from '../types/metrics.types';

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateTimeSeries(
  id: string,
  metricName: string,
  displayName: string,
  unit: string,
  baseline: number,
  stdDev: number,
  seed: number,
  anomalyStart: number,
  anomalyPeak: number,
  resolution: number,
  totalPoints = 144
): TimeSeries {
  const rng = seededRandom(seed);
  const now = new Date('2026-02-23T14:40:00Z').getTime();
  const intervalMs = 5 * 60 * 1000;

  const points: TimeSeriesPoint[] = [];

  for (let i = 0; i < totalPoints; i++) {
    const t = now - (totalPoints - i) * intervalMs;
    const ts = new Date(t).toISOString();
    const hour = new Date(t).getUTCHours();
    const diurnal = 1 + 0.3 * Math.sin(((hour - 9) * Math.PI) / 12);
    const noise = (rng() - 0.5) * stdDev * 2;

    let value = baseline * diurnal + noise;
    let isAnomaly = false;
    let anomalyScore: number | undefined;

    const pct = i / totalPoints;
    if (pct >= anomalyStart && pct < resolution) {
      const progress = (pct - anomalyStart) / (anomalyPeak - anomalyStart);
      const clampedProgress = Math.min(1, Math.max(0, progress));
      const multiplier = 1 + clampedProgress * (75 - 1);
      value = baseline * multiplier + noise * 3;
      isAnomaly = value > baseline * 8;
      anomalyScore = isAnomaly ? 70 + clampedProgress * 29 : undefined;
    } else if (pct >= resolution) {
      const recoverProgress = Math.min(1, (pct - resolution) / 0.15);
      value = baseline * (1 + (1 - recoverProgress) * 5) + noise;
    }

    value = Math.max(0, value);
    points.push({ timestamp: ts, value: Math.round(value * 100) / 100, isAnomaly, anomalyScore });
  }

  return {
    id,
    metricName,
    displayName,
    unit,
    dataPoints: points,
    baseline: { mean: baseline, stdDev },
  };
}

export const DEMO_METRICS: Record<string, TimeSeries> = {
  'db.connection.wait_ms': generateTimeSeries(
    'ts-001',
    'db.connection.wait_ms',
    'DB Connection Wait',
    'ms',
    112,
    18,
    42,
    0.7,
    0.85,
    0.92
  ),
  'api.error_rate': generateTimeSeries(
    'ts-002',
    'api.error_rate',
    'API Error Rate',
    '%',
    0.3,
    0.08,
    99,
    0.72,
    0.87,
    0.93,
    144
  ),
  'service.latency_p99': generateTimeSeries(
    'ts-003',
    'service.latency_p99',
    'P99 Latency',
    'ms',
    145,
    22,
    77,
    0.71,
    0.86,
    0.93
  ),
  'db.active_connections': generateTimeSeries(
    'ts-004',
    'db.active_connections',
    'Active Connections',
    'conn',
    180,
    25,
    13,
    0.68,
    0.83,
    0.92
  ),
};

export const DEMO_ESQL_RESULTS: ESQLQueryResult[] = [
  {
    id: 'eq-001',
    query: `FROM metrics-db.*
| WHERE @timestamp > NOW() - 2h
| STATS avg_wait = AVG(db.connection.wait_ms),
        max_wait = MAX(db.connection.wait_ms),
        p99_wait = PERCENTILE(db.connection.wait_ms, 99),
        sample_count = COUNT(*)
  BY db.shard.id, BUCKET(@timestamp, 5 minutes)
| WHERE avg_wait > 500
| SORT @timestamp ASC`,
    columns: [
      { name: 'db.shard.id', type: 'keyword' },
      { name: '@timestamp', type: 'date' },
      { name: 'avg_wait', type: 'double' },
      { name: 'max_wait', type: 'double' },
      { name: 'p99_wait', type: 'double' },
      { name: 'sample_count', type: 'long' },
    ],
    rows: [
      { 'db.shard.id': 'shard-03', '@timestamp': '2026-02-23T14:30:00Z', avg_wait: 847, max_wait: 1240, p99_wait: 1180, sample_count: 342 },
      { 'db.shard.id': 'shard-03', '@timestamp': '2026-02-23T14:35:00Z', avg_wait: 3420, max_wait: 8400, p99_wait: 7800, sample_count: 341 },
      { 'db.shard.id': 'shard-01', '@timestamp': '2026-02-23T14:35:00Z', avg_wait: 1890, max_wait: 4200, p99_wait: 3900, sample_count: 298 },
      { 'db.shard.id': 'shard-02', '@timestamp': '2026-02-23T14:35:00Z', avg_wait: 2100, max_wait: 5100, p99_wait: 4800, sample_count: 315 },
    ],
    totalRows: 4,
    tookMs: 47,
    agentExplanation: 'This ES|QL query aggregates database connection wait times by shard and 5-minute bucket for the past 2 hours, filtering to only show intervals where average wait exceeds 500ms. Results confirm shard-03 was first affected at 14:30 UTC, followed by a cascade to shards 01 and 02 at 14:35 UTC.',
    timestamp: '2026-02-23T14:34:12Z',
  },
  {
    id: 'eq-002',
    query: `FROM logs-db-slow_queries-*
| WHERE @timestamp > NOW() - 30m
| WHERE query.duration_ms > 30000
| EVAL query_truncated = SUBSTRING(query.text, 0, 120)
| STATS occurrence_count = COUNT(*),
        avg_duration = AVG(query.duration_ms),
        max_duration = MAX(query.duration_ms)
  BY query.normalized_hash, query_truncated
| SORT max_duration DESC
| LIMIT 10`,
    columns: [
      { name: 'query.normalized_hash', type: 'keyword' },
      { name: 'query_truncated', type: 'text' },
      { name: 'occurrence_count', type: 'long' },
      { name: 'avg_duration', type: 'double' },
      { name: 'max_duration', type: 'double' },
    ],
    rows: [
      {
        'query.normalized_hash': 'a7f3e2c1',
        query_truncated: 'SELECT o.*, u.email, u.name FROM orders o JOIN users u ON o.user_id = u.id WHERE o.status = ? AND o.created_at > ?',
        occurrence_count: 847,
        avg_duration: 47200,
        max_duration: 112400,
      },
      {
        'query.normalized_hash': 'b9d4a8f2',
        query_truncated: 'SELECT COUNT(*) FROM orders WHERE user_id = ? AND status IN (?,?,?)',
        occurrence_count: 312,
        avg_duration: 38900,
        max_duration: 89700,
      },
    ],
    totalRows: 2,
    tookMs: 128,
    agentExplanation: 'Analysis of slow query logs reveals 847 occurrences of a JOIN query on orders.user_id without an index, causing full table scans on an 847M-row table. This is the primary driver of connection pool saturation.',
    timestamp: '2026-02-23T14:34:45Z',
  },
  {
    id: 'eq-003',
    query: `FROM metrics-services-*
| WHERE @timestamp > NOW() - 1h
| STATS error_rate = AVG(http.error_rate),
        p99_latency = PERCENTILE(http.request.duration_ms, 99),
        request_count = SUM(http.request.count)
  BY service.name, BUCKET(@timestamp, 1 minute)
| WHERE error_rate > 0.05
| SORT error_rate DESC`,
    columns: [
      { name: 'service.name', type: 'keyword' },
      { name: '@timestamp', type: 'date' },
      { name: 'error_rate', type: 'double' },
      { name: 'p99_latency', type: 'double' },
      { name: 'request_count', type: 'long' },
    ],
    rows: [
      { 'service.name': 'orders-service', '@timestamp': '2026-02-23T14:35:00Z', error_rate: 0.847, p99_latency: 8420, request_count: 12847 },
      { 'service.name': 'payment-service', '@timestamp': '2026-02-23T14:35:00Z', error_rate: 0.412, p99_latency: 6800, request_count: 3412 },
      { 'service.name': 'inventory-service', '@timestamp': '2026-02-23T14:35:00Z', error_rate: 0.318, p99_latency: 4200, request_count: 8934 },
      { 'service.name': 'user-service', '@timestamp': '2026-02-23T14:35:00Z', error_rate: 0.185, p99_latency: 2100, request_count: 24107 },
    ],
    totalRows: 4,
    tookMs: 73,
    agentExplanation: 'Service correlation confirms cascade pattern: orders-service most affected (84.7% error rate), followed by payment and inventory services. The blast radius spans 4 critical services, validating the critical severity classification.',
    timestamp: '2026-02-23T14:35:18Z',
  },
];
