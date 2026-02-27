import { useState, useEffect } from 'react';
import { Globe, AlertTriangle, CheckCircle, Activity, Wifi, RefreshCw, Loader2 } from 'lucide-react';
import { GeoMap } from '../components/charts/GeoMap';
import { DEMO_GEO_NODES } from '../data/demo-geo';
import { Badge } from '../components/ui/Badge';
import { DEMO_CONFIG } from '../config/demo.config';
import { proxyFetch } from '../lib/connectionStore';
import { getConnectionConfig, isEnvConfigured, hasConnectionConfig } from '../lib/connectionStore';
import type { GeoNode } from '../types/incident.types';


const REGION_COORDS: Record<string, [number, number]> = {
  'us-east-1': [39.0, -77.5], 'us-east-2': [40.0, -82.9],
  'us-west-1': [37.3, -121.9], 'us-west-2': [45.5, -122.7],
  'eu-west-1': [53.3, -6.3], 'eu-west-2': [51.5, -0.1],
  'eu-west-3': [48.9, 2.3], 'eu-central-1': [50.1, 8.7],
  'eu-north-1': [59.3, 18.1], 'eu-south-1': [45.5, 9.2],
  'ap-southeast-1': [1.3, 103.8], 'ap-southeast-2': [-33.9, 151.2],
  'ap-northeast-1': [35.7, 139.7], 'ap-northeast-2': [37.6, 126.9],
  'ap-northeast-3': [34.7, 135.5], 'ap-south-1': [19.1, 72.9],
  'ap-east-1': [22.3, 114.2], 'ca-central-1': [45.5, -73.6],
  'sa-east-1': [-23.5, -46.6], 'me-south-1': [26.1, 50.6],
  'af-south-1': [-33.9, 18.4],
  
  'us-central1': [41.3, -88.8], 'us-east1': [33.2, -80.0],
  'us-east4': [38.9, -77.0], 'us-west1': [45.6, -122.4],
  'us-west2': [34.1, -118.2], 'us-west3': [40.8, -111.9],
  'us-west4': [36.2, -115.1], 'northamerica-northeast1': [45.5, -73.6],
  'southamerica-east1': [-23.5, -46.6], 'europe-west1': [50.4, 3.7],
  'europe-west2': [51.5, -0.1], 'europe-west3': [50.1, 8.7],
  'europe-west4': [53.4, 6.8], 'europe-west6': [47.4, 8.5],
  'europe-north1': [60.6, 27.2], 'asia-east1': [24.1, 120.7],
  'asia-east2': [22.3, 114.2], 'asia-northeast1': [35.7, 139.7],
  'asia-northeast2': [34.7, 135.5], 'asia-northeast3': [37.6, 126.9],
  'asia-south1': [19.1, 72.9], 'asia-southeast1': [1.3, 103.8],
  'asia-southeast2': [-6.2, 106.8], 'australia-southeast1': [-33.9, 151.2],
};

function guessCoords(name: string): [number, number] | null {
  const lower = name.toLowerCase();
  for (const [region, coords] of Object.entries(REGION_COORDS)) {
    if (lower.includes(region.toLowerCase())) return coords;
  }
  return null;
}


async function fetchLiveNodes(): Promise<GeoNode[]> {
  const { esUrl, esApiKey } = getConnectionConfig();
  if (!esUrl || !esApiKey) return [];

  const headers = { Authorization: `ApiKey ${esApiKey}`, 'Content-Type': 'application/json' };

  const [healthRes, nodesRes] = await Promise.all([
    proxyFetch(esUrl, '/_cluster/health', { headers }),
    proxyFetch(esUrl, '/_nodes/stats/indices,os?filter_path=nodes.*.name,nodes.*.roles,nodes.*.os,nodes.*.indices,nodes.*.attributes', { headers }),
  ]);

  if (!healthRes.ok || !nodesRes.ok) return [];

  const health = await healthRes.json();
  const nodesData = await nodesRes.json();
  const clusterStatus: 'green' | 'yellow' | 'red' = health.status ?? 'green';

  const nodes: GeoNode[] = [];
  let idx = 0;

  for (const [, node] of Object.entries(nodesData.nodes ?? {}) as [string, Record<string, unknown>][]) {
    const name = (node.name as string) ?? `node-${idx}`;
    const attrs = (node.attributes as Record<string, string>) ?? {};
    const region = attrs['cloud.region'] ?? attrs['region'] ?? attrs['zone'] ?? '';
    const coords = guessCoords(region) ?? guessCoords(name);

    
    const [lat, lon] = coords ?? [
      20 + (idx % 5) * 15 - 30,
      -60 + Math.floor(idx / 5) * 40,
    ];

    const indices = node.indices as Record<string, unknown> ?? {};
    const indexingTotal = ((indices.indexing as Record<string, number>)?.index_total ?? 0);
    const docsCount = ((indices.docs as Record<string, number>)?.count ?? 0);

    
    const roles = (node.roles as string[]) ?? [];
    const isMaster = roles.includes('master');
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (clusterStatus === 'red' && isMaster) status = 'down';
    else if (clusterStatus === 'yellow') status = 'degraded';

    nodes.push({
      id: name,
      region: region || 'unknown',
      displayName: name,
      lat,
      lon,
      status,
      errorRate: clusterStatus === 'red' ? 0.5 : clusterStatus === 'yellow' ? 0.05 : 0.002,
      latencyP99: clusterStatus === 'red' ? 5000 : clusterStatus === 'yellow' ? 800 : 120,
      activeConnections: Math.min(docsCount > 0 ? Math.floor(indexingTotal / 100) + 10 : 10, 500),
      affectedByIncidentId: clusterStatus !== 'green' ? 'live' : null,
    });
    idx++;
  }

  return nodes;
}

