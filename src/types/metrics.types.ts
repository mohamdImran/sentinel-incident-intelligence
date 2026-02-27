export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  isAnomaly: boolean;
  anomalyScore?: number;
}

export interface TimeSeries {
  id: string;
  metricName: string;
  displayName: string;
  unit: string;
  dataPoints: TimeSeriesPoint[];
  baseline: { mean: number; stdDev: number };
}

export interface ESQLColumn {
  name: string;
  type: 'keyword' | 'long' | 'double' | 'date' | 'boolean' | 'text';
}

export interface ESQLQueryResult {
  id: string;
  query: string;
  columns: ESQLColumn[];
  rows: Array<Record<string, unknown>>;
  totalRows: number;
  tookMs: number;
  agentExplanation?: string | null;
  timestamp: string;
}

export interface ImpactMetric {
  id: string;
  label: string;
  description: string;
  before: number;
  after: number;
  unit: string;
  improvement: string;
  trend: 'positive' | 'negative';
  icon: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  durationMs: number | null;
  output: string | null;
}

export interface ElasticWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  status: 'pending' | 'running' | 'complete' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
}
