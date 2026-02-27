import { useState } from 'react';
import { DEMO_INCIDENTS } from '../data/demo-incidents';
import { IncidentQueue } from '../components/incidents/IncidentQueue';
import { IncidentDetail } from '../components/incidents/IncidentDetail';
import { useAppStore } from '../store/AppStoreContext';
import { useAgentStore } from '../store/AgentStoreContext';
import { DEMO_CONFIG } from '../config/demo.config';
import { useLiveRunner } from '../store/LiveRunnerContext';
import { GlowDot } from '../components/ui/GlowDot';
import { Badge } from '../components/ui/Badge';
import { ProgressRing } from '../components/ui/ProgressRing';
import { AgentThinkingStream } from '../components/agents/AgentThinkingStream';
import {
  FileSearch, Zap, Loader2, CheckCircle2, Clock, Server,
  AlertTriangle, Activity,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AgentRole } from '../types/agent.types';

const AGENT_ROLES: AgentRole[] = ['planner', 'investigator', 'correlator', 'remediator', 'verifier'];
const ROLE_LABELS: Record<AgentRole, string> = {
  planner: 'Planner', investigator: 'Investigator', correlator: 'Correlator',
  remediator: 'Remediator', verifier: 'Verifier',
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export function IncidentsPage() {
  const { selectedIncidentId } = useAppStore();
  const incident = DEMO_INCIDENTS.find(i => i.id === selectedIncidentId) ?? DEMO_INCIDENTS[0];

  if (!DEMO_CONFIG.DEMO_MODE) {
    return <LiveIncidentsPage />;
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-[280px] flex-shrink-0 border-r border-white/[0.06] overflow-hidden">
        <IncidentQueue className="h-full" />
      </div>
      <div className="flex-1 overflow-hidden p-4">
        <IncidentDetail incident={incident} className="h-full" />
      </div>
    </div>
  );
}


function LiveIncidentsPage() {
  const { status, incident: liveIncident, completedFindings, run, stop } = useLiveRunner();
  const { state } = useAgentStore();
  const [detailTab, setDetailTab] = useState<'overview' | 'agents' | 'report'>('overview');
  const [selectedRole, setSelectedRole] = useState<AgentRole | null>(null);
  const isRunning = status === 'running' || status === 'detecting';
  const isComplete = status === 'complete';

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar — incident list + agent pipeline */}
      <div className="w-[280px] flex-shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <FileSearch size={12} className="text-accent-cyan" />
              <h3 className="text-xs font-semibold text-text-primary">Live Incidents</h3>
            </div>
            <p className="text-[10px] text-text-muted mt-0.5">
              {liveIncident ? '1 active' : 'No incidents detected'}
            </p>
          </div>
          {isRunning && <span className="text-[9px] bg-accent-dim text-accent-bright px-1.5 py-0.5 rounded-full animate-pulse">scanning</span>}
          {isComplete && <CheckCircle2 size={11} className="text-status-ok" />}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {/* Scanning indicator */}
          {isRunning && !liveIncident && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-dim/30 border border-accent-cyan/20">
              <Loader2 size={11} className="text-accent-cyan animate-spin flex-shrink-0" />
              <p className="text-[10px] text-text-muted">Scanning cluster for anomalies...</p>
            </div>
          )}

          {/* Live incident card */}
          {liveIncident && (
            <div className="w-full text-left p-3 rounded-lg border bg-accent-dim border-accent-cyan/40 shadow-glow-cyan">
              <div className="flex items-start gap-3">
                <GlowDot status={isComplete ? 'complete' : 'thinking'} size={7} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-snug text-text-primary line-clamp-2">{liveIncident.title}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant={liveIncident.severity === 'critical' ? 'critical' : liveIncident.severity === 'high' ? 'high' : 'medium'}>
                      {liveIncident.severity}
                    </Badge>
                    <span className={`text-[10px] font-medium ${isComplete ? 'text-status-ok' : 'text-accent-cyan'}`}>
                      {isComplete ? 'Analyzed' : 'Investigating'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex items-center gap-1 text-[10px] text-text-muted">
                      <Clock size={9} />
                      {timeAgo(liveIncident.detectedAt)}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-text-muted">
                      <Server size={9} />
                      {liveIncident.indices.length} indices
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Agent pipeline status */}
          {(liveIncident || isRunning) && (
            <div className="pt-2">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-1 mb-1.5">Agent Pipeline</p>
              {AGENT_ROLES.map(role => {
                const agent = state.run.agents[role];
                const isActive = agent.status === 'thinking' || agent.status === 'executing';
                const isDone = agent.status === 'complete';
                const isSel = selectedRole === role;
                return (
                  <button key={role} onClick={() => { setSelectedRole(isSel ? null : role); setDetailTab('agents'); }}
                    className={`w-full text-left p-2 rounded-lg border transition-all duration-150 mb-1 ${
                      isSel ? 'border-accent-cyan/40 bg-accent-dim' :
                      isActive ? 'border-accent-cyan/20 bg-accent-dim/50' :
                      isDone ? 'border-status-ok/15 bg-status-ok/5' :
                      'border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]'
                    }`}>
                    <div className="flex items-center gap-2">
                      <GlowDot status={agent.status === 'idle' ? 'idle' : isDone ? 'complete' : agent.status === 'error' ? 'error' : 'thinking'} size={5} />
                      <span className={`text-[11px] font-medium ${isActive ? 'text-accent-bright' : isDone ? 'text-status-ok' : 'text-text-secondary'}`}>
                        {ROLE_LABELS[role]}
                      </span>
                      <ProgressRing progress={agent.progressPercent} size={16} strokeWidth={2}
                        color={isDone ? '#10B981' : '#06B6D4'} className="ml-auto" />
                    </div>
                    {isActive && <p className="text-[9px] text-accent-cyan mt-0.5 font-mono animate-pulse">{agent.steps.length} steps</p>}
                    {isDone && <p className="text-[9px] text-status-ok mt-0.5">{agent.steps.length} steps done</p>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Run button */}
          <div className="pt-2">
            <button onClick={isRunning ? stop : run} disabled={status === 'detecting'}
              className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all ${
                status === 'detecting' ? 'bg-white/[0.06] text-text-muted cursor-wait' :
                isRunning ? 'bg-status-critical/15 text-status-critical border border-status-critical/20' :
                'bg-accent-dim text-accent-bright border border-accent-cyan/30 hover:bg-accent-cyan/20'
              }`}>
              {status === 'detecting' ? <><Loader2 size={10} className="animate-spin" /> Scanning...</> :
               isRunning ? <><Activity size={10} className="animate-pulse" /> Stop</> :
               <><Zap size={10} /> {isComplete ? 'Re-run' : 'Run Pipeline'}</>}
            </button>
          </div>

          {!liveIncident && !isRunning && status !== 'error' && (
            <div className="flex flex-col items-center justify-center py-8 text-center px-3">
              <FileSearch size={18} className="text-text-muted mb-2" />
              <p className="text-[11px] text-text-muted leading-relaxed">
                SENTINEL will auto-detect anomalies in your Elasticsearch cluster.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {liveIncident ? (
          <>
            {/* Incident header */}
            <div className="p-4 border-b border-white/[0.06] flex-shrink-0">
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className={`mt-0.5 flex-shrink-0 ${
                  liveIncident.severity === 'critical' ? 'text-status-critical' : 'text-status-warning'
                }`} />
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-text-primary leading-snug">{liveIncident.title}</h2>
                  <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{liveIncident.description}</p>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <Badge variant={liveIncident.severity === 'critical' ? 'critical' : 'high'} size="md">{liveIncident.severity}</Badge>
                    <div className="flex items-center gap-1 text-xs text-text-muted"><Clock size={11} />{timeAgo(liveIncident.detectedAt)}</div>
                    <div className="flex items-center gap-1 text-xs text-text-muted"><Server size={11} />{liveIncident.indices.length} indices</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/[0.06] flex-shrink-0">
              {(['overview', 'agents', 'report'] as const).map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 capitalize ${
                    detailTab === t ? 'text-accent-bright border-accent-cyan' : 'text-text-muted hover:text-text-secondary border-transparent'
                  }`}>
                  {t === 'report' ? 'Full Report' : t}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4">
              {detailTab === 'overview' && (
                <div className="max-w-3xl space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Affected Indices</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {liveIncident.indices.map((idx, i) => (
                        <span key={i} className="px-2 py-1 text-[11px] rounded-md bg-elevated border border-white/[0.06] font-mono text-text-secondary">{idx}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Detection Summary</h3>
                    <p className="text-xs text-text-secondary leading-relaxed">{liveIncident.summary}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Pipeline Progress</h3>
                    <div className="space-y-1.5">
                      {AGENT_ROLES.map(role => {
                        const agent = state.run.agents[role];
                        return (
                          <div key={role} className="flex items-center gap-2 p-2 rounded-lg bg-elevated border border-white/[0.06]">
                            <GlowDot status={agent.status === 'idle' ? 'idle' : agent.status === 'complete' ? 'complete' : agent.status === 'error' ? 'error' : 'thinking'} size={6} />
                            <span className="text-[11px] font-medium text-text-secondary flex-1">{ROLE_LABELS[role]}</span>
                            <span className={`text-[10px] font-mono ${agent.status === 'complete' ? 'text-status-ok' : agent.status === 'thinking' ? 'text-accent-cyan' : 'text-text-muted'}`}>
                              {agent.status}
                            </span>
                            <ProgressRing progress={agent.progressPercent} size={20} strokeWidth={2}
                              color={agent.status === 'complete' ? '#10B981' : '#06B6D4'} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'agents' && (
                <div className="max-w-3xl space-y-4">
                  {selectedRole && state.run.agents[selectedRole].currentReasoning ? (
                    <div className="sentinel-card p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
                        <span className="text-xs font-semibold text-text-primary">{ROLE_LABELS[selectedRole]} — Reasoning</span>
                      </div>
                      <AgentThinkingStream
                        text={state.run.agents[selectedRole].currentReasoning}
                        isActive={state.run.agents[selectedRole].status === 'thinking'}
                        className="max-h-[500px]"
                      />
                      {state.run.agents[selectedRole].steps.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/[0.06]">
                          <p className="text-[10px] font-semibold text-text-muted mb-2">Tool Calls ({state.run.agents[selectedRole].steps.length})</p>
                          <div className="space-y-1">
                            {state.run.agents[selectedRole].steps.map(step => (
                              <div key={step.id} className={`flex items-center gap-2 p-1.5 rounded text-[10px] font-mono ${
                                step.type === 'tool_result' ? 'text-status-ok' : 'text-accent-bright'
                              }`}>
                                <span>{step.type === 'tool_result' ? '✓' : '→'}</span>
                                <span>{step.toolName}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-xs text-text-muted">Select an agent from the sidebar to view its reasoning trace</p>
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'report' && (
                <div className="max-w-3xl">
                  {completedFindings ? (
                    <div className="sentinel-card p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Zap size={12} className="text-accent-cyan" />
                        <span className="text-xs font-semibold text-text-primary">Agent Analysis Report</span>
                      </div>
                      <div className="prose prose-invert prose-xs max-w-none
                        prose-p:text-text-secondary prose-p:text-[11px] prose-p:leading-relaxed prose-p:my-1
                        prose-headings:text-text-primary prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-1
                        prose-h2:text-xs prose-h3:text-[11px]
                        prose-strong:text-text-primary prose-strong:font-semibold
                        prose-code:text-accent-bright prose-code:bg-accent-dim prose-code:px-1 prose-code:rounded prose-code:text-[10px] prose-code:before:content-none prose-code:after:content-none
                        prose-ul:text-[11px] prose-ul:my-1 prose-ul:pl-4
                        prose-ol:text-[11px] prose-ol:my-1 prose-ol:pl-4
                        prose-li:text-text-secondary prose-li:my-0
                        prose-hr:border-white/[0.08]
                        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{completedFindings}</ReactMarkdown>
                      </div>
                    </div>
                  ) : isRunning ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-accent-cyan/20 bg-accent-dim/20">
                      <Loader2 size={14} className="text-accent-cyan animate-spin flex-shrink-0" />
                      <p className="text-xs text-text-muted">Agents are analyzing — the full report will appear here when all agents complete.</p>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FileSearch size={24} className="text-text-muted mx-auto mb-3" />
                      <p className="text-sm text-text-muted">No report yet</p>
                      <p className="text-xs text-text-muted mt-1">Run the pipeline to generate the analysis report</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileSearch size={24} className="text-text-muted mb-3" />
            <p className="text-sm text-text-muted">No incident detected</p>
            <p className="text-xs text-text-muted mt-1">Run the pipeline to detect and analyze live incidents</p>
          </div>
        )}
      </div>
    </div>
  );
}
