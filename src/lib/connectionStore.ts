/**
 * Connection Store — persists Elastic cluster credentials in localStorage.
 * .env values always take priority over stored values.
 */

const STORAGE_KEY = 'sentinel_connection_v1';
const SKIPPED_KEY = 'sentinel_connection_skipped';

export interface ConnectionConfig {
  esUrl: string;
  esApiKey: string;
  kibanaUrl: string;
  kibanaApiKey: string;
}

/** Read stored config from localStorage */
function readStored(): Partial<ConnectionConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Returns the merged connection config.
 * Priority: .env > localStorage
 */
export function getConnectionConfig(): ConnectionConfig {
  const stored = readStored();
  return {
    esUrl:        import.meta.env.VITE_ES_URL         || stored.esUrl        || '',
    esApiKey:     import.meta.env.VITE_ES_API_KEY     || stored.esApiKey     || '',
    kibanaUrl:    import.meta.env.VITE_KIBANA_URL     || stored.kibanaUrl    || '',
    kibanaApiKey: import.meta.env.VITE_KIBANA_API_KEY || stored.kibanaApiKey || '',
  };
}

/**
 * In dev, all requests go through /dynamic-proxy with X-Proxy-Target header
 * to avoid CORS. In production, call the real URL directly.
 */
export function proxyFetch(
  targetUrl: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  if (import.meta.env.DEV) {
    const headers = new Headers(init.headers);
    headers.set('x-proxy-target', targetUrl.replace(/\/$/, ''));
    return fetch(`/dynamic-proxy${path}`, { ...init, headers });
  }
  return fetch(`${targetUrl.replace(/\/$/, '')}${path}`, init);
}

/** Persist user-entered credentials to localStorage */
export function saveConnectionConfig(config: ConnectionConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  localStorage.removeItem(SKIPPED_KEY);
}

/** Mark onboarding as skipped — never show again */
export function skipOnboarding(): void {
  localStorage.setItem(SKIPPED_KEY, '1');
}

/** Clear stored credentials (for "disconnect" / reset) */
export function clearConnectionConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SKIPPED_KEY);
}

/**
 * Returns true if the app has enough config to run in live mode.
 * Either .env is configured, localStorage has credentials, or user skipped.
 */
export function hasConnectionConfig(): boolean {
  if (import.meta.env.VITE_ES_URL && import.meta.env.VITE_ES_API_KEY) return true;
  if (localStorage.getItem(SKIPPED_KEY) === '1') return true;
  const stored = readStored();
  return Boolean(stored.esUrl && stored.esApiKey);
}

/** True if .env has ES credentials (no onboarding needed) */
export function isEnvConfigured(): boolean {
  return Boolean(import.meta.env.VITE_ES_URL && import.meta.env.VITE_ES_API_KEY);
}
