import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { AgentRole } from '../../types/agent.types';
import { useAgentStore } from '../../store/AgentStoreContext';
import { AgentNode } from './AgentNode';
import { AgentConnectors } from './AgentConnector';
import { AgentThinkingStream } from './AgentThinkingStream';
import { GlowDot } from '../ui/GlowDot';
import { ProgressRing } from '../ui/ProgressRing';

const AGENT_ROLES: AgentRole[] = ['planner', 'investigator', 'correlator', 'remediator', 'verifier'];

const ROLE_LABELS: Record<AgentRole, string> = {
  planner: 'Planner',
  investigator: 'Investigator',
  correlator: 'Correlator',
  remediator: 'Remediator',
  verifier: 'Verifier',
};

const ROLE_DESC: Record<AgentRole, string> = {
  planner: 'Decomposes incident & orchestrates',
  investigator: 'Root cause deep-dive',
  correlator: 'Cross-service impact analysis',
  remediator: 'Workflow execution & fixes',
  verifier: 'Post-fix validation',
};

const AGENT_LAYOUT: Record<AgentRole, { row: number; col: number }> = {
  planner:      { row: 0, col: 1 },
  investigator: { row: 1, col: 0 },
  correlator:   { row: 1, col: 2 },
  remediator:   { row: 2, col: 1 },
  verifier:     { row: 3, col: 1 },
};

const CONNECTIONS: Array<{ from: AgentRole; to: AgentRole }> = [
  { from: 'planner', to: 'investigator' },
  { from: 'planner', to: 'correlator' },
  { from: 'investigator', to: 'remediator' },
  { from: 'correlator', to: 'remediator' },
  { from: 'remediator', to: 'verifier' },
];

const NODE_W = 220;
const NODE_H = 80;
const ROW_GAP = 20;
const ROWS = 4;
const COLS = 3;

const PROGRESS_COLORS: Record<string, string> = {
  thinking: '#06B6D4',
  executing: '#06B6D4',
  complete: '#10B981',
  error: '#EF4444',
  idle: 'rgba(255,255,255,0.12)',
  waiting: '#F59E0B',
};


