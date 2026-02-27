import { useState } from 'react';
import { IncidentQueue } from '../components/incidents/IncidentQueue';
import { AgentOrchestrationView } from '../components/agents/AgentOrchestrationView';
import { ClusterHealthBar } from '../components/metrics/ClusterHealthBar';
import { AnomalyFeed } from '../components/metrics/AnomalyFeed';
import { IncidentDetail } from '../components/incidents/IncidentDetail';
import { AgentThinkingStream } from '../components/agents/AgentThinkingStream';
import { DEMO_INCIDENTS } from '../data/demo-incidents';
import { useAppStore } from '../store/AppStoreContext';
import { useAgentStore } from '../store/AgentStoreContext';
import { DEMO_CONFIG } from '../config/demo.config';
import { useLiveRunner } from '../store/LiveRunnerContext';
import { ProgressRing } from '../components/ui/ProgressRing';
import { GlowDot } from '../components/ui/GlowDot';
import { Badge } from '../components/ui/Badge';
import {
  Activity, Zap, Loader2, AlertCircle, CheckCircle2,
  Clock, Server, AlertTriangle, ChevronRight, Search,
  GitBranch, Wrench, FileCheck,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AgentRole } from '../types/agent.types';

const AGENT_ROLES: AgentRole[] = ['planner', 'investigator', 'correlator', 'remediator', 'verifier'];
const ROLE_LABELS: Record<AgentRole, string> = {
  planner: 'Planner', investigator: 'Investigator', correlator: 'Correlator',
  remediator: 'Remediator', verifier: 'Verifier',
};

const ROLE_ICONS: Record<AgentRole, typeof Search> = {
  planner: GitBranch, investigator: Search, correlator: GitBranch,
  remediator: Wrench, verifier: FileCheck,
};


