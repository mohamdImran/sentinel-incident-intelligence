import React, { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';
import type { AgentRole, AgentStatus, AgentState, MultiAgentRun, AgentStep } from '../types/agent.types';
import { DEMO_INCIDENTS } from '../data/demo-incidents';

const AGENT_ROLES: AgentRole[] = ['planner', 'investigator', 'correlator', 'remediator', 'verifier'];

function createInitialAgent(role: AgentRole, incidentId: string): AgentState {
  return {
    id: `agent-${role}`,
    role,
    status: 'idle',
    incidentId,
    steps: [],
    currentReasoning: '',
    findings: [],
    startedAt: null,
    completedAt: null,
    progressPercent: 0,
  };
}

function createInitialRun(incidentId: string): MultiAgentRun {
  const agents = {} as Record<AgentRole, AgentState>;
  for (const role of AGENT_ROLES) {
    agents[role] = createInitialAgent(role, incidentId);
  }
  return {
    id: 'run-001',
    incidentId,
    agents,
    status: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    overallFinding: null,
  };
}

type Action =
  | { type: 'SET_AGENT_STATUS'; role: AgentRole; status: AgentStatus; progress?: number }
  | { type: 'APPEND_REASONING'; role: AgentRole; text: string }
  | { type: 'SET_REASONING'; role: AgentRole; text: string }
  | { type: 'ADD_STEP'; role: AgentRole; step: AgentStep }
  | { type: 'SET_RUN_STATUS'; status: MultiAgentRun['status']; overallFinding?: string }
  | { type: 'RESET_RUN'; incidentId: string };

interface AgentStoreState {
  run: MultiAgentRun;
  activeHandoff: { from: AgentRole; to: AgentRole } | null;
}

function reducer(state: AgentStoreState, action: Action): AgentStoreState {
  switch (action.type) {
    case 'SET_AGENT_STATUS': {
      const agent = state.run.agents[action.role];
      return {
        ...state,
        run: {
          ...state.run,
          agents: {
            ...state.run.agents,
            [action.role]: {
              ...agent,
              status: action.status,
              progressPercent: action.progress ?? agent.progressPercent,
              startedAt: action.status === 'thinking' && !agent.startedAt ? new Date().toISOString() : agent.startedAt,
              completedAt: action.status === 'complete' ? new Date().toISOString() : agent.completedAt,
              currentReasoning: action.status === 'idle' ? '' : agent.currentReasoning,
            },
          },
        },
      };
    }
    case 'APPEND_REASONING': {
      const agent = state.run.agents[action.role];
      return {
        ...state,
        run: {
          ...state.run,
          agents: {
            ...state.run.agents,
            [action.role]: { ...agent, currentReasoning: agent.currentReasoning + action.text },
          },
        },
      };
    }
    case 'SET_REASONING': {
      const agent = state.run.agents[action.role];
      return {
        ...state,
        run: {
          ...state.run,
          agents: {
            ...state.run.agents,
            [action.role]: { ...agent, currentReasoning: action.text },
          },
        },
      };
    }
    case 'ADD_STEP': {
      const agent = state.run.agents[action.role];
      return {
        ...state,
        run: {
          ...state.run,
          agents: {
            ...state.run.agents,
            [action.role]: { ...agent, steps: [...agent.steps, action.step] },
          },
        },
      };
    }
    case 'SET_RUN_STATUS':
      return {
        ...state,
        run: {
          ...state.run,
          status: action.status,
          completedAt: action.status === 'complete' ? new Date().toISOString() : state.run.completedAt,
          overallFinding: action.overallFinding ?? state.run.overallFinding,
        },
      };
    case 'RESET_RUN':
      return { run: createInitialRun(action.incidentId), activeHandoff: null };
    default:
      return state;
  }
}

interface AgentStoreContextValue {
  state: AgentStoreState;
  setAgentStatus: (role: AgentRole, status: AgentStatus, progress?: number) => void;
  appendReasoning: (role: AgentRole, text: string) => void;
  setReasoning: (role: AgentRole, text: string) => void;
  addStep: (role: AgentRole, step: AgentStep) => void;
  resetRun: (incidentId: string) => void;
  setHandoff: (from: AgentRole, to: AgentRole) => void;
  clearHandoff: () => void;
}

const AgentStoreContext = createContext<AgentStoreContextValue | null>(null);

export function AgentStoreProvider({ children }: { children: ReactNode }) {
  const incidentId = DEMO_INCIDENTS[0].id;
  const [state, dispatch] = useReducer(reducer, {
    run: createInitialRun(incidentId),
    activeHandoff: null,
  });

  const setAgentStatus = useCallback((role: AgentRole, status: AgentStatus, progress?: number) => {
    dispatch({ type: 'SET_AGENT_STATUS', role, status, progress });
  }, []);

  const appendReasoning = useCallback((role: AgentRole, text: string) => {
    dispatch({ type: 'APPEND_REASONING', role, text });
  }, []);

  const setReasoning = useCallback((role: AgentRole, text: string) => {
    dispatch({ type: 'SET_REASONING', role, text });
  }, []);

  const addStep = useCallback((role: AgentRole, step: AgentStep) => {
    dispatch({ type: 'ADD_STEP', role, step });
  }, []);

  const resetRun = useCallback((incidentId: string) => {
    dispatch({ type: 'RESET_RUN', incidentId });
  }, []);

  const [handoffState, setHandoffState] = React.useState<{ from: AgentRole; to: AgentRole } | null>(null);

  const setHandoff = useCallback((from: AgentRole, to: AgentRole) => {
    setHandoffState({ from, to });
    setTimeout(() => setHandoffState(null), 1200);
  }, []);

  const clearHandoff = useCallback(() => setHandoffState(null), []);

  return (
    <AgentStoreContext.Provider value={{
      state: { ...state, activeHandoff: handoffState },
      setAgentStatus,
      appendReasoning,
      setReasoning,
      addStep,
      resetRun,
      setHandoff,
      clearHandoff,
    }}>
      {children}
    </AgentStoreContext.Provider>
  );
}

export function useAgentStore() {
  const ctx = useContext(AgentStoreContext);
  if (!ctx) throw new Error('useAgentStore must be used within AgentStoreProvider');
  return ctx;
}
