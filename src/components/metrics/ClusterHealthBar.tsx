import { useEffect, useRef, useState } from 'react';
import { Server } from 'lucide-react';
import { DEMO_CONFIG } from '../../config/demo.config';
import { fetchIndexHealth, isLiveElasticsearchConfigured, type IndexHealth } from '../../lib/elasticsearch';

interface ServiceDisplay {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  requests: string;
  errorRate: string;
}

const DEMO_SERVICES: ServiceDisplay[] = [
  { name: 'api-gateway', status: 'degraded', requests: '47.2K/s', errorRate: '18.4%' },
  { name: 'orders', status: 'down', requests: '12.8K/s', errorRate: '84.7%' },
  { name: 'payment', status: 'degraded', requests: '3.4K/s', errorRate: '41.2%' },
  { name: 'inventory', status: 'degraded', requests: '8.9K/s', errorRate: '31.8%' },
  { name: 'user', status: 'degraded', requests: '24.1K/s', errorRate: '18.5%' },
  { name: 'cdn', status: 'healthy', requests: '142K/s', errorRate: '0.1%' },
  { name: 'auth', status: 'healthy', requests: '31.2K/s', errorRate: '0.3%' },
  { name: 'notifications', status: 'healthy', requests: '5.6K/s', errorRate: '0.2%' },
];

const STATUS_COLORS = {
  healthy: '#10B981',
  degraded: '#F59E0B',
  down: '#EF4444',
};

function indexToService(idx: IndexHealth, i: number): ServiceDisplay {
  const status: ServiceDisplay['status'] =
    idx.status === 'green' ? 'healthy' : idx.status === 'yellow' ? 'degraded' : 'down';
  const rawName = idx.name
    .replace(/^(metrics-|logs-|traces-|kibana_sample_data_)/, '')
    .replace(/-\d{4}\.\d{2}\.\d{2}$/, '') 
    .slice(0, 22) || `index-${i}`;
  return {
    name: rawName,
    status,
    requests: idx.docsCount >= 1000 ? `${(idx.docsCount / 1000).toFixed(1)}K docs` : `${idx.docsCount} docs`,
    errorRate: idx.status === 'red' ? '—' : idx.status === 'yellow' ? 'warn' : 'ok',
  };
}

export function ClusterHealthBar({ className = '' }: { className?: string }) {
  const [services, setServices] = useState<ServiceDisplay[]>(
    DEMO_CONFIG.DEMO_MODE ? DEMO_SERVICES : []
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (DEMO_CONFIG.DEMO_MODE || !isLiveElasticsearchConfigured()) return;

    async function refresh() {
      try {
        const indices = await fetchIndexHealth();
        setServices(indices.slice(0, 8).map((idx, i) => indexToService(idx, i)));
      } catch {
        
      }
    }

    refresh();
    intervalRef.current = setInterval(refresh, 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const healthy = services.filter(s => s.status === 'healthy').length;
  const degraded = services.filter(s => s.status === 'degraded').length;
  const down = services.filter(s => s.status === 'down').length;

  if (!DEMO_CONFIG.DEMO_MODE && services.length === 0) {
    return (
      <div className={`sentinel-card p-4 flex items-center justify-center ${className}`}>
        <div className="text-center">
          <Server size={18} className="text-text-muted mx-auto mb-2" />
          <p className="text-xs text-text-muted">Connecting to Elasticsearch...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`sentinel-card p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server size={13} className="text-text-muted" />
          <span className="text-xs font-semibold text-text-primary">
            {DEMO_CONFIG.DEMO_MODE ? 'Service Health' : 'Index Health'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-status-ok"><span className="w-1.5 h-1.5 rounded-full bg-status-ok inline-block" />{healthy}</span>
          <span className="flex items-center gap-1 text-status-warning"><span className="w-1.5 h-1.5 rounded-full bg-status-warning inline-block" />{degraded}</span>
          <span className="flex items-center gap-1 text-status-critical"><span className="w-1.5 h-1.5 rounded-full bg-status-critical inline-block" />{down}</span>
        </div>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
        {services.map((s, i) => (
          <div
            key={`bar-${i}`}
            className="flex-1 rounded-sm transition-all duration-500"
            style={{ backgroundColor: STATUS_COLORS[s.status] }}
            title={`${s.name}: ${s.status}`}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1">
        {services.slice(0, 4).map((s, i) => (
          <div key={`grid-${i}`} className="flex flex-col">
            <div className="flex items-center gap-1 mb-0.5">
              <div className="w-1 h-1 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.status] }} />
              <span className="text-[9px] text-text-muted truncate">{s.name}</span>
            </div>
            <span className={`text-[9px] font-mono pl-2 ${s.status === 'down' ? 'text-status-critical' : s.status === 'degraded' ? 'text-status-warning' : 'text-status-ok'}`}>
              {s.errorRate}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
