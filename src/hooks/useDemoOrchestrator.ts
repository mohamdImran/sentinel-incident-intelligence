import { useEffect, useRef, useCallback } from 'react';
import { DEMO_CONFIG } from '../config/demo.config';
import { ALL_SCENARIO_SCRIPTS, type ScriptedStep } from '../data/demo-agent-scripts';
import { useAgentStore } from '../store/AgentStoreContext';
import { useDemoStore } from '../store/DemoStoreContext';
import type { AgentRole, AgentStatus } from '../types/agent.types';

const TOTAL_DEMO_DURATION_MS = 46000;

export function useDemoOrchestrator() {
  const { setAgentStatus, appendReasoning, setReasoning, resetRun, setHandoff, addStep } = useAgentStore();
  const demoStoreValue = useDemoStore();
  const { cycleCount, scenarioIndex } = demoStoreValue;
  const demoStoreRef = useRef(demoStoreValue);

  const lastTimeRef = useRef<number | null>(null);
  const firedStepsRef = useRef<Set<string>>(new Set());
  const typingIntervalsRef = useRef<Map<AgentRole, ReturnType<typeof setInterval>>>(new Map());
  const rafRef = useRef<number | null>(null);
  const loopFinishedRef = useRef(false);
  const loopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleCountRef = useRef(cycleCount);
  const scenarioIndexRef = useRef(scenarioIndex);

  const agentActionsRef = useRef({ setAgentStatus, appendReasoning, setReasoning, resetRun, setHandoff, addStep });
  agentActionsRef.current = { setAgentStatus, appendReasoning, setReasoning, resetRun, setHandoff, addStep };

  const stopTyping = useCallback((role: AgentRole) => {
    const id = typingIntervalsRef.current.get(role);
    if (id !== undefined) clearInterval(id);
    typingIntervalsRef.current.delete(role);
  }, []);

  const startTyping = useCallback((role: AgentRole, text: string) => {
    stopTyping(role);
    agentActionsRef.current.setReasoning(role, '');
    let pos = 0;
    const id = setInterval(() => {
      if (pos < text.length) {
        agentActionsRef.current.appendReasoning(role, text[pos]);
        pos++;
      } else {
        clearInterval(id);
        typingIntervalsRef.current.delete(role);
      }
    }, Math.max(5, DEMO_CONFIG.AGENT_TYPING_SPEED_MS));
    typingIntervalsRef.current.set(role, id);
  }, [stopTyping]);

  const fireStep = useCallback((step: ScriptedStep, stepKey: string) => {
    if (firedStepsRef.current.has(stepKey)) return;
    firedStepsRef.current.add(stepKey);

    switch (step.type) {
      case 'status_change': {
        const { status, progress } = step.payload as { status: AgentStatus; progress?: number };
        agentActionsRef.current.setAgentStatus(step.agentRole, status, progress);
        break;
      }
      case 'reasoning_text': {
        const { text } = step.payload as { text: string };
        startTyping(step.agentRole, text);
        break;
      }
      case 'tool_call_start': {
        const { toolName, id } = step.payload as { toolName: string; id: string };
        agentActionsRef.current.addStep(step.agentRole, {
          id,
          type: 'tool_call',
          toolName,
          status: 'running',
          startedAt: new Date().toISOString(),
        });
        break;
      }
      case 'tool_call_complete': {
        const { id: tcId, resultSummary } = step.payload as { id: string; resultSummary: string };
        agentActionsRef.current.addStep(step.agentRole, {
          id: `${tcId}-result`,
          type: 'tool_result',
          toolName: tcId,
          status: 'complete',
          result: resultSummary,
          startedAt: new Date().toISOString(),
        });
        break;
      }
      case 'handoff': {
        const { to } = step.payload as { to: AgentRole };
        agentActionsRef.current.setHandoff(step.agentRole, to);
        break;
      }
      default: break;
    }
  }, [startTyping]);

  demoStoreRef.current = demoStoreValue;

  useEffect(() => {
    if (!DEMO_CONFIG.DEMO_MODE) return;
    cycleCountRef.current = cycleCount;
    scenarioIndexRef.current = scenarioIndex;
    firedStepsRef.current = new Set();
    loopFinishedRef.current = false;
    typingIntervalsRef.current.forEach((_, role) => stopTyping(role));
    
    const incidentIds = ['inc-001', 'inc-002', 'inc-003'];
    agentActionsRef.current.resetRun(incidentIds[scenarioIndex] ?? 'inc-001');
  }, [cycleCount, scenarioIndex, stopTyping]);

  useEffect(() => {
    if (!DEMO_CONFIG.DEMO_MODE) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    loopFinishedRef.current = false;
    lastTimeRef.current = null;

    const loop = (time: number) => {
      const store = demoStoreRef.current;
      if (!store.isPlaying) {
        lastTimeRef.current = null;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
      }

      const delta = Math.min(time - lastTimeRef.current, 100);
      lastTimeRef.current = time;
      store.tick(delta);

      const currentOffset = store.currentOffsetMs;
      const activeScripts = ALL_SCENARIO_SCRIPTS[scenarioIndexRef.current] ?? ALL_SCENARIO_SCRIPTS[0];

      activeScripts.forEach((step, idx) => {
        const stepKey = `${cycleCountRef.current}-${idx}-${step.agentRole}-${step.type}`;
        if (currentOffset >= step.offsetMs) {
          fireStep(step, stepKey);
        }
      });

      if (currentOffset >= TOTAL_DEMO_DURATION_MS && !loopFinishedRef.current) {
        loopFinishedRef.current = true;
        if (DEMO_CONFIG.LOOP_DEMO) {
          loopTimeoutRef.current = setTimeout(() => {
            store.completeCycle();
          }, DEMO_CONFIG.LOOP_DELAY_MS);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    };
  }, [cycleCount, scenarioIndex, fireStep]);

  return { totalDurationMs: TOTAL_DEMO_DURATION_MS };
}