export function GeoPage() {
  const isDemoMode = DEMO_CONFIG.DEMO_MODE;
  const [liveNodes, setLiveNodes] = useState<GeoNode[]>([]);
  const [loading, setLoading] = useState(!isDemoMode);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    if (isDemoMode) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const nodes = await fetchLiveNodes();
        if (cancelled) return;
        if (nodes.length > 0) {
          setLiveNodes(nodes);
          setUsingFallback(false);
        } else {
          
          setLiveNodes(DEMO_GEO_NODES);
          setUsingFallback(true);
        }
        setLastUpdated(new Date().toLocaleTimeString('en-US', { hour12: false }));
      } catch {
        if (!cancelled) {
          setLiveNodes(DEMO_GEO_NODES);
          setUsingFallback(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isDemoMode]);

  const nodes = isDemoMode ? DEMO_GEO_NODES : liveNodes;
  const down = nodes.filter(n => n.status === 'down');
  const degraded = nodes.filter(n => n.status === 'degraded');
  const healthy = nodes.filter(n => n.status === 'healthy');

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        <div className="sentinel-card p-3 flex items-center gap-3">
          <AlertTriangle size={18} className="text-status-critical" />
          <div>
            <div className="text-lg font-bold font-mono text-status-critical">{down.length}</div>
            <div className="text-[10px] text-text-muted">Nodes Down</div>
          </div>
        </div>
        <div className="sentinel-card p-3 flex items-center gap-3">
          <Activity size={18} className="text-status-warning" />
          <div>
            <div className="text-lg font-bold font-mono text-status-warning">{degraded.length}</div>
            <div className="text-[10px] text-text-muted">Degraded</div>
          </div>
        </div>
        <div className="sentinel-card p-3 flex items-center gap-3">
          <CheckCircle size={18} className="text-status-ok" />
          <div>
            <div className="text-lg font-bold font-mono text-status-ok">{healthy.length}</div>
            <div className="text-[10px] text-text-muted">Healthy</div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 sentinel-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
          <Globe size={13} className="text-accent-cyan" />
          <span className="text-xs font-semibold text-text-primary">Global Node Distribution</span>
          {!isDemoMode && (
            <div className="flex items-center gap-1.5 ml-2">
              {usingFallback
                ? <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">demo overlay</span>
                : <span className="flex items-center gap-1 text-[10px] text-status-ok"><Wifi size={8} /> live</span>
              }
            </div>
          )}
          <span className="ml-auto text-[10px] text-text-muted flex items-center gap-1.5">
            {loading && <Loader2 size={9} className="animate-spin" />}
            {nodes.length} nodes
            {lastUpdated && !isDemoMode && <span className="text-text-muted">· {lastUpdated}</span>}
          </span>
        </div>
        {loading && nodes.length === 0
          ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={20} className="text-accent-cyan animate-spin" />
            </div>
          )
          : <GeoMap nodes={nodes} width={900} height={380} className="w-full h-full" />
        }
      </div>

      {/* Node table */}
      <div className="flex-shrink-0 sentinel-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
          <span className="text-xs font-semibold text-text-primary">Node Status</span>
          {usingFallback && !isDemoMode && (
            <span className="text-[10px] text-text-muted ml-1">— showing demo data (no geo data in cluster)</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] text-text-muted uppercase tracking-wider border-b border-white/[0.06]">
                <th className="text-left px-4 py-2 font-semibold">Node</th>
                <th className="text-left px-3 py-2 font-semibold">Region</th>
                <th className="text-left px-3 py-2 font-semibold">Status</th>
                <th className="text-right px-3 py-2 font-semibold">Error Rate</th>
                <th className="text-right px-3 py-2 font-semibold">P99 Latency</th>
                <th className="text-right px-3 py-2 font-semibold">Connections</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map(node => (
                <tr key={node.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-2 text-[11px] font-mono text-text-secondary">{node.displayName}</td>
                  <td className="px-3 py-2 text-[11px] font-mono text-text-muted">{node.region}</td>
                  <td className="px-3 py-2">
                    <Badge variant={node.status === 'healthy' ? 'ok' : node.status === 'degraded' ? 'medium' : 'critical'}>
                      {node.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`text-[11px] font-mono ${node.errorRate > 0.1 ? 'text-status-critical' : node.errorRate > 0.01 ? 'text-status-warning' : 'text-status-ok'}`}>
                      {(node.errorRate * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`text-[11px] font-mono ${node.latencyP99 > 1000 ? 'text-status-critical' : 'text-text-secondary'}`}>
                      {node.latencyP99 >= 1000 ? `${(node.latencyP99 / 1000).toFixed(1)}s` : `${node.latencyP99}ms`}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-[11px] font-mono text-text-secondary">{node.activeConnections}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
