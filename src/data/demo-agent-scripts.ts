import type { AgentRole } from '../types/agent.types';

export interface ScriptedStep {
  offsetMs: number;
  agentRole: AgentRole;
  type: 'status_change' | 'reasoning_text' | 'tool_call_start' | 'tool_call_complete' | 'finding' | 'handoff';
  payload: Record<string, unknown>;
}

export const SCENARIO_0_SCRIPTS: ScriptedStep[] = [
  { offsetMs: 500, agentRole: 'planner', type: 'status_change', payload: { status: 'thinking' } },

  {
    offsetMs: 700,
    agentRole: 'planner',
    type: 'reasoning_text',
    payload: {
      text: `Incident INC-001 received: DB connection pool exhaustion cascade.

Analyzing incident signature...
→ Severity: CRITICAL — 6 downstream services affected
→ Affected regions: us-east-1, us-east-2
→ Initial anomaly score: 98.7 (Elastic ML)

Investigation plan:
  1. Query time-series metrics for db.connection.wait_ms across all shards (2h window)
  2. Identify which shard was first affected using temporal ordering
  3. Cross-reference slow query logs for causative queries
  4. Correlate service-level error rates to confirm blast radius
  5. Hand off findings to Investigator and Correlator agents in parallel

Initiating ES|QL query: connection pool wait times by shard...`,
    },
  },

  {
    offsetMs: 6200,
    agentRole: 'planner',
    type: 'tool_call_start',
    payload: {
      id: 'tc-001',
      toolName: 'esql_query',
      parameters: {
        query: `FROM metrics-db.*\n| WHERE @timestamp > NOW() - 2h\n| STATS avg_wait = AVG(db.connection.wait_ms), max_wait = MAX(db.connection.wait_ms), p99_wait = PERCENTILE(db.connection.wait_ms, 99), sample_count = COUNT(*)\n  BY db.shard.id, BUCKET(@timestamp, 5 minutes)\n| WHERE avg_wait > 500\n| SORT @timestamp ASC`,
        index: 'metrics-db-2026.02.23',
      },
    },
  },

  {
    offsetMs: 7100,
    agentRole: 'planner',
    type: 'tool_call_complete',
    payload: {
      id: 'tc-001',
      resultSummary: '4 rows — shard-03 first breached at 14:30 UTC (avg_wait: 847ms → 3,420ms)',
      durationMs: 47,
      esqlResultId: 'eq-001',
    },
  },

  {
    offsetMs: 7600,
    agentRole: 'planner',
    type: 'reasoning_text',
    payload: {
      text: `ES|QL RESULT ANALYSIS:
→ shard-03 first to show elevated wait times at 14:30 UTC (avg: 847ms)
→ By 14:35 UTC: shard-03 at 3,420ms avg, shards 01/02 also breached threshold
→ Cascade confirmed: single shard failure propagated to full cluster

FINDING: shard-03 is origin of cascade. Temporal gap of ~5 minutes before spread suggests connection pool saturation was gradual, not sudden.

Dispatching Investigator to analyze slow query logs on shard-03.
Dispatching Correlator to map service impact.`,
    },
  },

  { offsetMs: 11000, agentRole: 'planner', type: 'status_change', payload: { status: 'complete', progress: 100 } },
  { offsetMs: 11000, agentRole: 'planner', type: 'handoff', payload: { to: 'investigator' } },
  { offsetMs: 11000, agentRole: 'planner', type: 'handoff', payload: { to: 'correlator' } },

  { offsetMs: 11200, agentRole: 'investigator', type: 'status_change', payload: { status: 'thinking' } },
  { offsetMs: 11200, agentRole: 'correlator', type: 'status_change', payload: { status: 'thinking' } },

  {
    offsetMs: 11500,
    agentRole: 'investigator',
    type: 'reasoning_text',
    payload: {
      text: `Received handoff from Planner Agent.
Focus: shard-03 slow query analysis (14:00–14:40 UTC window)

Hypothesis: Connection pool saturation caused by slow queries holding connections open.
Testing via ES|QL slow query log analysis...

→ Querying logs-db-slow_queries-* index
→ Filter: duration > 30,000ms, timestamp within 30min window
→ Aggregating by normalized query hash to identify repeat offenders`,
    },
  },

  {
    offsetMs: 14000,
    agentRole: 'investigator',
    type: 'tool_call_start',
    payload: {
      id: 'tc-002',
      toolName: 'get_slow_queries',
      parameters: {
        shardId: 'db-shard-03',
        timeRange: '30m',
        durationThresholdMs: 30000,
      },
    },
  },

  {
    offsetMs: 14900,
    agentRole: 'investigator',
    type: 'tool_call_complete',
    payload: {
      id: 'tc-002',
      resultSummary: '847 occurrences of unbounded JOIN query on orders.user_id (no index) — avg 47.2s',
      durationMs: 128,
      esqlResultId: 'eq-002',
    },
  },

  {
    offsetMs: 15400,
    agentRole: 'investigator',
    type: 'reasoning_text',
    payload: {
      text: `CRITICAL FINDING — Root cause identified:

Query hash a7f3e2c1 accounts for 847 slow query events in the incident window.
Pattern: SELECT o.*, u.email FROM orders o JOIN users u ON o.user_id = u.id

→ No index exists on orders.user_id column
→ This forces a FULL TABLE SCAN on an 847,000,000 row table
→ Each scan holds a DB connection for ~47 seconds on average
→ With 847 concurrent scans × 47s = pool exhaustion inevitable

TIMELINE RECONSTRUCTION:
  14:24 UTC — Slow queries begin accumulating (below alert threshold)
  14:30 UTC — Connection pool on shard-03 reaches 80% capacity
  14:32 UTC — Pool fully saturated (500/500 connections), wait queue builds
  14:33 UTC — Cascade to shard-01 and shard-02 as queries redistribute
  14:33 UTC — Downstream service errors begin propagating

EVIDENCE CONFIDENCE: 97.3%
RECOMMENDED FIX: CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id)`,
    },
  },

  { offsetMs: 22000, agentRole: 'investigator', type: 'status_change', payload: { status: 'complete', progress: 100 } },
  { offsetMs: 22000, agentRole: 'investigator', type: 'handoff', payload: { to: 'remediator' } },

  {
    offsetMs: 15800,
    agentRole: 'correlator',
    type: 'reasoning_text',
    payload: {
      text: `Received handoff from Planner Agent.
Focus: Service-level blast radius mapping

Running cross-service correlation query to identify all impacted downstream services...
→ Querying metrics-services-* index
→ Time window: 14:00–14:40 UTC
→ Correlating error_rate spikes with DB anomaly timestamps`,
    },
  },

  {
    offsetMs: 17500,
    agentRole: 'correlator',
    type: 'tool_call_start',
    payload: {
      id: 'tc-003',
      toolName: 'esql_query',
      parameters: {
        query: `FROM metrics-services-*\n| WHERE @timestamp > NOW() - 1h\n| STATS error_rate = AVG(http.error_rate), p99_latency = PERCENTILE(http.request.duration_ms, 99)\n  BY service.name, BUCKET(@timestamp, 1 minute)\n| WHERE error_rate > 0.05\n| SORT error_rate DESC`,
        index: 'metrics-services-2026.02.23',
      },
    },
  },

  {
    offsetMs: 18400,
    agentRole: 'correlator',
    type: 'tool_call_complete',
    payload: {
      id: 'tc-003',
      resultSummary: '4 services affected: orders (84.7%), payment (41.2%), inventory (31.8%), user (18.5%)',
      durationMs: 73,
      esqlResultId: 'eq-003',
    },
  },

  {
    offsetMs: 19000,
    agentRole: 'correlator',
    type: 'reasoning_text',
    payload: {
      text: `Blast radius mapping complete.

Affected services (sorted by error rate):
  1. orders-service     → 84.7% errors | P99: 8,420ms | 12,847 req/min
  2. payment-service    → 41.2% errors | P99: 6,800ms | 3,412 req/min
  3. inventory-service  → 31.8% errors | P99: 4,200ms | 8,934 req/min
  4. user-service       → 18.5% errors | P99: 2,100ms | 24,107 req/min

Dependency graph analysis:
→ All 4 services have direct DB connections to affected cluster
→ No service mesh circuit breaker triggered (gap in resilience config)
→ api-gateway showing elevated 5xx pass-through to clients

User impact estimate: ~124,000 failed transactions in last 3 minutes
Revenue exposure: $142,000/min based on historical conversion data

Providing blast radius findings to Remediator...`,
    },
  },

  { offsetMs: 24000, agentRole: 'correlator', type: 'status_change', payload: { status: 'complete', progress: 100 } },
  { offsetMs: 24000, agentRole: 'correlator', type: 'handoff', payload: { to: 'remediator' } },

  { offsetMs: 24200, agentRole: 'remediator', type: 'status_change', payload: { status: 'thinking' } },

  {
    offsetMs: 24500,
    agentRole: 'remediator',
    type: 'reasoning_text',
    payload: {
      text: `Received root cause from Investigator + blast radius from Correlator.

Root cause: Missing index on orders.user_id causing full table scans
Immediate priority: Restore service availability before applying permanent fix

REMEDIATION STRATEGY (ordered by time-to-impact):

  PHASE 1 — Immediate (< 60s)
    → Restart connection pools on all 3 shards (flushes stuck connections)
    → Temporarily increase pool limit: 500 → 750 connections
    → Kill all queries with duration > 30s on shard-03

  PHASE 2 — Short-term (< 5 min)
    → Create missing index: CONCURRENTLY to avoid table lock
    → Enable circuit breaker on orders-service DB client

  PHASE 3 — Preventive
    → Add database slow query alert: threshold 5s (currently 30s)
    → Add index coverage validation to CI/CD pipeline

Executing Elastic Workflow: sentinel-db-remediation-v2...`,
    },
  },

  {
    offsetMs: 29000,
    agentRole: 'remediator',
    type: 'tool_call_start',
    payload: {
      id: 'tc-004',
      toolName: 'elastic_workflow',
      parameters: {
        workflowId: 'sentinel-db-remediation-v2',
        incidentId: 'inc-001',
        parameters: {
          targetShards: ['shard-01', 'shard-02', 'shard-03'],
          poolLimitOverride: 750,
          killQueryDurationMs: 30000,
          createIndex: true,
        },
      },
    },
  },

  { offsetMs: 31000, agentRole: 'remediator', type: 'tool_call_complete', payload: { id: 'tc-004', resultSummary: 'Workflow executing — Step 1/4 complete', durationMs: 0 } },
  { offsetMs: 34500, agentRole: 'remediator', type: 'status_change', payload: { status: 'complete', progress: 100 } },
  { offsetMs: 34500, agentRole: 'remediator', type: 'handoff', payload: { to: 'verifier' } },

  { offsetMs: 35000, agentRole: 'verifier', type: 'status_change', payload: { status: 'thinking' } },

  {
    offsetMs: 35300,
    agentRole: 'verifier',
    type: 'reasoning_text',
    payload: {
      text: `Received handoff from Remediator. Verifying remediation effectiveness.

Monitoring post-remediation metrics...
→ Querying db.connection.wait_ms (last 5 minutes)
→ Querying api.error_rate (last 5 minutes)
→ Checking index creation status on shard-03`,
    },
  },

  {
    offsetMs: 38000,
    agentRole: 'verifier',
    type: 'tool_call_start',
    payload: {
      id: 'tc-005',
      toolName: 'get_anomaly_score',
      parameters: { metricNames: ['db.connection.wait_ms', 'api.error_rate'], windowMinutes: 5 },
    },
  },

  {
    offsetMs: 38900,
    agentRole: 'verifier',
    type: 'tool_call_complete',
    payload: {
      id: 'tc-005',
      resultSummary: 'db.connection.wait_ms: 114ms (↓98.7%) | api.error_rate: 0.2% (↓98.9%) | anomaly_score: 2.1',
      durationMs: 62,
    },
  },

  {
    offsetMs: 39500,
    agentRole: 'verifier',
    type: 'reasoning_text',
    payload: {
      text: `POST-REMEDIATION VERIFICATION — PASS ✓

  db.connection.wait_ms: 8,420ms → 114ms  (↓ 98.7%)
  api.error_rate:        18.4%  → 0.2%   (↓ 98.9%)
  P99 latency:           8,420ms → 128ms  (↓ 98.5%)
  Anomaly score:         98.7   → 2.1    (normal range)

Index creation status: COMPLETE (CONCURRENTLY — no lock contention)
Circuit breaker: ENABLED on orders-service

All metrics returned to baseline. Incident resolved.

MTTR: 2.3 minutes (from detection to resolution)
Human actions required: 0

Closing incident INC-001 as AUTO_RESOLVED.`,
    },
  },

  { offsetMs: 44000, agentRole: 'verifier', type: 'status_change', payload: { status: 'complete', progress: 100 } },
];


