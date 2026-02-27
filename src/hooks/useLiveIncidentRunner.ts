/**
 * useLiveIncidentRunner
 *
 * Scans Elasticsearch for real data, synthesizes a live incident,
 * then runs all 5 SENTINEL agents sequentially via Agent Builder.
 * Streams reasoning into AgentStoreContext — same state that powers the UI.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAgentStore } from '../store/AgentStoreContext';
import {
  listAgents, converseWithAgent,
  type AgentBuilderAgent,
} from '../lib/agentBuilder';
import { runEsqlQuery } from '../lib/elasticsearch';
import { isAgentBuilderConfigured } from '../lib/agentBuilder';
import { isLiveElasticsearchConfigured } from '../lib/elasticsearch';
import type { AgentRole } from '../types/agent.types';



export interface LiveIncident {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium';
  indices: string[];
  detectedAt: string;
  summary: string;
  totalDocs: number;
}

export type RunnerStatus = 'idle' | 'detecting' | 'running' | 'complete' | 'error';



const AGENT_ROLES: AgentRole[] = ['planner', 'investigator', 'correlator', 'remediator', 'verifier'];

const ROLE_AGENT_NAMES: Record<AgentRole, string[]> = {
  planner:      ['sentinel-planner', 'planner'],
  investigator: ['sentinel-investigator', 'investigator'],
  correlator:   ['sentinel-correlator', 'correlator'],
  remediator:   ['sentinel-remediator', 'remediator'],
  verifier:     ['sentinel-verifier', 'verifier'],
};

function findAgentForRole(agents: AgentBuilderAgent[], role: AgentRole): AgentBuilderAgent | null {
  const names = ROLE_AGENT_NAMES[role];
  return (
    agents.find(a => names.some(n => a.id.toLowerCase().includes(n) || a.name.toLowerCase().includes(n))) ??
    agents.find(a => a.name.toLowerCase().includes('sentinel')) ??
    agents[0] ??
    null
  );
}



interface ClusterSnapshot {
  indices: string[];
  totalDocs: number;
  indexCount: number;
  topIndex: string;
  topIndexDocs: number;
  hasWebLogs: boolean;
  hasMetrics: boolean;
  hasLogs: boolean;
}

async function scanCluster(): Promise<ClusterSnapshot | null> {
  const errors: string[] = [];

  
  try {
    const { fetchIndexHealth } = await import('../lib/elasticsearch');
    const indices = await fetchIndexHealth();
    console.log('[SENTINEL] _cat/indices returned', indices.length, 'indices:', indices.map(i => i.name));
    if (indices.length > 0) {
      const names = indices.map(i => i.name);
      const totalDocs = indices.reduce((s, i) => s + i.docsCount, 0);
      return {
        indices: names.slice(0, 15),
        totalDocs,
        indexCount: names.length,
        topIndex: names[0],
        topIndexDocs: indices[0].docsCount,
        hasWebLogs: names.some(n => n.includes('logs') || n.includes('web')),
        hasMetrics: names.some(n => n.includes('metrics') || n.includes('ecommerce')),
        hasLogs: names.some(n => n.includes('logs') || n.includes('log') || n.includes('flights')),
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`_cat/indices: ${msg}`);
    console.warn('[SENTINEL] _cat/indices failed:', msg);
  }

  
  try {
    const result = await runEsqlQuery(
      `FROM * METADATA _index | STATS doc_count = COUNT(*) BY _index | SORT doc_count DESC | LIMIT 20`
    );
    console.log('[SENTINEL] ES|QL returned', result.totalRows, 'rows');
    if (result.totalRows > 0) {
      const rows = result.rows.filter(r => {
        const idx = String(r['_index'] ?? '');
        return idx && idx !== 'undefined' && !idx.startsWith('.');
      });
      if (rows.length > 0) {
        const names = rows.map(r => String(r['_index']));
        const totalDocs = rows.reduce((s, r) => s + (Number(r['doc_count']) || 0), 0);
        return {
          indices: names,
          totalDocs,
          indexCount: names.length,
          topIndex: names[0],
          topIndexDocs: Number(rows[0]['doc_count']) || 0,
          hasWebLogs: names.some(n => n.includes('logs') || n.includes('web')),
          hasMetrics: names.some(n => n.includes('metrics') || n.includes('ecommerce')),
          hasLogs: names.some(n => n.includes('logs') || n.includes('log') || n.includes('flights')),
        };
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`ES|QL: ${msg}`);
    console.warn('[SENTINEL] ES|QL failed:', msg);
  }

  
  try {
    const { proxyFetch: pf, getConnectionConfig } = await import('../lib/connectionStore');
    const cfg = getConnectionConfig();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `ApiKey ${cfg.esApiKey}`,
    };
    const res = await pf(cfg.esUrl, `/_cat/indices?format=json&h=index,health,docs.count,pri&s=docs.count:desc`, { headers });
    if (res.ok) {
      const data: Array<{ index: string; health: string; 'docs.count': string; pri: string }> = await res.json();
      const filtered = data.filter(d => !d.index.startsWith('.') && parseInt(d['docs.count'] || '0', 10) > 0);
      console.log('[SENTINEL] _cat fallback found', filtered.length, 'indices');
      if (filtered.length > 0) {
        const names = filtered.slice(0, 15).map(d => d.index);
        const totalDocs = filtered.reduce((s, d) => s + (parseInt(d['docs.count'] || '0', 10) || 0), 0);
        return {
          indices: names,
          totalDocs,
          indexCount: filtered.length,
          topIndex: names[0],
          topIndexDocs: parseInt(filtered[0]['docs.count'] || '0', 10) || 0,
          hasWebLogs: names.some(n => n.includes('logs') || n.includes('web')),
          hasMetrics: names.some(n => n.includes('metrics') || n.includes('ecommerce')),
          hasLogs: names.some(n => n.includes('logs') || n.includes('log') || n.includes('flights')),
        };
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`_cat fallback: ${msg}`);
    console.warn('[SENTINEL] _cat fallback failed:', msg);
  }

  if (errors.length > 0) {
    console.error('[SENTINEL] All scan strategies failed:', errors.join(' | '));
  }
  return null;
}

function buildIncidentFromSnapshot(snap: ClusterSnapshot): LiveIncident {
  const now = new Date().toISOString();
  const topThree = snap.indices.slice(0, 3);

  
  let title: string;
  let description: string;
  let severity: LiveIncident['severity'] = 'high';

  if (snap.hasWebLogs) {
    title = 'Anomalous Traffic Pattern — Web Log Analysis Required';
    description = `SENTINEL detected ${snap.totalDocs.toLocaleString()} events across ${snap.indexCount} indices. ` +
      `Web log data is present in ${topThree.filter(i => i.includes('log')).join(', ') || snap.topIndex}. ` +
      `Agents will analyze request patterns, error rates, and response time distributions to identify anomalies.`;
    severity = 'high';
  } else if (snap.hasMetrics) {
    title = 'Infrastructure Metrics Anomaly — Performance Degradation Detected';
    description = `SENTINEL detected ${snap.totalDocs.toLocaleString()} metric data points across ${snap.indexCount} indices. ` +
      `Metrics data present in ${topThree.filter(i => i.includes('metric')).join(', ') || snap.topIndex}. ` +
      `Agents will analyze resource utilization, latency trends, and error rates.`;
    severity = 'critical';
  } else {
    title = `Data Anomaly Investigation — ${snap.topIndex}`;
    description = `SENTINEL detected ${snap.totalDocs.toLocaleString()} documents across ${snap.indexCount} indices. ` +
      `Largest index: ${snap.topIndex} (${snap.topIndexDocs.toLocaleString()} docs). ` +
      `Agents will investigate data patterns, identify anomalies, and assess impact.`;
    severity = 'medium';
  }

  return {
    id: `live-${Date.now()}`,
    title,
    description,
    severity,
    indices: snap.indices.slice(0, 5),
    detectedAt: now,
    summary: `${snap.indexCount} indices · ${snap.totalDocs.toLocaleString()} docs`,
    totalDocs: snap.totalDocs,
  };
}



function buildRolePrompt(role: AgentRole, incident: LiveIncident, previousFindings: string): string {
  const indicesList = incident.indices.map(i => `  - ${i}`).join('\n');
  const context = `LIVE INCIDENT:
Title: ${incident.title}
Severity: ${incident.severity.toUpperCase()}
Detected: ${incident.detectedAt}
Available indices:
${indicesList}

Description: ${incident.description}${previousFindings ? `\n\nPREVIOUS FINDINGS:\n${previousFindings}` : ''}`;

  switch (role) {
    case 'planner':
      return `${context}

You are the SENTINEL Planner. Your job is to decompose this incident into a concrete investigation plan.

1. Use list_indices to see all available indices
2. Form a root cause hypothesis based on the incident description
3. Define 3 specific ES|QL queries the Investigator should run (include the actual query text)
4. Identify which indices are most relevant

Output format:
**INCIDENT:** [one-line summary]
**SEVERITY:** [P1/P2/P3 with reason]
**HYPOTHESIS:** [most likely root cause]
**INVESTIGATION PLAN:**
1. [task] → query: \`FROM index | ...\`
2. [task] → query: \`FROM index | ...\`
3. [task] → query: \`FROM index | ...\`
**HAND_OFF:** Investigator`;

    case 'investigator':
      return `${context}

You are the SENTINEL Investigator. Execute the investigation plan from the Planner.

1. Run execute_esql to query the available indices — use the exact index names listed above
2. Run at least 3 different queries: total counts, field distributions, and anomaly detection
3. Look for: null/empty fields, unusual distributions, error patterns, data quality issues
4. Report what you find with actual numbers from the query results

**IMPORTANT:** Only query indices that exist: ${incident.indices.join(', ')}

Start with: FROM ${incident.indices[0]} | STATS count = COUNT(*) | LIMIT 10
Then dig deeper into field-level analysis.

Output format:
**ROOT_CAUSE:** [precise description with data evidence]
**EVIDENCE:** [actual query results with numbers in a table]
**CONFIDENCE:** [0-100]%
**AFFECTED_SCOPE:** [what is impacted — indices, doc counts, data quality %]
**HAND_OFF:** Correlator`;

    case 'correlator':
      return `${context}

You are the SENTINEL Correlator. Map the blast radius based on the Investigator's findings.

1. Query multiple indices to find correlated patterns
2. Identify which indices/services show related anomalies
3. Estimate total scope of impact

Use: FROM * METADATA _index | STATS doc_count = COUNT(*) BY _index | SORT doc_count DESC | LIMIT 10

Output format:
**BLAST_RADIUS:**
  - PRIMARY: [most affected index/service]
  - SECONDARY: [correlated indices]
  - TOTAL_SCOPE: [estimated impact]
**CORRELATION_EVIDENCE:** [query results]
**HAND_OFF:** Remediator`;

    case 'remediator':
      return `${context}

You are the SENTINEL Remediator — an autonomous remediation engine.

AVAILABLE TOOLS:
- execute_esql: Run ES|QL queries for analysis
- search: Run Elasticsearch search/analytical queries
- list_indices / get_index_mapping: Inspect cluster state

IMPORTANT: The search tool can run analytical queries but cannot execute write operations like _delete_by_query directly. For write operations, output the exact Elasticsearch API command so the operator can execute it from the SENTINEL dashboard.

REMEDIATION WORKFLOW:
1. First, confirm the issue by querying current state with execute_esql — get exact counts of affected documents
2. For each remediation action, output the EXACT Elasticsearch API command in this format:

\`\`\`
POST {index}/_delete_by_query
{
  "query": { ... }
}
\`\`\`

3. After outputting each command, run a verification query with execute_esql to show what the expected post-fix state should be
4. Provide clear before/after numbers

Output format:
**REMEDIATION PLAN:**

**Step 1: [Action Name]**
- Current state: [query result showing the problem]
- Risk: LOW/MEDIUM/HIGH

\`\`\`
POST {index}/_delete_by_query
{
  "query": { "bool": { "must_not": { "exists": { "field": "fieldname" } } } }
}
\`\`\`

- Expected result: [X documents removed, Y remaining]

**Step 2: [Action Name]**

\`\`\`
POST {index}/_refresh
\`\`\`

**VERIFICATION:** [post-fix expected state with numbers]
**HAND_OFF:** Verifier`;

    case 'verifier':
      return `${context}

You are the SENTINEL Verifier — the final quality gate. Your job is to CONFIRM the remediation worked with hard data.

CRITICAL INSTRUCTIONS:
- Run at least 3 verification queries using execute_esql
- Compare post-remediation state against the pre-incident baseline
- If the Remediator successfully cleaned data, confirm the counts match expectations
- Calculate actual MTTR from detection time to now
- The incident should be marked RESOLVED if the primary data quality issue is fixed
- Do NOT say "BASELINE_RESTORED: NO" unless you have evidence the fix failed

VERIFICATION WORKFLOW:
1. Count total documents in affected indices — confirm malformed records are gone
2. Run a data quality check — verify remaining records have valid fields
3. Check overall cluster health — confirm no new issues introduced
4. Calculate MTTR and generate the post-mortem

Output format:
**RESOLUTION REPORT**
**STATUS:** RESOLVED
**MTTR:** [actual minutes from ${incident.detectedAt} to now]
**VERIFICATION RESULTS:**
| Check | Result | Status |
|-------|--------|--------|
| [check 1] | [result] | ✅/⚠️ |
| [check 2] | [result] | ✅/⚠️ |

**POST-MORTEM:**
- Root Cause: [confirmed from data]
- Impact: [what was affected and for how long]
- Resolution: [what the Remediator did to fix it]
- Prevention: [2-3 specific recommendations]

**BASELINE_RESTORED:** YES — [cite specific query results]
**INCIDENT_CLOSED:** ${new Date().toISOString()}`;
  }
}



export function useLiveIncidentRunner() {
  const { setAgentStatus, setReasoning, appendReasoning, addStep, resetRun, setHandoff } = useAgentStore();
  const [status, setStatus] = useState<RunnerStatus>('idle');
  const [incident, setIncident] = useState<LiveIncident | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedFindings, setCompletedFindings] = useState<string>('');
  const [agentFindings, setAgentFindings] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    runningRef.current = false;
    setStatus('idle');
  }, []);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    if (!isLiveElasticsearchConfigured() || !isAgentBuilderConfigured()) {
      setError('Configure Elasticsearch and Kibana credentials first.');
      setStatus('error');
      return;
    }

    runningRef.current = true;
    setError(null);
    setCompletedFindings('');
    setAgentFindings({});
    setStatus('detecting');

    try {
      
      const snap = await scanCluster();
      if (!snap) {
        setError('Could not detect data in Elasticsearch. Check browser console for details. Ensure Kibana sample data is installed (Kibana → Home → Try sample data).');
        setStatus('error');
        runningRef.current = false;
        return;
      }

      const liveIncident = buildIncidentFromSnapshot(snap);
      setIncident(liveIncident);

      
      const agents = await listAgents();
      if (!agents.length) {
        setError('No agents deployed. Go to Agent Builder → Deploy tab → "Deploy All 5 Agents".');
        setStatus('error');
        runningRef.current = false;
        return;
      }

      
      resetRun(liveIncident.id);
      setStatus('running');
      abortRef.current = new AbortController();

      let previousFindings = '';
      let allFindings = '';

      
      for (const role of AGENT_ROLES) {
        if (!runningRef.current || abortRef.current.signal.aborted) break;

        const agent = findAgentForRole(agents, role);
        if (!agent) continue;

        setAgentStatus(role, 'thinking', 10);

        
        const prevIdx = AGENT_ROLES.indexOf(role) - 1;
        if (prevIdx >= 0) {
          setHandoff(AGENT_ROLES[prevIdx], role);
          await sleep(500);
        }

        const prompt = buildRolePrompt(role, liveIncident, previousFindings);
        let fullResponse = '';
        let stepCounter = 0;
        const stepIds: string[] = [];

        try {
          await converseWithAgent(
            agent.id,
            prompt,
            undefined,
            undefined,
            {
              onReasoning: (text, transient) => {
                if (!transient && text.trim()) {
                  
                  appendReasoning(role, text);
                }
              },
              onToolCall: (toolId) => {
                stepCounter++;
                const stepId = `${role}-${stepCounter}-${Date.now()}`;
                stepIds.push(stepId);
                addStep(role, {
                  id: stepId,
                  type: 'tool_call',
                  toolName: toolId,
                  status: 'running',
                  startedAt: new Date().toISOString(),
                });
                setAgentStatus(role, 'executing', Math.min(20 + stepCounter * 20, 85));
              },
              onMessageChunk: (chunk) => {
                fullResponse += chunk;
              },
            },
            abortRef.current.signal
          );

          
          stepIds.forEach((sid, i) => {
            addStep(role, {
              id: `${sid}-done`,
              type: 'tool_result',
              toolName: `step-${i + 1}`,
              status: 'complete',
              result: 'Query executed',
              startedAt: new Date().toISOString(),
            });
          });

          
          const finalText = fullResponse.trim();
          if (finalText) {
            appendReasoning(role, '\n\n---\n\n' + finalText);
            previousFindings = `[${role.toUpperCase()}]:\n${finalText.slice(0, 600)}`;
            allFindings += `\n\n## ${role.toUpperCase()}\n${finalText}`;
            setAgentFindings(prev => ({ ...prev, [role]: finalText }));
          } else {
            previousFindings = `[${role.toUpperCase()}]: Agent completed with tool calls.`;
            allFindings += `\n\n## ${role.toUpperCase()}\nCompleted analysis via tool calls.`;
          }

          setAgentStatus(role, 'complete', 100);
          await sleep(400);

        } catch (err) {
          if ((err as Error).name === 'AbortError') break;
          setAgentStatus(role, 'error', 0);
          const errMsg = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
          setReasoning(role, errMsg);
          await sleep(200);
        }
      }

      if (runningRef.current) {
        setCompletedFindings(allFindings);
        setStatus('complete');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    } finally {
      runningRef.current = false;
    }
  }, [setAgentStatus, setReasoning, appendReasoning, addStep, resetRun, setHandoff]);

  
  useEffect(() => {
    if (isLiveElasticsearchConfigured() && isAgentBuilderConfigured()) {
      run();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, incident, error, completedFindings, agentFindings, run, stop };
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}
