export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'investigating' | 'remediating' | 'resolved' | 'auto_resolved';

export interface GeoNode {
  id: string;
  region: string;
  displayName: string;
  lat: number;
  lon: number;
  status: 'healthy' | 'degraded' | 'down';
  errorRate: number;
  latencyP99: number;
  activeConnections: number;
  affectedByIncidentId: string | null;
}

export interface AnomalyEvent {
  id: string;
  timestamp: string;
  metricName: string;
  index: string;
  observedValue: number;
  expectedValue: number;
  anomalyScore: number;
  geoNodeId: string | null;
  serviceId: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedServices: string[];
  affectedRegions: string[];
  anomalyEvents: AnomalyEvent[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  mttrMinutes: number | null;
  agentRunId: string | null;
}
