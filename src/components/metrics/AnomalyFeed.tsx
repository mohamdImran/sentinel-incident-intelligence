import { Zap } from 'lucide-react';
import { DEMO_CONFIG } from '../../config/demo.config';
import { DEMO_INCIDENTS } from '../../data/demo-incidents';
import { useLiveRunner } from '../../store/LiveRunnerContext';

interface FeedItem {
  id: string;
  timestamp: string;
  metricName: string;
  observedValue: number;
  expectedValue: number;
  anomalyScore: number;
  serviceId: string;
  severity: string;
}

function buildDemoFeed(): FeedItem[] {
  const items: FeedItem[] = [];
  DEMO_INCIDENTS.forEach(inc => {
    inc.anomalyEvents.forEach(ae => {
      items.push({
        id: ae.id,
        timestamp: ae.timestamp,
        metricName: ae.metricName,
        observedValue: ae.observedValue,
        expectedValue: ae.expectedValue,
        anomalyScore: ae.anomalyScore,
        serviceId: ae.serviceId,
        severity: inc.severity,
      });
    });
  });
  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

const DEMO_FEED = buildDemoFeed();

function ScoreBar({ score }: { score: number }) {
  const color = score >= 90 ? '#EF4444' : score >= 70 ? '#F59E0B' : '#06B6D4';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1 rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-mono" style={{ color }}>{score.toFixed(0)}</span>
    </div>
  );
}

/** Synthesize anomaly feed items from a live incident */
function buildLiveFeed(indices: string[], totalDocs: number, detectedAt: string): FeedItem[] {
  const ts = new Date(detectedAt);
  return indices.slice(0, 6).map((idx, i) => {
    const docsPerIndex = Math.round(totalDocs / Math.max(indices.length, 1));
    const score = Math.max(60, 99 - i * 7 - Math.random() * 5);
    const observed = docsPerIndex + Math.round(Math.random() * 2000);
    const expected = Math.round(docsPerIndex * 0.7);
    return {
      id: `live-ae-${i}`,
      timestamp: new Date(ts.getTime() - i * 45000).toISOString(),
      metricName: i === 0 ? 'doc.ingestion_rate' : i === 1 ? 'index.error_rate' : `index.anomaly_score`,
      observedValue: observed,
      expectedValue: expected,
      anomalyScore: Math.round(score * 10) / 10,
      serviceId: idx.replace(/^kibana_sample_data_/, '').replace(/-\d{4}.*$/, '').slice(0, 20),
      severity: score >= 90 ? 'critical' : score >= 75 ? 'high' : 'medium',
    };
  });
}

function FeedTable({ items }: { items: FeedItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-[10px] text-text-muted uppercase tracking-wider border-b border-white/[0.06]">
            <th className="text-left px-4 py-2 font-semibold">Metric</th>
            <th className="text-left px-3 py-2 font-semibold">Service</th>
            <th className="text-right px-3 py-2 font-semibold">Observed</th>
            <th className="text-right px-3 py-2 font-semibold">Expected</th>
            <th className="text-right px-3 py-2 font-semibold">Score</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
              <td className="px-4 py-2">
                <div className="text-[11px] font-mono text-text-secondary">{item.metricName}</div>
                <div className="text-[9px] text-text-muted mt-0.5">
                  {new Date(item.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                </div>
              </td>
              <td className="px-3 py-2">
                <span className="text-[11px] font-mono text-accent-bright">{item.serviceId}</span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className="text-[11px] font-mono text-status-critical">{item.observedValue.toLocaleString()}</span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className="text-[11px] font-mono text-status-ok">{item.expectedValue.toLocaleString()}</span>
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end">
                  <ScoreBar score={item.anomalyScore} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AnomalyFeed({ className = '' }: { className?: string }) {
  if (!DEMO_CONFIG.DEMO_MODE) {
    return <LiveAnomalyFeed className={className} />;
  }

  return (
    <div className={`sentinel-card overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
        <Zap size={12} className="text-status-warning animate-pulse" />
        <span className="text-xs font-semibold text-text-primary">Live Anomaly Feed</span>
        <span className="ml-auto text-[10px] text-text-muted font-mono">Elastic ML · real-time</span>
      </div>
      <FeedTable items={DEMO_FEED} />
    </div>
  );
}

function LiveAnomalyFeed({ className }: { className: string }) {
  const { incident, status } = useLiveRunner();
  const isRunning = status === 'running' || status === 'detecting';
  const hasData = incident != null;

  const liveFeed = hasData
    ? buildLiveFeed(incident.indices, incident.totalDocs, incident.detectedAt)
    : [];

  return (
    <div className={`sentinel-card overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
        <Zap size={12} className={hasData ? 'text-status-warning animate-pulse' : 'text-text-muted'} />
        <span className="text-xs font-semibold text-text-primary">Live Anomaly Feed</span>
        {isRunning && <span className="ml-auto text-[9px] text-accent-bright bg-accent-dim px-1.5 py-0.5 rounded-full animate-pulse">scanning</span>}
        {!isRunning && hasData && <span className="ml-auto text-[10px] text-text-muted font-mono">Elasticsearch · live</span>}
      </div>
      {hasData ? (
        <FeedTable items={liveFeed} />
      ) : (
        <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
          <Zap size={16} className="text-text-muted mb-2" />
          <p className="text-[11px] text-text-muted leading-relaxed">
            {isRunning ? 'Scanning cluster for anomalies...' : 'Run the pipeline to detect anomalies'}
          </p>
        </div>
      )}
    </div>
  );
}
