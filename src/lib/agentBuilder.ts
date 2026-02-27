/**
 * Elastic Agent Builder API client
 * Docs: https://www.elastic.co/docs/solutions/search/agent-builder/kibana-api
 */

import { getConnectionConfig, proxyFetch } from './connectionStore';

function kibanaUrl(): string {
  return getConnectionConfig().kibanaUrl;
}

function kibanaHeaders() {
  const { kibanaApiKey } = getConnectionConfig();
  return {
    'Content-Type': 'application/json',
    'Authorization': `ApiKey ${kibanaApiKey}`,
    'kbn-xsrf': 'true',
  };
}

export function isAgentBuilderConfigured(): boolean {
  const { kibanaUrl, kibanaApiKey } = getConnectionConfig();
  return Boolean(kibanaUrl && kibanaApiKey);
}



export interface AgentBuilderTool {
  id: string;
  type: 'builtin' | 'esql' | 'index_search' | string;
  description: string;
  tags: string[];
  readonly?: boolean;
  schema?: Record<string, unknown>;
  configuration: {
    query?: string;
    pattern?: string;
    /** ES|QL params — type must be a valid ES field type */
    params?: Record<string, {
      type: 'text' | 'keyword' | 'long' | 'integer' | 'double' | 'float' | 'boolean' | 'date' | 'object' | 'nested';
      description: string;
    }>;
    [key: string]: unknown;
  };
}