function extractInsight(text: string): string {
  
  const labelPattern = /\*\*(?:INCIDENT|ROOT_CAUSE|BLAST_RADIUS|COMMAND|RESOLUTION|HAND_OFF|SEVERITY|HYPOTHESIS|EVIDENCE|CONFIDENCE|AFFECTED_SCOPE|REMEDIATION|VERIFICATION|STATUS|MTTR|POST.?MORTEM|BASELINE)[^*]*\*\*[:\s]*/gi;
  const cleaned = text.replace(labelPattern, '').trim();

  
  const lines = cleaned.split('\n').map(l => l.replace(/^[#\-*>\s|]+/, '').trim()).filter(l => l.length > 15);

  
  const meaningful = lines.find(l =>
    !l.match(/^(INCIDENT|ROOT_CAUSE|BLAST_RADIUS|HAND_OFF|Planner|Investigator|Correlator|Remediator|Verifier|COMMAND|STEP|RISK|ETA|ROLLBACK)[\s:]/i) &&
    l.split(' ').length >= 3
  );

  if (meaningful) return meaningful.slice(0, 100);

  
  const boldMatch = text.match(/\*\*([^*]{10,})\*\*/);
  if (boldMatch) {
    const val = boldMatch[1].replace(/^(INCIDENT|ROOT_CAUSE|BLAST_RADIUS|SEVERITY|HYPOTHESIS)[:\s]*/i, '').trim();
    if (val.length > 10) return val.slice(0, 100);
  }

  return 'Analysis complete';
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export function DashboardPage() {
  const { selectedIncidentId } = useAppStore();
  const selectedIncident = DEMO_INCIDENTS.find(i => i.id === selectedIncidentId) ?? DEMO_INCIDENTS[0];

  if (!DEMO_CONFIG.DEMO_MODE) {
    return <LiveDashboard />;
  }

  return (
    <div className="flex flex-col h-full gap-0">
      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="w-[260px] flex-shrink-0 border-r border-white/[0.06] overflow-hidden flex flex-col">
          <IncidentQueue className="flex-1" />
        </div>
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 bg-accent-cyan rounded-full" />
                <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Agent Orchestration</h2>
                <span className="text-[10px] text-text-muted ml-1">— Elastic Agent Builder · Multi-step reasoning</span>
              </div>
              <AgentOrchestrationView />
            </div>
            <AnomalyFeed />
          </div>
        </div>
        <div className="w-[320px] flex-shrink-0 border-l border-white/[0.06] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <ClusterHealthBar />
            <IncidentDetail incident={selectedIncident} />
          </div>
        </div>
      </div>
    </div>
  );
}




function LiveDashboard() {
  const { status: runnerStatus, incident, error: runnerError, run, stop, agentFindings } = useLiveRunner();
  const { state } = useAgentStore();
  const [selectedAgent, setSelectedAgent] = useState<AgentRole | null>(null);
  const isRunning = runnerStatus === 'running' || runnerStatus === 'detecting';

  
  const activeRole = AGENT_ROLES.find(r => {
    const s = state.run.agents[r].status;
    return s === 'thinking' || s === 'executing';
  });
  const effectiveAgent = selectedAgent ?? activeRole ?? null;

  return (
    <div className="flex flex-col h-full gap-0">
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* ── Left: Incident sidebar ── */}
        <div className="w-[260px] flex-shrink-0 border-r border-white/[0.06] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
            <div>
              <h3 className="text-xs font-semibold text-text-primary">Incidents</h3>
              <p className="text-[10px] text-text-muted mt-0.5">
                {incident ? '1 active' : 'No active incidents'}
              </p>
            </div>
            {isRunning && (
              <span className="text-[9px] bg-accent-dim text-accent-bright px-1.5 py-0.5 rounded-full font-semibold animate-pulse">live</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {/* Live incident card */}
            {incident && (
              <div className="w-full text-left p-3 rounded-lg border bg-accent-dim border-accent-cyan/40 shadow-glow-cyan">
                <div className="flex items-start gap-3">
                  <GlowDot status={runnerStatus === 'complete' ? 'complete' : 'thinking'} size={7} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-snug text-text-primary line-clamp-2">{incident.title}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant={incident.severity === 'critical' ? 'critical' : incident.severity === 'high' ? 'high' : 'medium'}>
                        {incident.severity}
                      </Badge>
                      <span className={`text-[10px] font-medium ${
                        runnerStatus === 'complete' ? 'text-status-ok' : 'text-accent-cyan'
                      }`}>
                        {runnerStatus === 'complete' ? 'Analyzed' : runnerStatus === 'running' ? 'Investigating' : 'Detected'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1 text-[10px] text-text-muted">
                        <Clock size={9} />
                        {timeAgo(incident.detectedAt)}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-text-muted">
                        <Server size={9} />
                        {incident.indices.length} indices
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Discovery cards — synthesized from agent findings */}
            {Object.keys(agentFindings).length > 0 && (
              <div className="pt-2">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-1 mb-1.5">Discoveries</p>
                {Object.entries(agentFindings).map(([role, text]) => {
                  const Icon = ROLE_ICONS[role as AgentRole] ?? Search;
                  const insight = extractInsight(text);
                  return (
                    <div key={role} className="p-2 rounded-lg border border-white/[0.06] bg-white/[0.02] mb-1 hover:bg-white/[0.04] transition-colors">
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded flex items-center justify-center bg-accent-dim flex-shrink-0 mt-0.5">
                          <Icon size={10} className="text-accent-cyan" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-semibold text-accent-bright capitalize">{role}</p>
                          <p className="text-[9px] text-text-secondary mt-0.5 leading-relaxed line-clamp-2">{insight}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Agent pipeline timeline */}
            {(incident || isRunning) && (
              <div className="pt-2">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-1 mb-1.5">Agent Pipeline</p>
                {AGENT_ROLES.map(role => {
                  const agent = state.run.agents[role];
                  const isActive = agent.status === 'thinking' || agent.status === 'executing';
                  const isComplete = agent.status === 'complete';
                  const isSel = selectedAgent === role;
                  const Icon = ROLE_ICONS[role] ?? Search;
                  return (
                    <button key={role} onClick={() => setSelectedAgent(isSel ? null : role)}
                      className={`w-full text-left p-2 rounded-lg border transition-all duration-150 mb-1 ${
                        isSel ? 'border-accent-cyan/40 bg-accent-dim' :
                        isActive ? 'border-accent-cyan/20 bg-accent-dim/50' :
                        isComplete ? 'border-status-ok/15 bg-status-ok/5' :
                        'border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]'
                      }`}>
                      <div className="flex items-center gap-2">
                        <Icon size={10} className={isActive ? 'text-accent-cyan' : isComplete ? 'text-status-ok' : 'text-text-muted'} />
                        <span className={`text-[11px] font-medium ${isActive ? 'text-accent-bright' : isComplete ? 'text-status-ok' : 'text-text-secondary'}`}>
                          {ROLE_LABELS[role]}
                        </span>
                        <div className="ml-auto flex items-center gap-1.5">
                          {agent.steps.length > 0 && (
                            <span className="text-[9px] font-mono text-text-muted">{agent.steps.length}</span>
                          )}
                          <ProgressRing progress={agent.progressPercent} size={18} strokeWidth={2}
                            color={isComplete ? '#10B981' : '#06B6D4'} />
                        </div>
                      </div>
                      {isActive && <p className="text-[9px] text-accent-cyan mt-0.5 font-mono animate-pulse">{agent.steps.length} steps · reasoning...</p>}
                      {isComplete && (
                        <p className="text-[9px] text-status-ok mt-0.5">
                          {agent.steps.length} steps · {agent.completedAt ? timeAgo(agent.completedAt) : 'done'}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Run / Stop button */}
            <div className="pt-2">
              <button
                onClick={isRunning ? stop : run}
                disabled={runnerStatus === 'detecting'}
                className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all ${
                  runnerStatus === 'detecting'
                    ? 'bg-white/[0.06] text-text-muted cursor-wait'
                    : isRunning
                      ? 'bg-status-critical/15 text-status-critical border border-status-critical/20 hover:bg-status-critical/25'
                      : 'bg-accent-cyan text-[#0B0F14] hover:bg-accent-bright'
                }`}
              >
                {runnerStatus === 'detecting'
                  ? <><Loader2 size={10} className="animate-spin" /> Scanning cluster...</>
                  : isRunning
                    ? <><Activity size={10} className="animate-pulse" /> Stop Pipeline</>
                    : <><Zap size={10} /> {runnerStatus === 'complete' ? 'Re-run Pipeline' : 'Run Live Pipeline'}</>
                }
              </button>
            </div>

            {runnerStatus === 'error' && runnerError && (
              <div className="flex gap-2 p-2.5 rounded-lg bg-status-critical/10 border border-status-critical/20">
                <AlertCircle size={11} className="text-status-critical flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-status-critical leading-relaxed">{runnerError}</p>
              </div>
            )}

            {/* No incident yet */}
            {!incident && !isRunning && runnerStatus !== 'error' && (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <Activity size={18} className="text-text-muted mb-2" />
                <p className="text-[11px] text-text-muted leading-relaxed">
                  SENTINEL will auto-scan your cluster and run all 5 agents autonomously.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Center: Orchestration + Anomaly Feed ── */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 bg-accent-cyan rounded-full" />
                <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Agent Orchestration</h2>
                <span className="text-[10px] text-text-muted ml-1">— Elastic Agent Builder · Multi-step reasoning</span>
                {isRunning && <span className="ml-auto text-[9px] text-accent-bright bg-accent-dim px-1.5 py-0.5 rounded-full animate-pulse">live</span>}
              </div>
              <AgentOrchestrationView />
            </div>

            {/* Selected agent detail panel */}
            {effectiveAgent && state.run.agents[effectiveAgent].currentReasoning && (
              <div className="sentinel-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
                  <span className="text-xs font-semibold text-text-primary">{ROLE_LABELS[effectiveAgent]} — Reasoning Trace</span>
                  <span className="ml-auto text-[10px] text-text-muted">Elastic Agent Builder · live</span>
                </div>
                <AgentThinkingStream
                  text={state.run.agents[effectiveAgent].currentReasoning}
                  isActive={state.run.agents[effectiveAgent].status === 'thinking' || state.run.agents[effectiveAgent].status === 'executing'}
                  className="max-h-[300px]"
                />
              </div>
            )}

            <AnomalyFeed />
          </div>
        </div>

        {/* ── Right: Cluster health + Incident detail ── */}
        <div className="w-[320px] flex-shrink-0 border-l border-white/[0.06] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <ClusterHealthBar />

            {/* Live incident detail */}
            {incident && (
              <LiveIncidentDetailCard incident={incident} runnerStatus={runnerStatus} agentFindings={agentFindings} />
            )}

            {runnerStatus === 'complete' && (
              <div className="flex gap-2 p-3 rounded-xl bg-status-ok/10 border border-status-ok/20">
                <CheckCircle2 size={12} className="text-status-ok flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold text-status-ok">Pipeline Complete</p>
                  <p className="text-[10px] text-status-ok/70 mt-0.5">All 5 agents finished analysis.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Live Incident Detail Card ──────────────────────────────────────────── */

type LiveIncidentDetailProps = {
  incident: { title: string; description: string; severity: string; detectedAt: string; indices: string[] };
  runnerStatus: string;
  agentFindings: Record<string, string>;
};

function LiveIncidentDetailCard({ incident, runnerStatus, agentFindings }: LiveIncidentDetailProps) {
  const [tab, setTab] = useState<'overview' | 'findings'>('overview');
  const { state } = useAgentStore();
  const hasFindingsData = Object.keys(agentFindings).length > 0;

  return (
    <div className="sentinel-card overflow-hidden">
      <div className="p-3 border-b border-white/[0.06]">
        <div className="flex items-start gap-2">
          <AlertTriangle size={14} className={`mt-0.5 flex-shrink-0 ${
            incident.severity === 'critical' ? 'text-status-critical' : 'text-status-warning'
          }`} />
          <div className="flex-1 min-w-0">
            <h2 className="text-[11px] font-semibold text-text-primary leading-snug">{incident.title}</h2>
            <p className="text-[10px] text-text-muted mt-1 leading-relaxed line-clamp-3">{incident.description}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant={incident.severity === 'critical' ? 'critical' : 'high'} size="md">{incident.severity}</Badge>
              <div className="flex items-center gap-1 text-[10px] text-text-muted">
                <Clock size={9} />
                {timeAgo(incident.detectedAt)}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-text-muted">
                <Server size={9} />
                {incident.indices.length} indices
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06]">
        {(['overview', 'findings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2 text-[10px] font-medium transition-colors border-b-2 capitalize ${
              tab === t ? 'text-accent-bright border-accent-cyan' : 'text-text-muted hover:text-text-secondary border-transparent'
            }`}>
            {t === 'findings' ? `Findings${hasFindingsData ? ` (${Object.keys(agentFindings).length})` : ''}` : t}
          </button>
        ))}
      </div>

      <div className="p-3 max-h-[400px] overflow-y-auto">
        {tab === 'overview' && (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Affected Indices</p>
              <div className="flex flex-wrap gap-1">
                {incident.indices.map((idx, i) => (
                  <span key={i} className="px-2 py-0.5 text-[10px] rounded-md bg-elevated border border-white/[0.06] font-mono text-text-secondary">
                    {idx}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Pipeline Status</p>
              <div className="space-y-1">
                {AGENT_ROLES.map(role => {
                  const agent = state.run.agents[role];
                  const isActive = agent.status === 'thinking' || agent.status === 'executing';
                  const isComplete = agent.status === 'complete';
                  const isError = agent.status === 'error';
                  return (
                    <div key={role} className="flex items-center gap-2">
                      {isActive ? (
                        <Loader2 size={9} className="text-accent-cyan animate-spin" />
                      ) : isComplete ? (
                        <CheckCircle2 size={9} className="text-status-ok" />
                      ) : isError ? (
                        <AlertCircle size={9} className="text-status-critical" />
                      ) : (
                        <ChevronRight size={9} className="text-text-muted" />
                      )}
                      <span className={`text-[10px] ${
                        isActive ? 'text-accent-bright' : isComplete ? 'text-status-ok' : isError ? 'text-status-critical' : 'text-text-muted'
                      }`}>
                        {ROLE_LABELS[role]}
                      </span>
                      {agent.steps.length > 0 && (
                        <span className="text-[9px] font-mono text-text-muted ml-auto">{agent.steps.length} steps</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'findings' && (
          <div className="space-y-3">
            {hasFindingsData ? (
              Object.entries(agentFindings).map(([role, text]) => (
                <div key={role} className="space-y-1">
                  <p className="text-[10px] font-semibold text-accent-bright uppercase">{role}</p>
                  <div className="prose prose-invert prose-xs max-w-none
                    prose-p:text-text-secondary prose-p:text-[10px] prose-p:leading-relaxed prose-p:my-0.5
                    prose-strong:text-text-primary prose-strong:font-semibold prose-strong:text-[10px]
                    prose-code:text-accent-bright prose-code:bg-accent-dim prose-code:px-1 prose-code:rounded prose-code:text-[9px] prose-code:before:content-none prose-code:after:content-none
                    prose-ul:text-[10px] prose-ul:my-0.5 prose-ul:pl-3
                    prose-li:text-text-secondary prose-li:my-0
                    [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{text.slice(0, 500)}</ReactMarkdown>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-text-muted text-center py-4">
                {runnerStatus === 'running' ? 'Agents are analyzing...' : 'Run the pipeline to see findings'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
