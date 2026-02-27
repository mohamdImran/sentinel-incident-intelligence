// ─── SENTINEL Configuration ───────────────────────────────────────────────────
// All values are driven by environment variables (.env / .env.local).
// See .env.example for the full list of supported variables.
//
// Quick start:
//   VITE_DEMO_MODE=true   → runs fully offline with scripted scenarios
//   VITE_DEMO_MODE=false  → connects to live Elasticsearch + Agent Builder

const bool = (val: string | undefined, fallback: boolean): boolean => {
  if (val === undefined || val === '') return fallback;
  return val.toLowerCase() !== 'false' && val !== '0';
};

const num = (val: string | undefined, fallback: number): number => {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};

export const DEMO_CONFIG = {
  
  DEMO_MODE: bool(import.meta.env.VITE_DEMO_MODE, true),

  
  AUTO_PLAY:      bool(import.meta.env.VITE_DEMO_AUTO_PLAY, true),
  PLAYBACK_SPEED: num(import.meta.env.VITE_DEMO_PLAYBACK_SPEED, 1.0),
  LOOP_DEMO:      bool(import.meta.env.VITE_DEMO_LOOP, true),
  LOOP_DELAY_MS:  num(import.meta.env.VITE_DEMO_LOOP_DELAY_MS, 6000),

  
  ACTIVE_SCENARIO: num(import.meta.env.VITE_DEMO_SCENARIO, 0),

  
  AGENT_TYPING_SPEED_MS:    num(import.meta.env.VITE_DEMO_TYPING_SPEED_MS, 16),
  TOOL_CALL_DELAY_MS:       num(import.meta.env.VITE_DEMO_TOOL_CALL_DELAY_MS, 800),
  STEP_TRANSITION_DELAY_MS: num(import.meta.env.VITE_DEMO_STEP_DELAY_MS, 500),

  
  SHOW_ESQL_QUERIES:       bool(import.meta.env.VITE_SHOW_ESQL_QUERIES, true),
  SHOW_GEO_MAP:            bool(import.meta.env.VITE_SHOW_GEO_MAP, true),
  SHOW_WORKFLOW_EXECUTION: bool(import.meta.env.VITE_SHOW_WORKFLOW_EXECUTION, true),
  SHOW_IMPACT_METRICS:     bool(import.meta.env.VITE_SHOW_IMPACT_METRICS, true),
  SHOW_AGENT_CONNECTORS:   bool(import.meta.env.VITE_SHOW_AGENT_CONNECTORS, true),

  
  LIVE: {
    ELASTICSEARCH_URL:  import.meta.env.VITE_ES_URL ?? '',
    AGENT_BUILDER_URL:  import.meta.env.VITE_KIBANA_URL ?? '',
    SUPABASE_URL:       import.meta.env.VITE_SUPABASE_URL ?? '',
    SUPABASE_ANON_KEY:  import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    POLL_INTERVAL_MS:   num(import.meta.env.VITE_LIVE_POLL_INTERVAL_MS, 5000),
  },
} as const;

export type DemoConfig = typeof DEMO_CONFIG;