export interface AgentBuilderAgent {
  id: string;
  name: string;
  description: string;
  labels: string[];
  avatar_color: string;
  avatar_symbol: string;
  configuration: {
    instructions: string;
    tools: Array<{ tool_ids: string[] }>;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  steps?: ConverseStep[];
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content: string;
}



export interface ToolExecuteResult {
  results: Array<{
    type: 'tabular_data' | 'resource' | 'query' | 'error' | string;
    data: unknown;
    tool_result_id?: string;
  }>;
}

export async function listTools(): Promise<AgentBuilderTool[]> {
  const res = await proxyFetch(kibanaUrl(), `/api/agent_builder/tools`, {
    headers: kibanaHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to list tools: ${res.status}`);
  const data = await res.json();
  const raw = Array.isArray(data) ? data
    : Array.isArray(data.results) ? data.results
    : Array.isArray(data.tools) ? data.tools
    : Array.isArray(data.items) ? data.items
    : [];
  return raw as AgentBuilderTool[];
}

export async function getTool(toolId: string): Promise<AgentBuilderTool> {
  const res = await proxyFetch(kibanaUrl(), `/api/agent_builder/tools/${encodeURIComponent(toolId)}`, {
    headers: kibanaHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get tool: ${res.status}`);
  return res.json();
}

export async function createTool(tool: Omit<AgentBuilderTool, 'readonly' | 'schema'>): Promise<AgentBuilderTool> {
  const res = await proxyFetch(kibanaUrl(), `/api/agent_builder/tools`, {
    method: 'POST',
    headers: kibanaHeaders(),
    body: JSON.stringify(tool),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create tool: ${res.status} — ${err}`);
  }
  return res.json();
}

export async function updateTool(toolId: string, tool: Partial<AgentBuilderTool>): Promise<AgentBuilderTool> {
  const res = await proxyFetch(kibanaUrl(), `/api/agent_builder/tools/${encodeURIComponent(toolId)}`, {
    method: 'PUT',
    headers: kibanaHeaders(),
    body: JSON.stringify(tool),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update tool: ${res.status} — ${err}`);
  }
  return res.json();
}

export async function deleteTool(toolId: string): Promise<void> {
  const res = await proxyFetch(kibanaUrl(), `/api/agent_builder/tools/${encodeURIComponent(toolId)}`, {
    method: 'DELETE',
    headers: kibanaHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete tool: ${res.status}`);
}

export async function executeTool(
  toolId: string,
  params: Record<string, unknown>
): Promise<ToolExecuteResult> {
  const res = await proxyFetch(kibanaUrl(), `/api/agent_builder/tools/_execute`, {
    method: 'POST',
    headers: kibanaHeaders(),
    body: JSON.stringify({ tool_id: toolId, params }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to execute tool: ${res.status} — ${err}`);
  }
  return res.json();
}



function normalizeAgent(a: Partial<AgentBuilderAgent> & { id: string; name: string }): AgentBuilderAgent {
  return {
    id: a.id,
    name: a.name,
    description: a.description ?? '',
    labels: Array.isArray(a.labels) ? a.labels : [],
    avatar_color: a.avatar_color ?? '#06B6D4',
    avatar_symbol: a.avatar_symbol ?? a.name.slice(0, 2).toUpperCase(),
    configuration: a.configuration ?? { instructions: '', tools: [] },
  };
}

export async function listAgents(): Promise<AgentBuilderAgent[]> {
  const res = await proxyFetch(kibanaUrl(), `/api/agent_builder/agents`, {
    headers: kibanaHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to list agents: ${res.status}`);
  const data = await res.json();
  const raw: AgentBuilderAgent[] = Array.isArray(data) ? data
    : Array.isArray(data.agents) ? data.agents
    : Array.isArray(data.items) ? data.items
    : Array.isArray(data.results) ? data.results
    : [];
  
  return raw.map(normalizeAgent);
}

export async function createAgent(agent: Omit<AgentBuilderAgent, never>): Promise<AgentBuilderAgent> {
  const res = await proxyFetch(kibanaUrl(), `/api/agent_builder/agents`, {
    method: 'POST',
    headers: kibanaHeaders(),
    body: JSON.stringify(agent),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create agent: ${res.status} — ${err}`);
  }
  return normalizeAgent(await res.json());
}

export async function deleteAgent(id: string): Promise<void> {
  const res = await proxyFetch(kibanaUrl(), `/api/agent_builder/agents/${id}`, {
    method: 'DELETE',
    headers: kibanaHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete agent: ${res.status}`);
}



export interface KibanaConnector {
  id: string;
  name: string;
  connector_type_id: string;
  is_preconfigured: boolean;
  is_deprecated: boolean;
  config?: {
    provider?: string;
    taskType?: string;
    providerConfig?: { model_id?: string };
  };
}


export async function listConnectors(): Promise<KibanaConnector[]> {
  const res = await proxyFetch(kibanaUrl(), `/api/actions/connectors`, {
    headers: kibanaHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to list connectors: ${res.status}`);
  const data: KibanaConnector[] = await res.json();
  
  return data.filter(
    c => c.connector_type_id === '.inference' && c.config?.taskType === 'chat_completion'
  );
}



export interface AgentConversation {
  id: string;
  title: string;
  agent_id: string;
  created_at: string;
  updated_at: string;
  user?: { username: string };
  rounds?: Array<{
    id: string;
    input: { message: string };
    steps: ConverseStep[];
    response: { message: string };
  }>;
}

export interface ConversationAttachment {
  id: string;
  type: string;
  active: boolean;
  description?: string;
  current_version: number;
  versions: Array<{
    data: unknown;
    version: number;
    created_at: string;
    content_hash?: string;
    estimated_tokens?: number;
  }>;
}

/** List all conversations, optionally filtered by agent */
export async function listConversations(agentId?: string): Promise<AgentConversation[]> {
  const path = agentId
    ? `/api/agent_builder/conversations?agent_id=${encodeURIComponent(agentId)}`
    : `/api/agent_builder/conversations`;
  const res = await proxyFetch(kibanaUrl(), path, { headers: kibanaHeaders() });
  if (!res.ok) throw new Error(`Failed to list conversations: ${res.status}`);
  const data = await res.json();
  const raw = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : [];
  return raw as AgentConversation[];
}

/** Get a single conversation by ID */
export async function getConversation(conversationId: string): Promise<AgentConversation> {
  const res = await proxyFetch(
    kibanaUrl(),
    `/api/agent_builder/conversations/${encodeURIComponent(conversationId)}`,
    { headers: kibanaHeaders() }
  );
  if (!res.ok) throw new Error(`Failed to get conversation: ${res.status}`);
  return res.json();
}

/** Create an attachment on a conversation (e.g. screen context, JSON data) */
export async function createAttachment(
  conversationId: string,
  attachment: {
    type: string;
    data: unknown;
    description?: string;
    hidden?: boolean;
    id?: string;
  }
): Promise<ConversationAttachment> {
  const res = await proxyFetch(
    kibanaUrl(),
    `/api/agent_builder/conversations/${encodeURIComponent(conversationId)}/attachments`,
    {
      method: 'POST',
      headers: kibanaHeaders(),
      body: JSON.stringify(attachment),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create attachment: ${res.status} — ${err}`);
  }
  const data = await res.json();
  return (data.attachment ?? data) as ConversationAttachment;
}



export interface ConverseStep {
  type: 'reasoning' | 'tool_call' | 'tool_result' | string;
  reasoning?: string;
  transient?: boolean;
  tool_id?: string;
  tool_call_id?: string;
  params?: Record<string, unknown>;
  results?: unknown[];
  progression?: Array<{ message: string }>;
}

export interface ConverseResponse {
  steps: ConverseStep[];
  response: { message: string };
  conversation_id: string;
}

/**
 * Callback fired incrementally as SSE events arrive.
 * Lets the UI update in real-time while the agent is thinking.
 */
export interface ConverseCallbacks {
  onConversationId?: (id: string) => void;
  onReasoning?: (text: string, transient: boolean) => void;
  onToolCall?: (toolId: string, params: Record<string, unknown>) => void;
  onToolProgress?: (toolCallId: string, message: string) => void;
  onMessageChunk?: (chunk: string) => void;
  onDone?: (response: ConverseResponse) => void;
}

/**
 * Parse a raw SSE stream from /api/agent_builder/converse/async.
 * Fires callbacks as events arrive and resolves with the assembled ConverseResponse.
 */
async function parseSSEStream(
  res: Response,
  callbacks: ConverseCallbacks = {},
  signal?: AbortSignal
): Promise<ConverseResponse> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

    let buffer = '';
    const steps: ConverseStep[] = [];
  let finalMessage = '';
  let conversationId = '';
  
  const pendingToolCalls: Record<string, ConverseStep> = {};

  const processEvent = (eventType: string, dataStr: string) => {
    let data: Record<string, unknown>;
    try {
      const parsed = JSON.parse(dataStr);
      
      data = (parsed?.data ?? parsed) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (eventType) {
      case 'conversation_id_set':
      case 'conversation_created': {
        const id = (data.conversation_id ?? data.id) as string;
        if (id) {
          conversationId = id;
          callbacks.onConversationId?.(id);
        }
        break;
      }
      case 'reasoning': {
        const text = data.reasoning as string;
        const transient = Boolean(data.transient);
        if (text) {
          
          if (!transient) {
            steps.push({ type: 'reasoning', reasoning: text });
          }
          callbacks.onReasoning?.(text, transient);
        }
        break;
      }
      case 'tool_call': {
        const step: ConverseStep = {
          type: 'tool_call',
          tool_id: data.tool_id as string,
          tool_call_id: data.tool_call_id as string,
          params: (data.params ?? {}) as Record<string, unknown>,
          progression: [],
        };
        steps.push(step);
        if (step.tool_call_id) pendingToolCalls[step.tool_call_id] = step;
        callbacks.onToolCall?.(step.tool_id ?? '', step.params ?? {});
        break;
      }
      case 'tool_progress': {
        const tcId = data.tool_call_id as string;
        const msg = data.message as string;
        if (tcId && pendingToolCalls[tcId]) {
          pendingToolCalls[tcId].progression!.push({ message: msg });
        }
        callbacks.onToolProgress?.(tcId, msg);
        break;
      }
      case 'tool_result': {
        const tcId = data.tool_call_id as string;
        if (tcId && pendingToolCalls[tcId]) {
          pendingToolCalls[tcId].results = data.results as unknown[];
        }
        break;
      }
      case 'message_chunk': {
        const chunk = data.text_chunk as string;
        if (chunk) {
          finalMessage += chunk;
          callbacks.onMessageChunk?.(chunk);
        }
        break;
      }
      case 'message_complete': {
        const content = data.message_content as string;
        if (content) finalMessage = content;
        break;
      }
    }
  };

  
  signal?.addEventListener('abort', () => { reader.cancel(); });

  
  while (true) {
    if (signal?.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const lines = part.split('\n');
      let eventType = 'message';
      let dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
        }
      }

      if (dataLines.length) {
        processEvent(eventType, dataLines.join(''));
      }
    }
  }

  const result: ConverseResponse = {
    steps,
    response: { message: finalMessage },
    conversation_id: conversationId,
  };

  callbacks.onDone?.(result);
  return result;
}

/**
 * Send a message to an Agent Builder agent via the SSE async endpoint.
 * Endpoint: POST /api/agent_builder/converse/async
 * Body: { input, agent_id, connector_id?, conversation_id? }
 */
export async function converseWithAgent(
  agentId: string,
  message: string,
  conversationId?: string,
  connectorId?: string,
  callbacks: ConverseCallbacks = {},
  signal?: AbortSignal
): Promise<ConverseResponse> {
  const body: Record<string, unknown> = { input: message, agent_id: agentId };
  if (conversationId) body.conversation_id = conversationId;
  if (connectorId) body.connector_id = connectorId;

  const res = await proxyFetch(kibanaUrl(), `/api/agent_builder/converse/async`, {
    method: 'POST',
    headers: kibanaHeaders(),
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Agent error ${res.status}: ${err}`);
  }

  return parseSSEStream(res, callbacks, signal);
}




export const SENTINEL_AGENT_DEFINITION: Omit<AgentBuilderAgent, never> = {
  id: 'sentinel-incident-responder',
  name: 'SENTINEL Incident Responder',
  description:
    'Autonomous incident response agent. Analyzes Elasticsearch metrics and logs to identify root causes, map blast radius, and recommend remediation steps.',
  labels: ['incident-response', 'sentinel', 'ops'],
  avatar_color: '#06B6D4',
  avatar_symbol: 'SR',
  configuration: {
    instructions: `You are SENTINEL, an autonomous incident response agent connected to Elasticsearch.

When given an incident description, you:
1. Query relevant metrics indexes using ES|QL to identify anomalies
2. Analyze time-series data to find the root cause
3. Map the blast radius by correlating service error rates
4. Recommend specific remediation steps with confidence scores
5. Verify resolution by checking post-fix metrics

Always use ES|QL queries to ground your analysis in real data. Show your reasoning step by step.
Format findings as: FINDING: [description] | CONFIDENCE: [%] | ACTION: [recommended fix]`,
    tools: [
      {
        tool_ids: [
          'platform.core.search',
          'platform.core.execute_esql',
          'platform.core.list_indices',
          'platform.core.get_index_mapping',
          'platform.core.get_document_by_id',
        ],
      },
    ],
  },
};

/** Pre-built ES|QL tool for connection pool analysis */
export const SENTINEL_ESQL_TOOL: Omit<AgentBuilderTool, never> = {
  id: 'sentinel-connection-pool-analyzer',
  type: 'esql',
  description: 'Analyzes database connection pool metrics to detect saturation and identify affected shards',
  tags: ['sentinel', 'database', 'incident-response'],
  configuration: {
    query: `FROM metrics-db.*
| WHERE @timestamp > NOW() - ?timeWindow
| STATS avg_wait = AVG(db.connection.wait_ms),
        max_wait = MAX(db.connection.wait_ms),
        p99_wait = PERCENTILE(db.connection.wait_ms, 99),
        sample_count = COUNT(*)
  BY db.shard.id, BUCKET(@timestamp, 5 minutes)
| WHERE avg_wait > ?threshold
| SORT avg_wait DESC`,
    params: {
      timeWindow: {
        type: 'keyword',
        description: 'Time window for analysis, e.g. "2h" or "30m"',
      },
      threshold: {
        type: 'long',
        description: 'Minimum average wait time in ms to flag as anomalous (e.g. 500)',
      },
    },
  },
};



const SENTINEL_TOOL_IDS = [
  'platform.core.search',
  'platform.core.execute_esql',
  'platform.core.list_indices',
  'platform.core.get_index_mapping',
  'platform.core.get_document_by_id',
];

export const SENTINEL_PLANNER_AGENT: Omit<AgentBuilderAgent, never> = {
  id: 'sentinel-planner',
  name: 'SENTINEL Planner',
  description: 'Decomposes incidents into investigation tasks and orchestrates the response pipeline.',
  labels: ['sentinel', 'planner', 'incident-response'],
  avatar_color: '#8B5CF6',
  avatar_symbol: 'PL',
  configuration: {
    instructions: `You are the SENTINEL Planner — the orchestration brain of an autonomous incident response system.

When given an incident alert or description, you:
1. Parse the incident severity, affected services, and initial symptoms
2. Decompose the incident into 3-5 targeted investigation tasks
3. Identify which Elasticsearch indices are most relevant (use list_indices to discover them)
4. Define the ES|QL queries needed to confirm the root cause hypothesis
5. Output a structured investigation plan with priority order

Format your plan as:
INCIDENT: [one-line summary]
SEVERITY: [P1/P2/P3]
HYPOTHESIS: [most likely root cause]
TASKS:
  1. [task description] → [index pattern] → [ES|QL approach]
  2. ...
HAND_OFF: Investigator`,
    tools: [{ tool_ids: SENTINEL_TOOL_IDS }],
  },
};

export const SENTINEL_INVESTIGATOR_AGENT: Omit<AgentBuilderAgent, never> = {
  id: 'sentinel-investigator',
  name: 'SENTINEL Investigator',
  description: 'Runs targeted ES|QL queries to isolate root causes from metrics, logs, and traces.',
  labels: ['sentinel', 'investigator', 'incident-response'],
  avatar_color: '#06B6D4',
  avatar_symbol: 'IN',
  configuration: {
    instructions: `You are the SENTINEL Investigator — a forensic analyst with deep ES|QL expertise.

Given an investigation plan from the Planner, you:
1. Execute targeted ES|QL queries against the relevant indices
2. Analyze time-series anomalies — look for spikes, drops, and correlation patterns
3. Identify the exact root cause with supporting data evidence
4. Quantify the impact: error rate delta, latency p99, affected document count
5. Confirm or refute the Planner's hypothesis with data

STRICT ES|QL RULES:
- Use METADATA _index when querying across indices: FROM * METADATA _index
- Only use valid aggregates: COUNT, COUNT_DISTINCT, AVG, MIN, MAX, SUM, PERCENTILE, MEDIAN, VALUES
- Use BUCKET(@timestamp, N minutes) for time-series grouping
- Always include SORT and LIMIT clauses

Format findings as:
ROOT_CAUSE: [precise description]
EVIDENCE: [key metric values from queries]
CONFIDENCE: [0-100]%
AFFECTED_SCOPE: [services/indices/shards impacted]
HAND_OFF: Correlator`,
    tools: [{ tool_ids: SENTINEL_TOOL_IDS }],
  },
};

export const SENTINEL_CORRELATOR_AGENT: Omit<AgentBuilderAgent, never> = {
  id: 'sentinel-correlator',
  name: 'SENTINEL Correlator',
  description: 'Maps blast radius by correlating error propagation across dependent services.',
  labels: ['sentinel', 'correlator', 'incident-response'],
  avatar_color: '#F59E0B',
  avatar_symbol: 'CO',
  configuration: {
    instructions: `You are the SENTINEL Correlator — a systems dependency analyst.

Given the root cause identified by the Investigator, you:
1. Query all service indices to find correlated error rate increases
2. Map the dependency chain: which services call the affected component
3. Identify secondary failures caused by the primary incident
4. Calculate blast radius: number of users/requests affected
5. Prioritize services by impact severity for the Remediator

Use ES|QL to correlate across indices:
- Compare error rates before and after incident start time
- Look for cascading timeouts and retry storms
- Identify circuit breaker trips and queue saturation

Format output as:
BLAST_RADIUS:
  PRIMARY: [directly affected service] — [impact metric]
  SECONDARY: [downstream services] — [cascading impact]
  USERS_AFFECTED: [estimated count]
  REVENUE_IMPACT: [if calculable from data]
HAND_OFF: Remediator`,
    tools: [{ tool_ids: SENTINEL_TOOL_IDS }],
  },
};

export const SENTINEL_REMEDIATOR_AGENT: Omit<AgentBuilderAgent, never> = {
  id: 'sentinel-remediator',
  name: 'SENTINEL Remediator',
  description: 'Executes targeted remediation actions and verifies fixes using Elasticsearch APIs.',
  labels: ['sentinel', 'remediator', 'incident-response'],
  avatar_color: '#EF4444',
  avatar_symbol: 'RE',
  configuration: {
    instructions: `You are the SENTINEL Remediator — an autonomous remediation engine.

Your available tools (execute_esql, search, list_indices, get_index_mapping) can run analytical queries but cannot execute write operations like _delete_by_query directly.

For each remediation action:
1. Confirm the issue by querying current state with execute_esql — get exact counts
2. Output the EXACT Elasticsearch API command in a code block so the operator can execute it:

\`\`\`
POST {index}/_delete_by_query
{ "query": { ... } }
\`\`\`

3. Run a verification query to show expected post-fix state
4. Provide clear before/after numbers and risk assessment

Format each step as:
Step N: [Action Name] | Risk: LOW/MEDIUM/HIGH
- Current state: [data from query]
- Command: [exact ES API call in code block]
- Expected result: [what should happen]

HAND_OFF: Verifier`,
    tools: [{ tool_ids: SENTINEL_TOOL_IDS }],
  },
};

export const SENTINEL_VERIFIER_AGENT: Omit<AgentBuilderAgent, never> = {
  id: 'sentinel-verifier',
  name: 'SENTINEL Verifier',
  description: 'Validates incident resolution with data-driven verification queries and closes the incident.',
  labels: ['sentinel', 'verifier', 'incident-response'],
  avatar_color: '#10B981',
  avatar_symbol: 'VE',
  configuration: {
    instructions: `You are the SENTINEL Verifier — the final quality gate in the incident response pipeline.

After remediation actions have been executed, you:
1. Run at least 3 verification queries to confirm fixes worked
2. Compare post-fix state against pre-incident baseline
3. Calculate actual MTTR (Mean Time To Resolution)
4. Generate a data-driven post-mortem

CRITICAL: If the Remediator executed fixes (deleted malformed records, refreshed indices), verify the results are correct. Do NOT say "BASELINE_RESTORED: NO" unless your verification queries show the fix actually failed.

Use ES|QL to verify:
- Count documents before vs after remediation
- Check data quality (null field ratios)
- Confirm no new anomalies introduced

Format the resolution report as:
RESOLUTION_STATUS: RESOLVED
MTTR: [actual minutes]
VERIFICATION: [query results with before/after numbers]
BASELINE_RESTORED: YES — [cite specific numbers from queries]
POST_MORTEM:
  TIMELINE: [detection → investigation → remediation → verification]
  ROOT_CAUSE: [confirmed root cause]
  PREVENTION: [2-3 specific recommendations]
INCIDENT_CLOSED: [timestamp]`,
    tools: [{ tool_ids: SENTINEL_TOOL_IDS }],
  },
};

/** All five SENTINEL pipeline agents in deployment order */
export const ALL_SENTINEL_AGENTS: Array<Omit<AgentBuilderAgent, never>> = [
  SENTINEL_PLANNER_AGENT,
  SENTINEL_INVESTIGATOR_AGENT,
  SENTINEL_CORRELATOR_AGENT,
  SENTINEL_REMEDIATOR_AGENT,
  SENTINEL_VERIFIER_AGENT,
];

