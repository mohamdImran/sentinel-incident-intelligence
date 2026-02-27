/**
 * LiveRunnerContext
 * Shares a single useLiveIncidentRunner instance across all pages.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useLiveIncidentRunner, type LiveIncident, type RunnerStatus } from '../hooks/useLiveIncidentRunner';

interface LiveRunnerContextValue {
  status: RunnerStatus;
  incident: LiveIncident | null;
  error: string | null;
  completedFindings: string;
  agentFindings: Record<string, string>;
  run: () => void;
  stop: () => void;
}

const LiveRunnerContext = createContext<LiveRunnerContextValue | null>(null);

export function LiveRunnerProvider({ children }: { children: ReactNode }) {
  const runner = useLiveIncidentRunner();
  return (
    <LiveRunnerContext.Provider value={runner}>
      {children}
    </LiveRunnerContext.Provider>
  );
}

export function useLiveRunner() {
  const ctx = useContext(LiveRunnerContext);
  if (!ctx) throw new Error('useLiveRunner must be used within LiveRunnerProvider');
  return ctx;
}
