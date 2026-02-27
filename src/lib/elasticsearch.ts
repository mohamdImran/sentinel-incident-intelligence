import type { ESQLQueryResult } from '../types/metrics.types';
import { getConnectionConfig, proxyFetch } from './connectionStore';

function esHeaders() {
  const { esApiKey } = getConnectionConfig();
  return {
    'Content-Type': 'application/json',
    'Authorization': `ApiKey ${esApiKey}`,
  };
}

function esUrl(): string {
  return getConnectionConfig().esUrl;
}

/**
 * Execute an ES|QL query against a real Elasticsearch cluster.
 * Uses the /_query endpoint (Elasticsearch 8.11+).
 */
export async function runEsqlQuery(esql: string): Promise<ESQLQueryResult> {
  if (!esUrl()) throw new Error('Elasticsearch URL is not configured');

  const startMs = Date.now();
  const response = await proxyFetch(esUrl(), '/_query', {
    method: 'POST',
    headers: esHeaders(),
    body: JSON.stringify({ query: esql }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Elasticsearch error ${response.status}: ${err}`);
  }

  const tookMs = Date.now() - startMs;
  const data = await response.json();

  const columns: ESQLQueryResult['columns'] = (data.columns ?? []).map(
    (c: { name: string; type: string }) => ({ name: c.name, type: c.type })
  );
  const rows: ESQLQueryResult['rows'] = (data.values ?? []).map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col.name] = row[i]; });
    return obj;
  });

  return {
    id: `live-${Date.now()}`,
    query: esql,
    columns,
    rows,
    totalRows: rows.length,
    tookMs,
    agentExplanation: null,
    timestamp: new Date().toISOString(),
  };
}

/** Returns true when a real ES URL + API key are configured */
export function isLiveElasticsearchConfigured(): boolean {
  const { esUrl, esApiKey } = getConnectionConfig();
  return Boolean(esUrl && esApiKey);
}



export interface ClusterStats {
  clusterName: string;
  docsPerSec: number;
  shardCount: number;
  nodeCount: number;
  indexCount: number;
  status: 'green' | 'yellow' | 'red';
}

export interface IndexHealth {
  name: string;
  status: 'green' | 'yellow' | 'red';
  docsCount: number;
  shards: number;
}

export async function fetchClusterStats(): Promise<ClusterStats> {
  const res = await proxyFetch(esUrl(), '/_cluster/health', { headers: esHeaders() });
  if (!res.ok) throw new Error(`Cluster health error ${res.status}`);
  const d = await res.json();
  return {
    clusterName: d.cluster_name ?? 'elasticsearch',
    docsPerSec: 0,
    shardCount: (d.active_shards ?? 0),
    nodeCount: d.number_of_nodes ?? 0,
    indexCount: 0,
    status: d.status ?? 'green',
  };
}

export async function fetchIndexHealth(): Promise<IndexHealth[]> {
  const res = await proxyFetch(
    esUrl(),
    '/_cat/indices?format=json&h=index,health,docs.count,pri',
    { headers: esHeaders() }
  );
  if (!res.ok) throw new Error(`Index health error ${res.status}`);
  const data: Array<{ index: string; health: string; 'docs.count': string; pri: string }> = await res.json();
  return data
    .filter(d => !d.index.startsWith('.'))
    .map(d => ({
      name: d.index,
      status: (d.health as 'green' | 'yellow' | 'red') ?? 'green',
      docsCount: parseInt(d['docs.count'] ?? '0', 10) || 0,
      shards: parseInt(d.pri ?? '1', 10) || 1,
    }))
    .sort((a, b) => b.docsCount - a.docsCount)
    .slice(0, 20);
}

export async function fetchIndexingRate(): Promise<number> {
  const res = await proxyFetch(
    esUrl(),
    '/_nodes/stats/indices/indexing',
    { headers: esHeaders() }
  );
  if (!res.ok) return 0;
  const d = await res.json();
  const nodes: Record<string, { indices?: { indexing?: { index_total?: number } } }> =
    d.nodes ?? {};
  const total = Object.values(nodes).reduce(
    (sum, n) => sum + (n.indices?.indexing?.index_total ?? 0), 0
  );
  return total;
}
