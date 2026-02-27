import { Brain, Search, GitMerge, Wrench, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';
import type { AgentState } from '../../types/agent.types';
import { GlowDot } from '../ui/GlowDot';
import { ProgressRing } from '../ui/ProgressRing';
import { AgentThinkingStream } from './AgentThinkingStream';

const AGENT_META = {
  planner: { label: 'Planner', icon: Brain, description: 'Decomposes incident & orchestrates' },
  investigator: { label: 'Investigator', icon: Search, description: 'Root cause deep-dive' },
  correlator: { label: 'Correlator', icon: GitMerge, description: 'Cross-service impact analysis' },
  remediator: { label: 'Remediator', icon: Wrench, description: 'Workflow execution & fixes' },
  verifier: { label: 'Verifier', icon: ShieldCheck, description: 'Post-fix validation' },
};

const STATUS_GLOW = {
  thinking: 'agent-card thinking',
  executing: 'agent-card thinking',
  complete: 'agent-card complete',
  error: 'agent-card error',
  idle: 'agent-card',
  waiting: 'agent-card',
};

const PROGRESS_COLORS = {
  thinking: '#06B6D4',
  executing: '#06B6D4',
  complete: '#10B981',
  error: '#EF4444',
  idle: 'rgba(255,255,255,0.12)',
  waiting: '#F59E0B',
};

interface AgentNodeProps {
  agent: AgentState;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  /** compact=true suppresses the inline reasoning stream — used in the orchestration graph
   *  where nodes are absolutely positioned and must stay fixed-height to avoid overlap */
  compact?: boolean;
  className?: string;
}

export function AgentNode({ agent, isExpanded, onToggleExpand, compact = false, className = '' }: AgentNodeProps) {
  const meta = AGENT_META[agent.role];
  const Icon = meta.icon;
  const cardClass = STATUS_GLOW[agent.status] ?? 'agent-card';
  const progressColor = PROGRESS_COLORS[agent.status] ?? '#06B6D4';
  const isActive = agent.status === 'thinking' || agent.status === 'executing';
  const isComplete = agent.status === 'complete';
  const isError = agent.status === 'error';
  const stepCount = agent.steps.length;

  return (
    <div
      className={`${cardClass} ${className} ${onToggleExpand ? 'cursor-pointer' : ''}`}
      onClick={onToggleExpand}
      style={{ minWidth: 200 }}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0 mt-0.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isActive ? 'bg-accent-dim' : isComplete ? 'bg-status-ok/10' : isError ? 'bg-status-critical/10' : 'bg-white/[0.06]'
          }`}>
            {isActive ? (
              <Loader2 size={14} className="text-accent-bright animate-spin" />
            ) : (
              <Icon size={14} className={isComplete ? 'text-status-ok' : isError ? 'text-status-critical' : 'text-text-muted'} />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-primary tracking-tight">{meta.label}</span>
            <GlowDot
              status={agent.status === 'idle' ? 'idle' : agent.status === 'complete' ? 'complete' : agent.status === 'error' ? 'error' : 'thinking'}
              size={6}
            />
          </div>
          <p className="text-[10px] text-text-muted mt-0.5 truncate">{meta.description}</p>

          {isActive && (
            <div className="mt-1 text-[10px] font-mono">
              {compact ? (
                <span className="text-accent-cyan animate-pulse">reasoning...</span>
              ) : (
                <span className="text-text-muted">{stepCount > 0 ? `Step ${stepCount}` : 'Initializing...'}</span>
              )}
            </div>
          )}

          {isComplete && compact && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-status-ok">
              <CheckCircle2 size={9} />
              <span>Complete</span>
            </div>
          )}
        </div>

        <ProgressRing
          progress={agent.progressPercent}
          size={30}
          strokeWidth={2.5}
          color={progressColor}
        />
      </div>

      {/* Only show inline reasoning stream when NOT in compact/graph mode */}
      {!compact && (isActive || isComplete) && agent.currentReasoning && (
        <div className={`mt-3 pt-3 border-t border-white/[0.06] ${isExpanded ? '' : 'max-h-[80px] overflow-hidden'}`}>
          <AgentThinkingStream
            text={isExpanded ? agent.currentReasoning : agent.currentReasoning.slice(0, 300)}
            isActive={isActive}
          />
        </div>
      )}

      {!compact && isComplete && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-status-ok">
          <CheckCircle2 size={10} />
          <span>Analysis complete · {stepCount} steps</span>
        </div>
      )}
    </div>
  );
}
