import { ShieldAlert, ChevronRight } from 'lucide-react';
import { useAgentStore } from '../../store/AgentStoreContext';

export function RootCauseCard({ className = '' }: { className?: string }) {
  const { state } = useAgentStore();
  const investigator = state.run.agents['investigator'];
  const isComplete = investigator.status === 'complete';

  const confidence = 97.3;

  const getConfidenceColor = (c: number) =>
    c >= 90 ? 'text-status-ok' : c >= 70 ? 'text-status-warning' : 'text-text-muted';

  return (
    <div className={`sentinel-card p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className={isComplete ? 'text-status-ok' : 'text-text-muted'} />
          <span className="text-xs font-semibold text-text-primary">Root Cause Analysis</span>
        </div>
        {isComplete && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-muted">Confidence</span>
            <span className={`text-xs font-bold font-mono ${getConfidenceColor(confidence)}`}>
              {confidence}%
            </span>
          </div>
        )}
      </div>

      {!isComplete ? (
        <div className="space-y-2">
          <div className="skeleton h-3 rounded w-3/4" />
          <div className="skeleton h-3 rounded w-full" />
          <div className="skeleton h-3 rounded w-2/3" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-status-critical/8 border border-status-critical/20 rounded-lg p-3">
            <p className="text-xs font-semibold text-status-critical mb-1">Primary Cause</p>
            <p className="text-xs text-text-secondary leading-relaxed">
              Connection pool exhaustion on <span className="font-mono text-text-accent">db-shard-03</span> triggered
              by slow queries from missing index on <span className="font-mono text-text-accent">orders.user_id</span>,
              causing full table scans on an 847M-row table.
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Evidence Chain</p>
            <div className="space-y-1.5">
              {[
                'ES|QL: avg_wait spiked 112ms → 8,420ms at 14:32:17 UTC on shard-03',
                '847 slow queries (>30s) detected in 8min window before cascade',
                'shard-03 first to breach 500/500 connection limit',
                'Cascade propagated to shards 01, 02 at 14:34:02 UTC',
                'No index found on orders.user_id column (table scan confirmed)',
              ].map((e, i) => (
                <div key={i} className="flex items-start gap-2">
                  <ChevronRight size={10} className="text-accent-cyan mt-0.5 flex-shrink-0" />
                  <span className="text-[11px] text-text-secondary">{e}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-status-ok/8 border border-status-ok/20 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-status-ok uppercase tracking-wider mb-1.5">Recommended Actions</p>
            <div className="space-y-1">
              {[
                'Restart connection pools on all 3 shards (immediate)',
                'CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id)',
                'Increase pool limit: 500 → 750 (temporary)',
                'Enable circuit breaker on orders-service DB client',
              ].map((action, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-status-ok/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-status-ok">{i + 1}</span>
                  </div>
                  <span className="text-[11px] text-text-secondary">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
