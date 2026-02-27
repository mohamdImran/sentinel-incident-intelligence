import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Play, RotateCcw, Activity, GripVertical, Zap, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { AgentOrchestrationView } from '../components/agents/AgentOrchestrationView';
import { AgentThinkingStream } from '../components/agents/AgentThinkingStream';
import { ProgressRing } from '../components/ui/ProgressRing';
import { GlowDot } from '../components/ui/GlowDot';
import { Badge } from '../components/ui/Badge';
import { useAgentStore } from '../store/AgentStoreContext';
import { useDemoStore } from '../store/DemoStoreContext';
import { useLiveRunner } from '../store/LiveRunnerContext';
import { DEMO_CONFIG } from '../config/demo.config';
import type { AgentRole } from '../types/agent.types';

const AGENT_ROLES: AgentRole[] = ['planner', 'investigator', 'correlator', 'remediator', 'verifier'];
const ROLE_LABELS: Record<AgentRole, string> = {
  planner: 'Planner',
  investigator: 'Investigator',
  correlator: 'Correlator',
  remediator: 'Remediator',
  verifier: 'Verifier',
};

const SCENARIO_INCIDENT_LABELS = [
  'INC-001 · Connection Pool Cascade',
  'INC-002 · CDN Origin Failover Failure',
  'INC-003 · Credential Stuffing Attack',
];

const STATUS_BADGE: Record<string, 'info' | 'ok' | 'critical' | 'default' | 'medium'> = {
  thinking: 'info',
  executing: 'info',
  complete: 'ok',
  error: 'critical',
  idle: 'default',
  waiting: 'medium',
};

const MIN_RIGHT_WIDTH = 260;
const MAX_RIGHT_WIDTH = 600;
const DEFAULT_RIGHT_WIDTH = 340;

function RightPanel({ rightWidth, startResize }: { rightWidth: number; startResize: (e: React.MouseEvent) => void }) {
  return (
    <div className="flex flex-shrink-0 overflow-hidden" style={{ width: rightWidth }}>
      {/* Drag handle on the LEFT edge of the panel */}
      <div
        onMouseDown={startResize}
        className="w-3 flex-shrink-0 flex items-center justify-center cursor-col-resize hover:bg-accent-cyan/10 transition-colors group border-l border-white/[0.06]"
        title="Drag to resize"
      >
        <GripVertical size={10} className="text-white/20 group-hover:text-accent-cyan transition-colors" />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 border-l border-white/[0.04]">
        <div className="p-3 border-b border-white/[0.06]">
          <span className="text-xs font-semibold text-text-primary">All Agents · Overview</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <AgentOrchestrationView sidebar />
        </div>
      </div>
    </div>
  );
}

