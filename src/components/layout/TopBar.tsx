import { useEffect, useRef, useState } from 'react';
import { Activity, Bell, Database, Cpu } from 'lucide-react';
import { DEMO_CONFIG } from '../../config/demo.config';
import {
  fetchClusterStats,
  isLiveElasticsearchConfigured,
  type ClusterStats,
} from '../../lib/elasticsearch';

interface TopBarProps {
  title: string;
  subtitle?: string;
}

const DEMO_STATS = { clusterName: 'production-k8s', docsPerSec: 847, shardCount: 12 };

export function TopBar({ title, subtitle }: TopBarProps) {
  const [stats, setStats] = useState(DEMO_STATS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (DEMO_CONFIG.DEMO_MODE || !isLiveElasticsearchConfigured()) return;

    async function refresh() {
      try {
        const clusterStats = await fetchClusterStats();
        setStats({
          clusterName: clusterStats.clusterName,
          docsPerSec: 0,
          shardCount: clusterStats.shardCount,
        });
      } catch {
        
      }
    }

    refresh();
    intervalRef.current = setInterval(refresh, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <header className="h-12 flex items-center px-5 border-b border-white/[0.06] bg-surface/80 backdrop-blur-sm flex-shrink-0">
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-text-primary truncate">{title}</h1>
        {subtitle && <p className="text-xs text-text-muted truncate">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4 ml-4 flex-shrink-0">
        <div className="hidden md:flex items-center gap-3 text-xs text-text-muted">
          <div className="flex items-center gap-1.5">
            <Database size={11} className="text-accent-cyan" />
            <span className="font-mono">{stats.clusterName}</span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            <Activity size={11} className="text-status-ok" />
            <span className="font-mono text-status-ok">
              {DEMO_CONFIG.DEMO_MODE ? '847 docs/s' : `${stats.shardCount} shards`}
            </span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            <Cpu size={11} className="text-accent-cyan" />
            <span className="font-mono">{DEMO_CONFIG.DEMO_MODE ? '12 nodes' : 'live'}</span>
          </div>
        </div>

        <div className="relative">
          <button className="relative p-1.5 rounded-md hover:bg-white/5 transition-colors text-text-muted hover:text-text-secondary">
            <Bell size={15} />
            <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-status-critical rounded-full border border-surface" />
          </button>
        </div>
      </div>
    </header>
  );
}