export const SCENARIO_1_SCRIPTS: ScriptedStep[] = [
  { offsetMs: 500, agentRole: 'planner', type: 'status_change', payload: { status: 'thinking' } },
  {
    offsetMs: 700,
    agentRole: 'planner',
    type: 'reasoning_text',
    payload: {
      text: `Incident INC-002 received: CDN Origin Failover Failure — APAC Region.

Analyzing incident signature...
→ Severity: HIGH — 1.2M users affected across Southeast Asia
→ Affected region: ap-southeast-1
→ Initial anomaly score: 94.8 (Elastic ML)
→ Metric: cdn.origin_error_rate = 0.34 (baseline: 0.001)

Investigation plan:
  1. Query CDN edge metrics for origin health check failures (1h window)
  2. Identify which origin endpoints are timing out
  3. Correlate with network path changes (BGP route anomalies)
  4. Map user impact by geo-region
  5. Dispatch Investigator for origin analysis, Correlator for user impact

Initiating ES|QL query: CDN origin error rates by edge node...`,
    },
  },
  {
    offsetMs: 6000,
    agentRole: 'planner',
    type: 'tool_call_start',
    payload: {
      id: 'tc-101',
      toolName: 'esql_query',
      parameters: {
        query: `FROM metrics-cdn.*\n| WHERE @timestamp > NOW() - 1h\n| STATS error_rate = AVG(cdn.origin_error_rate), timeout_count = SUM(cdn.origin_timeout_count)\n  BY cdn.edge_node, cdn.origin_endpoint, BUCKET(@timestamp, 5 minutes)\n| WHERE error_rate > 0.05\n| SORT error_rate DESC`,
        index: 'metrics-cdn-2026.02.23',
      },
    },
  },
  {
    offsetMs: 6900,
    agentRole: 'planner',
    type: 'tool_call_complete',
    payload: {
      id: 'tc-101',
      resultSummary: '3 edge nodes failing — origin-sg-01 unreachable, 34% packet loss on primary path',
      durationMs: 52,
    },
  },
  {
    offsetMs: 7400,
    agentRole: 'planner',
    type: 'reasoning_text',
    payload: {
      text: `CDN ANALYSIS:
→ origin-sg-01 (primary): 100% failure rate since 11:14 UTC
→ origin-sg-02 (backup): failover NOT triggered — health check config issue
→ Packet loss: 34% on ap-southeast-1 → us-west-2 backbone path
→ BGP route change detected at 11:12 UTC (2 min before incident)

FINDING: Backup origin failover is misconfigured — health check timeout set to 30s
(should be 5s). This prevented automatic failover for 44 minutes.

Dispatching Investigator to analyze origin health check config.
Dispatching Correlator to quantify user impact.`,
    },
  },
  { offsetMs: 10800, agentRole: 'planner', type: 'status_change', payload: { status: 'complete', progress: 100 } },
  { offsetMs: 10800, agentRole: 'planner', type: 'handoff', payload: { to: 'investigator' } },
  { offsetMs: 10800, agentRole: 'planner', type: 'handoff', payload: { to: 'correlator' } },

  { offsetMs: 11000, agentRole: 'investigator', type: 'status_change', payload: { status: 'thinking' } },
  { offsetMs: 11000, agentRole: 'correlator', type: 'status_change', payload: { status: 'thinking' } },

  {
    offsetMs: 11300,
    agentRole: 'investigator',
    type: 'reasoning_text',
    payload: {
      text: `Received handoff from Planner Agent.
Focus: CDN origin health check configuration analysis

Querying CDN configuration logs for health check parameters...
→ Index: logs-cdn-config-*
→ Comparing current vs last-known-good configuration
→ Checking failover trigger thresholds`,
    },
  },
  {
    offsetMs: 14500,
    agentRole: 'investigator',
    type: 'tool_call_start',
    payload: {
      id: 'tc-102',
      toolName: 'esql_query',
      parameters: {
        query: `FROM logs-cdn-config-*\n| WHERE @timestamp > NOW() - 2h\n| WHERE event.type = "config_change" OR event.type = "health_check_result"\n| SORT @timestamp DESC\n| LIMIT 20`,
        index: 'logs-cdn-config-2026.02.23',
      },
    },
  },
  {
    offsetMs: 15300,
    agentRole: 'investigator',
    type: 'tool_call_complete',
    payload: {
      id: 'tc-102',
      resultSummary: 'Health check timeout changed from 5s → 30s at 09:47 UTC via automated config push',
      durationMs: 38,
    },
  },
  {
    offsetMs: 15800,
    agentRole: 'investigator',
    type: 'reasoning_text',
    payload: {
      text: `ROOT CAUSE IDENTIFIED:

Config change at 09:47 UTC (1.5h before incident):
  health_check.timeout_seconds: 5 → 30  (automated config push v2.4.1)
  health_check.failure_threshold: 2 → 5  (same push)

Impact of this change:
→ With 30s timeout × 5 failures = 150s before failover triggers
→ During BGP route disruption, origin-sg-01 became unreachable
→ Health checks timed out but failover threshold not met for 44 minutes
→ 1.2M users experienced 34% packet loss during this window

EVIDENCE CONFIDENCE: 99.1%
RECOMMENDED FIX:
  1. Revert health_check.timeout_seconds to 5s
  2. Revert health_check.failure_threshold to 2
  3. Force immediate failover to origin-sg-02
  4. Add config change validation to prevent regression`,
    },
  },
  { offsetMs: 22000, agentRole: 'investigator', type: 'status_change', payload: { status: 'complete', progress: 100 } },
  { offsetMs: 22000, agentRole: 'investigator', type: 'handoff', payload: { to: 'remediator' } },

  {
    offsetMs: 15500,
    agentRole: 'correlator',
    type: 'reasoning_text',
    payload: {
      text: `Received handoff from Planner Agent.
Focus: User impact quantification across APAC region

Running geo-distributed user impact analysis...
→ Querying real-user-monitoring (RUM) data for ap-southeast-1
→ Correlating with CDN error timestamps
→ Estimating affected user sessions`,
    },
  },
  {
    offsetMs: 17000,
    agentRole: 'correlator',
    type: 'tool_call_start',
    payload: {
      id: 'tc-103',
      toolName: 'esql_query',
      parameters: {
        query: `FROM metrics-rum-*\n| WHERE @timestamp > NOW() - 2h\n| WHERE geo.region = "ap-southeast-1"\n| STATS affected_sessions = COUNT_DISTINCT(session.id), error_count = SUM(rum.error_count)\n  BY BUCKET(@timestamp, 5 minutes)\n| SORT @timestamp ASC`,
        index: 'metrics-rum-2026.02.23',
      },
    },
  },
  {
    offsetMs: 17900,
    agentRole: 'correlator',
    type: 'tool_call_complete',
    payload: {
      id: 'tc-103',
      resultSummary: '1.24M affected sessions · 847K failed page loads · 3 countries impacted',
      durationMs: 91,
    },
  },
  {
    offsetMs: 18400,
    agentRole: 'correlator',
    type: 'reasoning_text',
    payload: {
      text: `User impact analysis complete.

Affected users by country:
  Singapore:   487,000 sessions (39.3%)
  Malaysia:    312,000 sessions (25.2%)
  Indonesia:   441,000 sessions (35.5%)

Impact metrics:
→ 847,000 failed page loads (68.3% failure rate)
→ Average load time for successful requests: 12.4s (baseline: 0.8s)
→ Estimated bounce rate increase: +340%
→ E-commerce conversion impact: ~$89,000 revenue at risk

Geo-correlation confirms: incident is isolated to ap-southeast-1 backbone path.
No impact detected in ap-northeast-1 (Tokyo) or ap-south-1 (Mumbai).

Providing impact data to Remediator for prioritization...`,
    },
  },
  { offsetMs: 23500, agentRole: 'correlator', type: 'status_change', payload: { status: 'complete', progress: 100 } },
  { offsetMs: 23500, agentRole: 'correlator', type: 'handoff', payload: { to: 'remediator' } },

  { offsetMs: 23700, agentRole: 'remediator', type: 'status_change', payload: { status: 'thinking' } },
  {
    offsetMs: 24000,
    agentRole: 'remediator',
    type: 'reasoning_text',
    payload: {
      text: `Received root cause from Investigator + user impact from Correlator.

Root cause: CDN health check misconfiguration preventing failover
User impact: 1.24M sessions, $89K revenue at risk

REMEDIATION STRATEGY:

  PHASE 1 — Immediate (< 30s)
    → Force failover: route all ap-southeast-1 traffic to origin-sg-02
    → Revert health check config: timeout 30s → 5s, threshold 5 → 2

  PHASE 2 — Short-term (< 2 min)
    → Purge CDN cache for ap-southeast-1 edge nodes
    → Verify origin-sg-02 capacity can handle full traffic load

  PHASE 3 — Preventive
    → Add config change validation: block health_check.timeout > 10s
    → Add automated rollback for CDN config changes causing error rate > 5%

Executing Elastic Workflow: sentinel-cdn-failover-v1...`,
    },
  },
  {
    offsetMs: 28500,
    agentRole: 'remediator',
    type: 'tool_call_start',
    payload: {
      id: 'tc-104',
      toolName: 'elastic_workflow',
      parameters: {
        workflowId: 'sentinel-cdn-failover-v1',
        incidentId: 'inc-002',
        parameters: {
          region: 'ap-southeast-1',
          forceFailover: true,
          targetOrigin: 'origin-sg-02',
          revertConfigKeys: ['health_check.timeout_seconds', 'health_check.failure_threshold'],
        },
      },
    },
  },
  { offsetMs: 30500, agentRole: 'remediator', type: 'tool_call_complete', payload: { id: 'tc-104', resultSummary: 'Failover complete — origin-sg-02 serving 100% traffic, config reverted', durationMs: 0 } },
  { offsetMs: 33500, agentRole: 'remediator', type: 'status_change', payload: { status: 'complete', progress: 100 } },
  { offsetMs: 33500, agentRole: 'remediator', type: 'handoff', payload: { to: 'verifier' } },

  { offsetMs: 34000, agentRole: 'verifier', type: 'status_change', payload: { status: 'thinking' } },
  {
    offsetMs: 34300,
    agentRole: 'verifier',
    type: 'reasoning_text',
    payload: {
      text: `Received handoff from Remediator. Verifying CDN failover effectiveness.

Monitoring post-remediation CDN metrics...
→ Querying cdn.origin_error_rate (last 5 minutes)
→ Checking origin-sg-02 response times
→ Verifying health check config rollback`,
    },
  },
  {
    offsetMs: 37000,
    agentRole: 'verifier',
    type: 'tool_call_start',
    payload: {
      id: 'tc-105',
      toolName: 'get_anomaly_score',
      parameters: { metricNames: ['cdn.origin_error_rate', 'cdn.edge_latency_p99'], windowMinutes: 5 },
    },
  },
  {
    offsetMs: 37900,
    agentRole: 'verifier',
    type: 'tool_call_complete',
    payload: {
      id: 'tc-105',
      resultSummary: 'cdn.origin_error_rate: 0.002 (↓99.4%) | edge_latency_p99: 0.9s (↓92.7%) | anomaly_score: 1.8',
      durationMs: 44,
    },
  },
  {
    offsetMs: 38400,
    agentRole: 'verifier',
    type: 'reasoning_text',
    payload: {
      text: `POST-REMEDIATION VERIFICATION — PASS ✓

  cdn.origin_error_rate:  0.340 → 0.002  (↓ 99.4%)
  edge_latency_p99:       12.4s → 0.9s   (↓ 92.7%)
  Packet loss:            34%   → 0.1%   (↓ 99.7%)
  Anomaly score:          94.8  → 1.8    (normal range)

Failover status: origin-sg-02 serving 100% ap-southeast-1 traffic
Health check config: REVERTED (timeout: 5s, threshold: 2)
Config validation rule: DEPLOYED (blocks timeout > 10s)

All CDN metrics returned to baseline. Incident resolved.

MTTR: 3.4 minutes (from detection to resolution)
Human actions required: 0

Closing incident INC-002 as AUTO_RESOLVED.`,
    },
  },
  { offsetMs: 43500, agentRole: 'verifier', type: 'status_change', payload: { status: 'complete', progress: 100 } },
];


