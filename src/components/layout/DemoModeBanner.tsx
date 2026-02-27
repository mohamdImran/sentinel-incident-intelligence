import { Play, Pause, RotateCcw, Gauge, Radio } from 'lucide-react';
import { DEMO_CONFIG } from '../../config/demo.config';
import { useDemoStore } from '../../store/DemoStoreContext';

const SPEEDS = [0.5, 1.0, 1.5, 2.0];
const SCENARIOS = [
  { label: 'DB Cascade', incident: 'INC-001' },
  { label: 'CDN Outage', incident: 'INC-002' },
  { label: 'Auth Attack', incident: 'INC-003' },
];

export function DemoModeBanner() {
  const { isPlaying, currentOffsetMs, totalDurationMs, speed, scenarioIndex, play, pause, reset, setSpeed, setScenario } = useDemoStore();

  if (!DEMO_CONFIG.DEMO_MODE) return null;

  const progress = Math.min(100, (currentOffsetMs / totalDurationMs) * 100);

  return (
    <div className="relative bg-amber-950/80 border-b border-amber-700/50 px-4 py-0 flex items-center gap-4 h-9 overflow-hidden flex-shrink-0">
      <div
        className="absolute inset-0 bg-amber-500/10 pointer-events-none transition-all duration-300"
        style={{ width: `${progress}%` }}
      />
      <div className="flex items-center gap-2 flex-shrink-0">
        <Radio size={12} className="text-amber-400 animate-pulse" />
        <span className="text-amber-400 text-xs font-semibold tracking-widest uppercase">
          Demo Mode
        </span>
      </div>

      <div className="h-4 w-px bg-amber-700/50 flex-shrink-0" />

      <div className="flex items-center gap-1 flex-shrink-0">
        {SCENARIOS.map((s, i) => (
          <button
            key={i}
            onClick={() => setScenario(i)}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-all duration-150 ${
              scenarioIndex === i
                ? 'bg-amber-600/40 text-amber-300 border border-amber-600/50'
                : 'text-amber-600 hover:text-amber-400'
            }`}
          >
            {s.label}
            {scenarioIndex === i && (
              <span className="ml-1 text-[9px] text-amber-500 font-mono">{s.incident}</span>
            )}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-amber-700/50 flex-shrink-0" />

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={isPlaying ? pause : play}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-700/30 transition-all duration-150"
        >
          {isPlaying ? <Pause size={11} /> : <Play size={11} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-amber-500 hover:text-amber-300 hover:bg-amber-700/30 transition-all duration-150"
        >
          <RotateCcw size={11} />
          Reset
        </button>
      </div>

      <div className="h-4 w-px bg-amber-700/50 flex-shrink-0" />

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Gauge size={11} className="text-amber-600" />
        {SPEEDS.map(s => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`px-1.5 py-0.5 rounded text-xs transition-all duration-150 ${
              speed === s
                ? 'bg-amber-600/40 text-amber-300 border border-amber-600/50'
                : 'text-amber-700 hover:text-amber-500'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        <span className="text-amber-700 text-xs font-mono">
          {Math.floor(currentOffsetMs / 1000)}s / {Math.floor(totalDurationMs / 1000)}s
        </span>
      </div>
    </div>
  );
}
