/**
 * useLiveAgentOrchestrator
 *
 * Replays a real Elastic Agent Builder ConverseResponse through the
 * AgentStoreContext so the Mission Control orchestration view animates
 * with real reasoning steps instead of demo scripts.
 *
 * Maps Agent Builder step types → SENTINEL agent roles:
 *   First reasoning/tool_call  → planner
 *   search / esql tool calls   → investigator + correlator (parallel)
 *   Later tool calls           → remediator
 *   Final reasoning            → verifier
 */

import { useCallback } from 'react';
import { useAgentStore } from '../store/AgentStoreContext';
import type { ConverseResponse, ConverseStep } from '../lib/agentBuilder';
import type { AgentRole } from '../types/agent.types';

const STEP_DELAY_MS = 600;

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

/** Heuristic: map step index + tool_id to an agent role */
function mapStepToRole(step: ConverseStep, index: number, total: number): AgentRole {
  if (index === 0) return 'planner';
  if (step.type === 'tool_call') {
    const toolId = step.tool_id ?? '';
    if (toolId.includes('search') || toolId.includes('list')) return 'investigator';
    if (toolId.includes('esql') || toolId.includes('mapping')) return 'correlator';
    if (index < total * 0.7) return 'remediator';
  }
  if (index >= total - 1) return 'verifier';
  return 'remediator';
}

export function useLiveAgentOrchestrator() {
  const { setAgentStatus, setReasoning, appendReasoning, setHandoff, resetRun } = useAgentStore();

  const replayResponse = useCallback(async (
    response: ConverseResponse,
    incidentId = 'live-query'
  ) => {
    resetRun(incidentId);
    await sleep(200);

    const steps = response.steps ?? [];
    const total = steps.length;

    
    const activated = new Set<AgentRole>();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const role = mapStepToRole(step, i, total);

      if (!activated.has(role)) {
        activated.add(role);
        setAgentStatus(role, 'thinking', Math.round((i / total) * 60));
        if (i > 0) {
          const prevRoles = Array.from(activated);
          const prevRole = prevRoles[prevRoles.length - 2] as AgentRole | undefined;
          if (prevRole) setHandoff(prevRole, role);
        }
        await sleep(STEP_DELAY_MS);
      }

      if (step.type === 'reasoning' && step.reasoning) {
        setReasoning(role, '');
       
        const text = step.reasoning;
        for (let c = 0; c < text.length; c++) {
          appendReasoning(role, text[c]);
          if (c % 8 === 0) await sleep(0); 
        }
      } else if (step.type === 'tool_call') {
        const toolText = `[${step.tool_id}] ${JSON.stringify(step.params ?? {}).slice(0, 120)}`;
        setReasoning(role, toolText);
        await sleep(STEP_DELAY_MS);
      }

      
      setAgentStatus(role, 'thinking', Math.round(((i + 1) / total) * 80));
      await sleep(200);
    }

    
    for (const role of activated) {
      setAgentStatus(role, 'complete', 100);
      await sleep(150);
    }

    
    if (!activated.has('verifier')) {
      setAgentStatus('verifier', 'thinking', 50);
      await sleep(STEP_DELAY_MS);
    }
    setReasoning('verifier', response.response?.message ?? 'Analysis complete.');
    setAgentStatus('verifier', 'complete', 100);
  }, [setAgentStatus, setReasoning, appendReasoning, setHandoff, resetRun]);

  return { replayResponse };
}