export function AgentOrchestrationView({ className = '', sidebar = false }: { className?: string; sidebar?: boolean }) {
  const { state } = useAgentStore();
  const [expandedRole, setExpandedRole] = useState<AgentRole | null>('planner');
  const [manualSelect, setManualSelect] = useState(false);


  const activeRole = AGENT_ROLES.find(r => {
    const s = state.run.agents[r].status;
    return s === 'thinking' || s === 'executing';
  });

  const effectiveExpanded: AgentRole | null = (!manualSelect && activeRole) ? activeRole : expandedRole;

  const handleToggle = (role: AgentRole) => {
    setManualSelect(true);
    setExpandedRole(effectiveExpanded === role ? null : role);
    
    setTimeout(() => setManualSelect(false), 10000);
  };

  
  if (sidebar) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {AGENT_ROLES.map((role, idx) => {
          const agent = state.run.agents[role];
          const isActive = agent.status === 'thinking' || agent.status === 'executing';
          const isComplete = agent.status === 'complete';
          const isExpanded = effectiveExpanded === role;
          const progressColor = PROGRESS_COLORS[agent.status] ?? '#06B6D4';

          return (
            <div key={role}>
              {/* Connector line between cards */}
              {idx > 0 && (
                <div className="flex justify-center my-0.5">
                  <div className={`w-px h-3 ${isComplete ? 'bg-status-ok/40' : 'bg-white/[0.08]'}`} />
                </div>
              )}
              <button
                onClick={() => handleToggle(role)}
                className={`w-full text-left rounded-lg border transition-all duration-150 p-2.5 ${
                  isActive
                    ? 'border-accent-cyan/30 bg-accent-dim'
                    : isComplete
                    ? 'border-status-ok/20 bg-status-ok/5'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.10] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <GlowDot
                    status={agent.status === 'idle' ? 'idle' : agent.status === 'complete' ? 'complete' : agent.status === 'error' ? 'error' : 'thinking'}
                    size={6}
                  />
                  <span className={`text-xs font-semibold ${isActive ? 'text-accent-bright' : isComplete ? 'text-status-ok' : 'text-text-secondary'}`}>
                    {ROLE_LABELS[role]}
                  </span>
                  {isActive && (
                    <Loader2 size={9} className="text-accent-cyan animate-spin ml-auto" />
                  )}
                  {isComplete && (
                    <CheckCircle2 size={9} className="text-status-ok ml-auto" />
                  )}
                  {!isActive && !isComplete && (
                    <ProgressRing progress={agent.progressPercent} size={18} strokeWidth={2} color={progressColor} />
                  )}
                </div>
                <p className="text-[10px] text-text-muted mt-0.5 truncate">{ROLE_DESC[role]}</p>
                {(isActive || isComplete) && (
                  <div className="text-[9px] font-mono mt-1">
                    {isActive
                      ? <span className="text-accent-cyan animate-pulse">{agent.steps.length} steps · reasoning...</span>
                      : <span className="text-status-ok">{agent.steps.length} steps complete</span>
                    }
                  </div>
                )}
              </button>

              {/* Inline reasoning expansion */}
              {isExpanded && agent.currentReasoning && (
                <div className="mt-1 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <AgentThinkingStream
                    text={agent.currentReasoning}
                    isActive={isActive}
                    className="max-h-[120px] overflow-y-auto"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  
  const totalW = 800;
  const nodeAreaW = NODE_W * COLS + 60 * (COLS - 1);
  const offsetX = (totalW - nodeAreaW) / 2;

  const nodePositions: Record<AgentRole, { x: number; y: number; cx: number; cy: number }> = {} as Record<AgentRole, { x: number; y: number; cx: number; cy: number }>;

  Object.entries(AGENT_LAYOUT).forEach(([role, pos]) => {
    const colFraction = [0, 0.5, 1][pos.col];
    const x = offsetX + colFraction * (nodeAreaW - NODE_W);
    const y = pos.row * (NODE_H + ROW_GAP);
    nodePositions[role as AgentRole] = { x, y, cx: x + NODE_W / 2, cy: y + NODE_H / 2 };
  });

  const svgH = ROWS * (NODE_H + ROW_GAP);

  const svgConnections = CONNECTIONS.map(({ from, to }) => ({
    from,
    to,
    x1: nodePositions[from].cx,
    y1: nodePositions[from].cy,
    x2: nodePositions[to].cx,
    y2: nodePositions[to].cy,
  }));

  const expandedAgent = effectiveExpanded ? state.run.agents[effectiveExpanded] : null;

  return (
    <div className={`flex gap-4 ${className}`}>
      <div className="relative flex-1 min-w-0">
        <div style={{ position: 'relative', height: svgH + 20 }}>
          <svg
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: svgH + 20, overflow: 'visible' }}
            viewBox={`0 0 ${totalW} ${svgH}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <AgentConnectors
              connections={svgConnections}
              activeHandoff={state.activeHandoff}
              svgWidth={totalW}
              svgHeight={svgH}
            />
          </svg>

          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' }}>
            {(Object.entries(nodePositions) as Array<[AgentRole, { x: number; y: number; cx: number; cy: number }]>).map(([role, pos]) => {
              const agent = state.run.agents[role];
              const isExpanded = effectiveExpanded === role;

              return (
                <div
                  key={role}
                  style={{
                    position: 'absolute',
                    top: pos.y,
                    left: `${(pos.x / totalW) * 100}%`,
                    width: NODE_W,
                    pointerEvents: 'auto',
                  }}
                >
                  <AgentNode
                    agent={agent}
                    isExpanded={isExpanded}
                    onToggleExpand={() => handleToggle(role)}
                    compact
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {expandedAgent && (expandedAgent.status === 'thinking' || expandedAgent.status === 'executing' || expandedAgent.status === 'complete') && expandedAgent.currentReasoning && (
        <div className="w-[340px] flex-shrink-0 sentinel-card p-4 flex flex-col" style={{ maxHeight: svgH + 20 }}>
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06]">
            <div className={`w-1.5 h-1.5 rounded-full ${expandedAgent.status === 'complete' ? 'bg-status-ok' : 'bg-accent-cyan animate-pulse'}`} />
            <span className="text-xs font-semibold text-accent-bright capitalize">{expandedAgent.role} Reasoning</span>
            {expandedAgent.status === 'complete' && <CheckCircle2 size={10} className="text-status-ok ml-auto" />}
            {(expandedAgent.status === 'thinking' || expandedAgent.status === 'executing') && (
              <Loader2 size={10} className="text-accent-cyan animate-spin ml-auto" />
            )}
          </div>
          {/* Tool calls summary */}
          {expandedAgent.steps.length > 0 && (
            <div className="mb-2 pb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-semibold text-text-muted">Tool Calls</span>
                <span className="text-[9px] text-text-muted font-mono ml-auto">{expandedAgent.steps.length}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {expandedAgent.steps.slice(-6).map((step) => (
                  <span key={step.id} className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                    step.type === 'tool_result' ? 'bg-status-ok/10 text-status-ok' : 'bg-accent-dim text-accent-bright'
                  }`}>
                    {step.type === 'tool_result' ? '✓' : '→'} {step.toolName}
                  </span>
                ))}
              </div>
            </div>
          )}
          <AgentThinkingStream
            text={expandedAgent.currentReasoning}
            isActive={expandedAgent.status === 'thinking' || expandedAgent.status === 'executing'}
            className="flex-1"
          />
        </div>
      )}
    </div>
  );
}