export function AgentsPage() {
  const { state } = useAgentStore();
  const { isPlaying, play, pause, reset, scenarioIndex } = useDemoStore();
  const { status: runnerStatus, incident, error: runnerError, run, stop } = useLiveRunner();
  const [selectedRole, setSelectedRole] = useState<AgentRole>('planner');
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_RIGHT_WIDTH);

  
  const activeRole = AGENT_ROLES.find(r => {
    const s = state.run.agents[r].status;
    return s === 'thinking' || s === 'executing';
  });

  const [manualSelection, setManualSelection] = useState(false);
  const effectiveRole: AgentRole = (!manualSelection && activeRole) ? activeRole : selectedRole;

  const handleSelectRole = (role: AgentRole) => {
    setSelectedRole(role);
    setManualSelection(true);
  };

  const prevActiveRole = useRef<AgentRole | undefined>(undefined);
  useEffect(() => {
    if (activeRole && activeRole !== prevActiveRole.current) {
      prevActiveRole.current = activeRole;
      if (!manualSelection) setSelectedRole(activeRole);
    }
    if (!activeRole) setManualSelection(false);
  }, [activeRole, manualSelection]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = rightWidth;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      
      const delta = startXRef.current - ev.clientX;
      const newW = Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, startWidthRef.current + delta));
      setRightWidth(newW);
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [rightWidth]);

  const selectedAgent = state.run.agents[effectiveRole];
  const activeCount = AGENT_ROLES.filter(r =>
    state.run.agents[r].status === 'thinking' || state.run.agents[r].status === 'executing'
  ).length;

  if (!DEMO_CONFIG.DEMO_MODE) {
    const isRunning = runnerStatus === 'running' || runnerStatus === 'detecting';

    return (
      <div className="flex h-full overflow-hidden">
        {/* Left sidebar */}
        <div className="w-[200px] flex-shrink-0 border-r border-white/[0.06] flex flex-col">
          <div className="p-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 mb-2">
              <Bot size={13} className="text-accent-cyan" />
              <span className="text-xs font-semibold text-text-primary">Agents</span>
              {isRunning && (
                <span className="ml-auto text-[9px] bg-accent-dim text-accent-bright px-1.5 py-0.5 rounded-full font-semibold animate-pulse">
                  live
                </span>
              )}
            </div>
            {/* Run / Stop button */}
            <button
              onClick={isRunning ? stop : run}
              disabled={runnerStatus === 'detecting'}
              className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-semibold transition-all ${
                runnerStatus === 'detecting'
                  ? 'bg-white/[0.06] text-text-muted cursor-wait'
                  : isRunning
                    ? 'bg-status-critical/15 text-status-critical border border-status-critical/20 hover:bg-status-critical/25'
                    : 'bg-accent-dim text-accent-bright border border-accent-cyan/30 hover:bg-accent-cyan/20'
              }`}
            >
              {runnerStatus === 'detecting'
                ? <><Loader2 size={9} className="animate-spin" /> Detecting...</>
                : isRunning
                  ? <><Activity size={9} className="animate-pulse" /> Stop</>
                  : <><Zap size={9} /> Run Live Pipeline</>
              }
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {AGENT_ROLES.map(role => {
              const agent = state.run.agents[role];
              const isSelected = effectiveRole === role;
              const isActive = agent.status === 'thinking' || agent.status === 'executing';
              return (
                <button key={role} onClick={() => handleSelectRole(role)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all duration-150 ${
                    isSelected ? 'border-accent-cyan/40 bg-accent-dim' : 'border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]'
                  }`}>
                  <div className="flex items-center gap-2">
                    <GlowDot
                      status={agent.status === 'idle' ? 'idle' : agent.status === 'complete' ? 'complete' : agent.status === 'error' ? 'error' : 'thinking'}
                      size={6}
                    />
                    <span className={`text-xs font-medium ${isSelected ? 'text-accent-bright' : 'text-text-secondary'}`}>
                      {ROLE_LABELS[role]}
                    </span>
                    <div className="ml-auto">
                      <ProgressRing progress={agent.progressPercent} size={22} strokeWidth={2}
                        color={agent.status === 'complete' ? '#10B981' : '#06B6D4'} />
                    </div>
                  </div>
                  {isActive && (
                    <div className="text-[9px] text-accent-cyan mt-1 font-mono animate-pulse">
                      {agent.steps.length} steps · reasoning...
                    </div>
                  )}
                  {agent.status === 'complete' && (
                    <div className="text-[9px] text-status-ok mt-1">{agent.steps.length} steps complete</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main reasoning panel */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          {/* Header */}
          <div className="p-4 border-b border-white/[0.06] flex items-center gap-3 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <h2 className="text-xs font-semibold text-text-primary">{ROLE_LABELS[effectiveRole]} Agent</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant={STATUS_BADGE[state.run.agents[effectiveRole].status] ?? 'default'}>
                  {state.run.agents[effectiveRole].status}
                </Badge>
                {incident && (
                  <span className="text-[10px] text-text-muted truncate">{incident.title}</span>
                )}
                {!incident && runnerStatus === 'idle' && (
                  <span className="text-[10px] text-text-muted">Click "Run Live Pipeline" to start</span>
                )}
              </div>
            </div>
            <ProgressRing
              progress={state.run.agents[effectiveRole].progressPercent}
              size={40} strokeWidth={3}
              color={state.run.agents[effectiveRole].status === 'complete' ? '#10B981' : '#06B6D4'}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Error state */}
            {runnerStatus === 'error' && runnerError && (
              <div className="flex gap-3 p-4 rounded-xl border border-status-critical/20 bg-status-critical/10">
                <AlertCircle size={16} className="text-status-critical flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-status-critical mb-1">Pipeline Error</p>
                  <p className="text-[11px] text-status-critical/80 leading-relaxed">{runnerError}</p>
                </div>
              </div>
            )}

            {/* Complete state */}
            {runnerStatus === 'complete' && (
              <div className="flex gap-3 p-4 rounded-xl border border-status-ok/20 bg-status-ok/10">
                <CheckCircle2 size={16} className="text-status-ok flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-status-ok mb-1">Pipeline Complete</p>
                  <p className="text-[11px] text-status-ok/80">All 5 agents completed analysis. Click "Run Live Pipeline" to run again.</p>
                </div>
              </div>
            )}

            {/* Detecting state */}
            {runnerStatus === 'detecting' && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-accent-cyan/20 bg-accent-dim/30">
                <Loader2 size={16} className="text-accent-cyan animate-spin flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-accent-bright">Scanning Elasticsearch</p>
                  <p className="text-[11px] text-text-muted mt-0.5">Detecting anomalies and building incident context...</p>
                </div>
              </div>
            )}

            {/* Reasoning trace */}
            {state.run.agents[effectiveRole].currentReasoning && (
              <div className="sentinel-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
                  <span className="text-xs font-semibold text-text-primary">Reasoning Trace</span>
                  <span className="ml-auto text-[10px] text-text-muted">Elastic Agent Builder · live</span>
                </div>
                <AgentThinkingStream
                  text={state.run.agents[effectiveRole].currentReasoning}
                  isActive={state.run.agents[effectiveRole].status === 'thinking' || state.run.agents[effectiveRole].status === 'executing'}
                  className="max-h-none"
                />
              </div>
            )}

            {/* Tool calls */}
            {state.run.agents[effectiveRole].steps.length > 0 && (
              <div className="sentinel-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-text-primary">Tool Calls</span>
                  <span className="ml-auto text-[10px] text-text-muted">{state.run.agents[effectiveRole].steps.length} steps</span>
                </div>
                <div className="space-y-2">
                  {state.run.agents[effectiveRole].steps.map((step) => (
                    <div key={step.id} className={`flex items-start gap-2 p-2 rounded-lg text-[10px] font-mono ${
                      step.type === 'tool_result' ? 'bg-status-ok/5 border border-status-ok/10' : 'bg-white/[0.03] border border-white/[0.06]'
                    }`}>
                      <span className={`mt-0.5 flex-shrink-0 ${step.type === 'tool_result' ? 'text-status-ok' : 'text-accent-cyan'}`}>
                        {step.type === 'tool_result' ? '✓' : '→'}
                      </span>
                      <div className="min-w-0">
                        <span className={step.type === 'tool_result' ? 'text-status-ok' : 'text-accent-bright'}>{step.toolName}</span>
                        {step.result && <p className="text-text-muted mt-0.5 truncate">{step.result}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Idle state — prompt to run */}
            {runnerStatus === 'idle' && !state.run.agents[effectiveRole].currentReasoning && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-accent-dim border border-accent-cyan/20 flex items-center justify-center mb-4">
                  <Zap size={22} className="text-accent-bright" />
                </div>
                <p className="text-sm font-semibold text-text-primary mb-2">Live Agent Pipeline</p>
                <p className="text-xs text-text-muted max-w-xs leading-relaxed mb-6">
                  SENTINEL will scan your Elasticsearch cluster for anomalies, then run all 5 agents — Planner, Investigator, Correlator, Remediator, Verifier — against real data.
                </p>
                <button onClick={run}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-cyan text-sm font-semibold hover:bg-accent-bright transition-colors"
                  style={{ color: '#0B0F14' }}>
                  <Zap size={14} /> Run Live Pipeline
                </button>
                <p className="text-[10px] text-text-muted mt-3">Requires deployed agents — use Agent Builder → Deploy tab</p>
              </div>
            )}
          </div>
        </div>

        <RightPanel rightWidth={rightWidth} startResize={startResize} />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <div className="w-[200px] flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-2">
            <Bot size={13} className="text-accent-cyan" />
            <span className="text-xs font-semibold text-text-primary">Agents</span>
            {activeCount > 0 && (
              <span className="ml-auto text-[9px] bg-accent-dim text-accent-bright px-1.5 py-0.5 rounded-full font-semibold">
                {activeCount} active
              </span>
            )}
          </div>
          <div className="flex gap-1">
            <button
              onClick={isPlaying ? pause : play}
              className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] bg-accent-dim text-accent-bright hover:bg-accent-cyan/20 transition-colors"
            >
              <Play size={9} />
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={reset}
              className="px-2 py-1 rounded text-[10px] text-text-muted hover:text-text-secondary hover:bg-white/5 transition-colors"
            >
              <RotateCcw size={9} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {AGENT_ROLES.map(role => {
            const agent = state.run.agents[role];
            const isSelected = effectiveRole === role;
            const isActive = agent.status === 'thinking' || agent.status === 'executing';

            return (
              <button
                key={role}
                onClick={() => handleSelectRole(role)}
                className={`w-full text-left p-2.5 rounded-lg border transition-all duration-150 ${
                  isSelected
                    ? 'border-accent-cyan/40 bg-accent-dim'
                    : 'border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <GlowDot
                    status={agent.status === 'idle' ? 'idle' : agent.status === 'complete' ? 'complete' : agent.status === 'error' ? 'error' : 'thinking'}
                    size={6}
                  />
                  <span className={`text-xs font-medium ${isSelected ? 'text-accent-bright' : 'text-text-secondary'}`}>
                    {ROLE_LABELS[role]}
                  </span>
                  <div className="ml-auto">
                    <ProgressRing
                      progress={agent.progressPercent}
                      size={22}
                      strokeWidth={2}
                      color={agent.status === 'complete' ? '#10B981' : '#06B6D4'}
                    />
                  </div>
                </div>
                {isActive && (
                  <div className="text-[9px] text-accent-cyan mt-1 font-mono animate-pulse">
                    {agent.steps.length} steps · reasoning...
                  </div>
                )}
                {agent.status === 'complete' && (
                  <div className="text-[9px] text-status-ok mt-1">
                    {agent.steps.length} steps complete
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main reasoning panel */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3 flex-shrink-0">
          <div>
            <h2 className="text-xs font-semibold text-text-primary">
              {ROLE_LABELS[effectiveRole]} Agent
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={STATUS_BADGE[selectedAgent.status] ?? 'default'}>
                {selectedAgent.status}
              </Badge>
              <span className="text-[10px] text-text-muted">
                {SCENARIO_INCIDENT_LABELS[scenarioIndex] ?? SCENARIO_INCIDENT_LABELS[0]}
              </span>
            </div>
          </div>
          <div className="ml-auto">
            <ProgressRing
              progress={selectedAgent.progressPercent}
              size={40}
              strokeWidth={3}
              color={selectedAgent.status === 'complete' ? '#10B981' : '#06B6D4'}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedAgent.currentReasoning && (
            <div className="sentinel-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
                <span className="text-xs font-semibold text-text-primary">Reasoning Trace</span>
                <span className="ml-auto text-[10px] text-text-muted">Elastic Agent Builder · chain-of-thought</span>
              </div>
              <AgentThinkingStream
                text={selectedAgent.currentReasoning}
                isActive={selectedAgent.status === 'thinking'}
                className="max-h-none"
              />
            </div>
          )}

          {selectedAgent.steps.length > 0 && (
            <div className="sentinel-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-text-primary">Tool Calls</span>
                <span className="ml-auto text-[10px] text-text-muted">{selectedAgent.steps.length} steps</span>
              </div>
              <div className="space-y-2">
                {selectedAgent.steps.map((step) => (
                  <div key={step.id} className={`flex items-start gap-2 p-2 rounded-lg text-[10px] font-mono ${
                    step.type === 'tool_result'
                      ? 'bg-status-ok/5 border border-status-ok/10'
                      : 'bg-white/[0.03] border border-white/[0.06]'
                  }`}>
                    <span className={`mt-0.5 flex-shrink-0 ${step.type === 'tool_result' ? 'text-status-ok' : 'text-accent-cyan'}`}>
                      {step.type === 'tool_result' ? '✓' : '→'}
                    </span>
                    <div className="min-w-0">
                      <span className={step.type === 'tool_result' ? 'text-status-ok' : 'text-accent-bright'}>
                        {step.toolName}
                      </span>
                      {step.result && (
                        <p className="text-text-muted mt-0.5 truncate">{step.result}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!selectedAgent.currentReasoning && selectedAgent.status === 'idle' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
                <Bot size={20} className="text-text-muted" />
              </div>
              <p className="text-sm text-text-muted">Agent idle</p>
              <p className="text-xs text-text-muted mt-1">Waiting for incident assignment</p>
            </div>
          )}
        </div>
      </div>

      <RightPanel rightWidth={rightWidth} startResize={startResize} />
    </div>
  );
}