export const SCENARIO_2_SCRIPTS: ScriptedStep[] = [
  { offsetMs: 500, agentRole: 'planner', type: 'status_change', payload: { status: 'thinking' } },
  {
    offsetMs: 700,
    agentRole: 'planner',
    type: 'reasoning_text',
    payload: {
      text: `Incident INC-003 received: Credential Stuffing Attack — Anomalous Auth Pattern.

Analyzing incident signature...
→ Severity: HIGH — Active security threat
→ Affected services: auth-service, user-service, api-gateway
→ Initial anomaly score: 99.4 (Elastic ML) — highest confidence
→ Metric: auth.failed_login_rate = 15,667/min (baseline: 42/min)

Threat intelligence analysis:
→ 47,000 login attempts in 3-minute window
→ 892 unique source IPs — botnet C2 pattern
→ 0.8% success rate = ~376 potentially compromised accounts
→ Geo-distribution: 23 countries, concentrated in Eastern Europe + SEA

Investigation plan:
  1. Cluster attack IPs by ASN and geo to confirm botnet pattern
  2. Identify compromised accounts via successful auth from attack IPs
  3. Correlate with known credential breach databases
  4. Dispatch Investigator for IP analysis, Correlator for account impact

Initiating ES|QL query: attack pattern clustering...`,
    },
  },
  {
    offsetMs: 6200,
    agentRole: 'planner',
    type: 'tool_call_start',
    payload: {
      id: 'tc-201',
      toolName: 'esql_query',
      parameters: {
        query: `FROM logs-auth-*\n| WHERE @timestamp > NOW() - 10m\n| WHERE event.outcome = "failure"\n| STATS attempt_count = COUNT(*), unique_users = COUNT_DISTINCT(user.name)\n  BY source.ip, source.geo.country_name, source.as.organization.name\n| WHERE attempt_count > 10\n| SORT attempt_count DESC\n| LIMIT 20`,
        index: 'logs-auth-2026.02.23',
      },
    },
  },
  {
    offsetMs: 7100,
    agentRole: 'planner',
    type: 'tool_call_complete',
    payload: {
      id: 'tc-201',
      resultSummary: '892 IPs across 23 countries — 78% from 3 ASNs (known botnet infrastructure)',
      durationMs: 89,
    },
  },
  {
    offsetMs: 7600,
    agentRole: 'planner',
    type: 'reasoning_text',
    payload: {
      text: `ATTACK PATTERN ANALYSIS:
→ 78% of IPs belong to 3 ASNs flagged in threat intelligence feeds
→ Request timing: 52ms average between attempts (automated, not human)
→ User-agent rotation: 847 unique UAs (evasion technique)
→ Target pattern: email addresses matching known breach dataset format

THREAT CLASSIFICATION: Credential Stuffing — HIGH CONFIDENCE (99.1%)
NOT brute force (too many unique targets, too low per-target rate)

Dispatching Investigator to identify compromised accounts.
Dispatching Correlator to assess downstream service exposure.`,
    },
  },
  { offsetMs: 11000, agentRole: 'planner', type: 'status_change', payload: { status: 'complete', progress: 100 } },
  { offsetMs: 11000, agentRole: 'planner', type: 'handoff', payload: { to: 'investigator' } },
  { offsetMs: 11000, agentRole: 'planner', type: 'handoff', payload: { to: 'correlator' } },

  { offsetMs: 11200, agentRole: 'investigator', type: 'status_change', payload: { status: 'thinking' } },
  { offsetMs: 11200, agentRole: 'correlator', type: 'status_change', payload: { status: 'thinking' } },

  {
    offsetMs: 11500,
    agentRole: 'investigator',
    type: 'reasoning_text',
    payload: {
      text: `Received handoff from Planner Agent.
Focus: Compromised account identification

Querying successful authentications from attack IP set...
→ Cross-referencing auth success events with attack IP list
→ Identifying accounts with successful logins from flagged IPs
→ Checking for anomalous post-auth activity (data access, exports)`,
    },
  },
  {
    offsetMs: 14000,
    agentRole: 'investigator',
    type: 'tool_call_start',
    payload: {
      id: 'tc-202',
      toolName: 'esql_query',
      parameters: {
        query: `FROM logs-auth-*\n| WHERE @timestamp > NOW() - 15m\n| WHERE event.outcome = "success"\n| EVAL is_attack_ip = source.ip IN (/* attack IP set */) \n| WHERE is_attack_ip = true\n| STATS login_count = COUNT(*) BY user.id, user.email, source.ip, source.geo.country_name\n| SORT login_count DESC`,
        index: 'logs-auth-2026.02.23',
      },
    },
  },
  {
    offsetMs: 14900,
    agentRole: 'investigator',
    type: 'tool_call_complete',
    payload: {
      id: 'tc-202',
      resultSummary: '376 accounts with successful auth from attack IPs — 12 with post-auth data access',
      durationMs: 134,
    },
  },
  {
    offsetMs: 15400,
    agentRole: 'investigator',
    type: 'reasoning_text',
    payload: {
      text: `COMPROMISED ACCOUNT ANALYSIS:

Total accounts with successful auth from attack IPs: 376
  → 364 accounts: login only, no subsequent activity
  → 12 accounts: post-auth activity detected (HIGH PRIORITY)
    - 8 accounts: profile data viewed
    - 3 accounts: payment method accessed
    - 1 account: bulk data export initiated (CRITICAL — stop immediately)

Account risk classification:
  CRITICAL (immediate action): 1 account (bulk export)
  HIGH (session revoke + notify): 11 accounts
  MEDIUM (force password reset): 364 accounts

RECOMMENDED ACTIONS:
  1. Immediately terminate session for bulk-export account
  2. Force session revocation for all 376 accounts
  3. Require MFA re-enrollment for affected accounts
  4. Block all 892 attack IPs at WAF layer`,
    },
  },
  { offsetMs: 22000, agentRole: 'investigator', type: 'status_change', payload: { status: 'complete', progress: 100 } },
  { offsetMs: 22000, agentRole: 'investigator', type: 'handoff', payload: { to: 'remediator' } },

  {
    offsetMs: 15800,
    agentRole: 'correlator',
    type: 'reasoning_text',
    payload: {
      text: `Received handoff from Planner Agent.
Focus: Downstream service exposure assessment

Analyzing what data/services are accessible post-authentication...
→ Mapping auth-service permissions to downstream APIs
→ Checking rate limiting effectiveness on api-gateway
→ Assessing data exposure risk for compromised accounts`,
    },
  },
  {
    offsetMs: 17500,
    agentRole: 'correlator',
    type: 'tool_call_start',
    payload: {
      id: 'tc-203',
      toolName: 'esql_query',
      parameters: {
        query: `FROM logs-api-gateway-*\n| WHERE @timestamp > NOW() - 15m\n| WHERE user.id IN (/* compromised account IDs */)\n| STATS request_count = COUNT(*), unique_endpoints = COUNT_DISTINCT(url.path)\n  BY user.id, url.path\n| WHERE request_count > 5\n| SORT request_count DESC`,
        index: 'logs-api-gateway-2026.02.23',
      },
    },
  },
  {
    offsetMs: 18400,
    agentRole: 'correlator',
    type: 'tool_call_complete',
    payload: {
      id: 'tc-203',
      resultSummary: 'API rate limiting NOT triggered — 376 accounts each under per-account threshold',
      durationMs: 67,
    },
  },
  {
    offsetMs: 19000,
    agentRole: 'correlator',
    type: 'reasoning_text',
    payload: {
      text: `EXPOSURE ASSESSMENT:

Rate limiting gap identified:
→ Per-account rate limit: 100 req/min (not triggered)
→ Attack distributed across 376 accounts = 376 × 100 = 37,600 req/min capacity
→ Global rate limiting not configured — CRITICAL GAP

Data exposure by endpoint:
  /api/v1/user/profile:    247 requests (PII exposure risk)
  /api/v1/payment/methods: 89 requests  (financial data risk)
  /api/v1/orders/history:  134 requests (transaction data risk)
  /api/v1/export/data:     1 request    (BULK EXPORT — STOP NOW)

Compliance impact:
→ GDPR Article 33: breach notification required within 72h
→ PCI-DSS: payment method access requires immediate incident report
→ Estimated affected records: ~12,400 user records potentially viewed

Providing exposure data to Remediator for immediate containment...`,
    },
  },
  { offsetMs: 24000, agentRole: 'correlator', type: 'status_change', payload: { status: 'complete', progress: 100 } },
  { offsetMs: 24000, agentRole: 'correlator', type: 'handoff', payload: { to: 'remediator' } },

  { offsetMs: 24200, agentRole: 'remediator', type: 'status_change', payload: { status: 'thinking' } },
  {
    offsetMs: 24500,
    agentRole: 'remediator',
    type: 'reasoning_text',
    payload: {
      text: `Received threat analysis from Investigator + exposure assessment from Correlator.

Threat: Active credential stuffing — 376 compromised accounts, 1 bulk export in progress
Compliance: GDPR + PCI-DSS notification required

REMEDIATION STRATEGY (ordered by urgency):

  PHASE 1 — Immediate (< 10s)
    → KILL session for bulk-export account (user ID: usr-48291)
    → Block all 892 attack IPs at WAF layer
    → Revoke all active sessions for 376 compromised accounts

  PHASE 2 — Short-term (< 2 min)
    → Force password reset for all 376 accounts
    → Enable MFA requirement for affected accounts
    → Add global rate limit: 10,000 auth attempts/min across all accounts

  PHASE 3 — Preventive
    → Deploy credential stuffing detection rule (ML-based)
    → Add CAPTCHA trigger: > 3 failed attempts from same IP
    → Schedule GDPR breach notification (72h deadline)

Executing Elastic Workflow: sentinel-auth-containment-v3...`,
    },
  },
  {
    offsetMs: 29000,
    agentRole: 'remediator',
    type: 'tool_call_start',
    payload: {
      id: 'tc-204',
      toolName: 'elastic_workflow',
      parameters: {
        workflowId: 'sentinel-auth-containment-v3',
        incidentId: 'inc-003',
        parameters: {
          killSessionUserId: 'usr-48291',
          blockIpList: '892 IPs',
          revokeSessionUserIds: '376 accounts',
          forcePasswordReset: true,
          enableMFA: true,
          globalRateLimit: 10000,
        },
      },
    },
  },
  { offsetMs: 31000, agentRole: 'remediator', type: 'tool_call_complete', payload: { id: 'tc-204', resultSummary: 'Bulk export terminated · 892 IPs blocked · 376 sessions revoked · MFA enforced', durationMs: 0 } },
  { offsetMs: 34500, agentRole: 'remediator', type: 'status_change', payload: { status: 'complete', progress: 100 } },
  { offsetMs: 34500, agentRole: 'remediator', type: 'handoff', payload: { to: 'verifier' } },

  { offsetMs: 35000, agentRole: 'verifier', type: 'status_change', payload: { status: 'thinking' } },
  {
    offsetMs: 35300,
    agentRole: 'verifier',
    type: 'reasoning_text',
    payload: {
      text: `Received handoff from Remediator. Verifying attack containment.

Monitoring post-containment auth metrics...
→ Querying auth.failed_login_rate (last 5 minutes)
→ Verifying IP block effectiveness
→ Confirming bulk export termination`,
    },
  },
  {
    offsetMs: 38000,
    agentRole: 'verifier',
    type: 'tool_call_start',
    payload: {
      id: 'tc-205',
      toolName: 'get_anomaly_score',
      parameters: { metricNames: ['auth.failed_login_rate', 'auth.success_from_blocked_ips'], windowMinutes: 5 },
    },
  },
  {
    offsetMs: 38900,
    agentRole: 'verifier',
    type: 'tool_call_complete',
    payload: {
      id: 'tc-205',
      resultSummary: 'auth.failed_login_rate: 38/min (↓99.8%) | blocked IP attempts: 0 | anomaly_score: 1.2',
      durationMs: 71,
    },
  },
  {
    offsetMs: 39500,
    agentRole: 'verifier',
    type: 'reasoning_text',
    payload: {
      text: `POST-REMEDIATION VERIFICATION — PASS ✓

  auth.failed_login_rate:  15,667/min → 38/min  (↓ 99.8%)
  Blocked IP attempts:     892 IPs    → 0        (100% blocked)
  Active attack sessions:  376        → 0        (all revoked)
  Bulk export status:      IN PROGRESS → TERMINATED

Containment confirmed:
  ✓ Bulk data export stopped (0 records exported)
  ✓ All 892 attack IPs blocked at WAF
  ✓ 376 compromised sessions revoked
  ✓ MFA enforcement active for affected accounts
  ✓ Global rate limit deployed

Compliance actions queued:
  → GDPR Article 33 notification: scheduled (72h deadline: Feb 26)
  → PCI-DSS incident report: generated

MTTR: 0.9 minutes (from detection to containment)
Human actions required: 0 (compliance notifications queued for review)

Closing incident INC-003 as AUTO_RESOLVED.`,
    },
  },
  { offsetMs: 44000, agentRole: 'verifier', type: 'status_change', payload: { status: 'complete', progress: 100 } },
];

export const ALL_SCENARIO_SCRIPTS = [SCENARIO_0_SCRIPTS, SCENARIO_1_SCRIPTS, SCENARIO_2_SCRIPTS];
