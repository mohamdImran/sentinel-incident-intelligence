import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { DEMO_CONFIG } from '../config/demo.config';

interface DemoStoreState {
  isPlaying: boolean;
  currentOffsetMs: number;
  totalDurationMs: number;
  scenarioIndex: number;
  speed: number;
  cycleCount: number;
}

interface DemoStoreContextValue extends DemoStoreState {
  play: () => void;
  pause: () => void;
  reset: () => void;
  setSpeed: (s: number) => void;
  setScenario: (i: number) => void;
  tick: (deltaMs: number) => void;
  completeCycle: () => void;
}

const DemoStoreContext = createContext<DemoStoreContextValue | null>(null);

const TOTAL_DURATION_MS = 46000;

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoStoreState>({
    isPlaying: DEMO_CONFIG.AUTO_PLAY,
    currentOffsetMs: 0,
    totalDurationMs: TOTAL_DURATION_MS,
    scenarioIndex: DEMO_CONFIG.ACTIVE_SCENARIO,
    speed: DEMO_CONFIG.PLAYBACK_SPEED,
    cycleCount: 0,
  });

  const play = useCallback(() => setState(s => ({ ...s, isPlaying: true })), []);
  const pause = useCallback(() => setState(s => ({ ...s, isPlaying: false })), []);
  const reset = useCallback(() => setState(s => ({ ...s, currentOffsetMs: 0, isPlaying: true })), []);

  const setSpeed = useCallback((speed: number) => setState(s => ({ ...s, speed })), []);
  const setScenario = useCallback((scenarioIndex: number) => {
    setState(s => ({ ...s, scenarioIndex, currentOffsetMs: 0, isPlaying: true }));
  }, []);

  const tick = useCallback((deltaMs: number) => {
    setState(s => ({
      ...s,
      currentOffsetMs: Math.min(s.currentOffsetMs + deltaMs * s.speed, s.totalDurationMs),
    }));
  }, []);

  const completeCycle = useCallback(() => {
    setState(s => ({ ...s, currentOffsetMs: 0, cycleCount: s.cycleCount + 1 }));
  }, []);

  return (
    <DemoStoreContext.Provider value={{ ...state, play, pause, reset, setSpeed, setScenario, tick, completeCycle }}>
      {children}
    </DemoStoreContext.Provider>
  );
}

export function useDemoStore() {
  const ctx = useContext(DemoStoreContext);
  if (!ctx) throw new Error('useDemoStore must be used within DemoStoreProvider');
  return ctx;
}
