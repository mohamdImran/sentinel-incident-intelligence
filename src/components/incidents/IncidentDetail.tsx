import { useState } from 'react';
import { AlertTriangle, Clock, Server, Globe, Activity } from 'lucide-react';
import type { Incident } from '../../types/incident.types';
import { Badge } from '../ui/Badge';
import { RootCauseCard } from './RootCauseCard';
import { TimeSeriesChart } from '../charts/TimeSeriesChart';
import { DEMO_METRICS } from '../../data/demo-metrics';
import { DEMO_ESQL_RESULTS } from '../../data/demo-metrics';
import { CodeBlock } from '../ui/CodeBlock';

const SEVERITY_VARIANT = { critical: 'critical', high: 'high', medium: 'medium', low: 'low' } as const;

const TABS = ['overview', 'root-cause', 'metrics', 'queries'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  'root-cause': 'Root Cause',
  metrics: 'Metrics',
  queries: 'ES|QL Queries',
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

interface IncidentDetailProps {
  incident: Incident;
  className?: string;
}

export function IncidentDetail({ incident, className = '' }: IncidentDetailProps) {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className={`flex flex-col sentinel-card overflow-hidden ${className}`}>
      <div className="p-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className={`mt-0.5 flex-shrink-0 ${
            incident.severity === 'critical' ? 'text-status-critical' : 'text-status-warning'
          }`} />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-text-primary leading-snug">{incident.title}</h2>
            <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{incident.description}</p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <Badge variant={SEVERITY_VARIANT[incident.severity]} size="md">{incident.severity}</Badge>
              <div className="flex items-center gap-1 text-xs text-text-muted">
                <Clock size={11} />
                {timeAgo(incident.createdAt)}
              </div>
              <div className="flex items-center gap-1 text-xs text-text-muted">
                <Server size={11} />
                {incident.affectedServices.length} services
              </div>
              <div className="flex items-center gap-1 text-xs text-text-muted">
                <Globe size={11} />
                {incident.affectedRegions.join(', ')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex border-b border-white/[0.06] flex-shrink-0">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              tab === t
                ? 'text-accent-bright border-accent-cyan'
                : 'text-text-muted hover:text-text-secondary border-transparent'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'overview' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Affected Services</h3>
              <div className="flex flex-wrap gap-1.5">
                {incident.affectedServices.map(s => (
                  <span key={s} className="px-2 py-1 text-[11px] rounded-md bg-elevated border border-white/[0.06] font-mono text-text-secondary">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Anomaly Events</h3>
              <div className="space-y-2">
                {incident.anomalyEvents.map(ae => (
                  <div key={ae.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-elevated border border-white/[0.06]">
                    <Activity size={12} className="text-status-critical flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-text-primary">{ae.metricName}</span>
                        <span className="text-[10px] text-status-critical font-semibold">Score: {ae.anomalyScore.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-text-muted">
                        <span>Observed: <span className="text-status-critical font-mono">{ae.observedValue.toLocaleString()}</span></span>
                        <span>Expected: <span className="text-status-ok font-mono">{ae.expectedValue.toLocaleString()}</span></span>
                        <span className="font-mono">{new Date(ae.timestamp).toLocaleTimeString('en-US', { hour12: false })}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'root-cause' && <RootCauseCard />}

        {tab === 'metrics' && (
          <div className="space-y-4">
            {Object.entries(DEMO_METRICS).map(([key, series]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-text-secondary">{series.displayName}</span>
                  <span className="text-[10px] font-mono text-text-muted">{series.unit}</span>
                </div>
                <TimeSeriesChart series={series} height={100} />
              </div>
            ))}
          </div>
        )}

        {tab === 'queries' && (
          <div className="space-y-4">
            {DEMO_ESQL_RESULTS.map(result => (
              <div key={result.id} className="space-y-2">
                <CodeBlock code={result.query} language="esql" />
                {result.agentExplanation && (
                  <div className="flex gap-2 p-2.5 rounded-lg bg-accent-dim border border-accent-cyan/20">
                    <span className="text-[9px] font-bold text-accent-bright uppercase tracking-widest flex-shrink-0 mt-0.5">AI</span>
                    <p className="text-[11px] text-text-secondary leading-relaxed">{result.agentExplanation}</p>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] font-mono">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        {result.columns.map(col => (
                          <th key={col.name} className="text-left px-2 py-1.5 text-text-muted font-semibold uppercase tracking-wider">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                          {result.columns.map(col => (
                            <td key={col.name} className="px-2 py-1.5 text-text-secondary">
                              {String(row[col.name] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-[10px] text-text-muted text-right">
                  {result.totalRows} rows · {result.tookMs}ms
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
