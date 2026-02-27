export type AgentRole = 'planner' | 'investigator' | 'correlator' | 'remediator' | 'verifier';

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'complete' | 'error';

export type ToolName =
  | 'esql_query'
  | 'search'
  | 'elastic_workflow'
  | 'get_geo_data'
  | 'get_anomaly_score'
  | 'get_slow_queries'
  | 'create_ticket';

export interface AgentToolCall {
  id: string;
  toolName: ToolName;
  parameters: Record<string, unknown>;
  result: unknown;
  durationMs: number;
  timestamp: string;
}

export type AgentStepType = 'reasoning' | 'tool_call' | 'tool_result' | 'handoff' | 'finding';

export interface AgentStep {
  id: string;
  type: AgentStepType;
  toolName?: string;
  status?: 'running' | 'complete' | 'error';
  result?: string;
  startedAt: string;

  agentRole?: AgentRole;
  content?: string;
  handoffTo?: AgentRole;
}

export interface AgentFinding {
  id: string;
  confidence: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
  evidence: string[];
  recommendedAction: string;
}

export interface AgentState {
  id: string;
  role: AgentRole;
  status: AgentStatus;
  incidentId: string;
  steps: AgentStep[];
  currentReasoning: string;
  findings: AgentFinding[];
  startedAt: string | null;
  completedAt: string | null;
  progressPercent: number;
}

export interface MultiAgentRun {
  id: string;
  incidentId: string;
  agents: Record<AgentRole, AgentState>;
  status: 'initializing' | 'running' | 'complete' | 'failed';
  startedAt: string;
  completedAt: string | null;
  overallFinding: string | null;
}
