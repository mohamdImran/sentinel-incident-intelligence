import { useState, useCallback } from 'react';
import {
  Shield, CheckCircle, XCircle, Loader2, Eye, EyeOff,
  ChevronRight, Zap, Cloud, Key, Link2,
} from 'lucide-react';
import { saveConnectionConfig, skipOnboarding, proxyFetch, type ConnectionConfig } from '../lib/connectionStore';


function decodeCloudId(cloudId: string): { esUrl: string; kibanaUrl: string } | null {
  try {
    // Format: "name:base64(host$es_uuid$kibana_uuid)"
    const colonIdx = cloudId.indexOf(':');
    if (colonIdx === -1) return null;
    const encoded = cloudId.slice(colonIdx + 1);
    const decoded = atob(encoded);
    const parts = decoded.split('$');
    if (parts.length < 3) return null;
    const [host, esId, kibanaId] = parts;
    // host may include port like "us-central1.gcp.cloud.es.io:9243"
    const [hostname, port] = host.split(':');
    const p = port ?? '443';
    return {
      esUrl: `https://${esId}.${hostname}:${p}`,
      kibanaUrl: `https://${kibanaId}.${hostname}`,
    };
  } catch {
    return null;
  }
}


type ValidationState = 'idle' | 'loading' | 'ok' | 'error';

interface FieldStatus {
  es: ValidationState;
  kibana: ValidationState;
  esError?: string;
  kibanaError?: string;
}

async function validateEs(esUrl: string, esApiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await proxyFetch(esUrl, '/_cluster/health', {
      headers: { Authorization: `ApiKey ${esApiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} — check URL and API key` };
    const d = await res.json();
    return { ok: true, error: d.cluster_name ? undefined : 'Connected but no cluster name returned' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Connection failed' };
  }
}

async function validateKibana(kibanaUrl: string, kibanaApiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await proxyFetch(kibanaUrl, '/api/agent_builder/agents', {
      headers: {
        Authorization: `ApiKey ${kibanaApiKey}`,
        'Content-Type': 'application/json',
        'kbn-xsrf': 'true',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return { ok: true };
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} — check Kibana URL and API key` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Connection failed' };
  }
}


function Field({
  label, value, onChange, placeholder, type = 'text', status, error, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; status?: ValidationState; error?: string; hint?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (show ? 'text' : 'password') : type;

  const borderColor =
    status === 'ok' ? 'border-status-ok/50 focus-within:border-status-ok' :
    status === 'error' ? 'border-status-critical/50 focus-within:border-status-critical' :
    'border-white/[0.10] focus-within:border-accent-cyan/50';

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">{label}</label>
      <div className={`flex items-center gap-2 rounded-xl border bg-white/[0.03] transition-all duration-200 ${borderColor}`}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          type={inputType}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 bg-transparent px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none font-mono"
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(s => !s)}
            className="px-3 text-text-muted hover:text-text-secondary transition-colors">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
        {status === 'loading' && <Loader2 size={14} className="mr-3 text-accent-cyan animate-spin flex-shrink-0" />}
        {status === 'ok' && <CheckCircle size={14} className="mr-3 text-status-ok flex-shrink-0" />}
        {status === 'error' && <XCircle size={14} className="mr-3 text-status-critical flex-shrink-0" />}
      </div>
      {error && <p className="text-[10px] text-status-critical pl-1">{error}</p>}
      {hint && !error && <p className="text-[10px] text-text-muted pl-1">{hint}</p>}
    </div>
  );
}


interface ConnectPageProps {
  onConnected: () => void;
}

export function ConnectPage({ onConnected }: ConnectPageProps) {
  const [esUrl, setEsUrl] = useState('');
  const [esApiKey, setEsApiKey] = useState('');
  const [kibanaUrl, setKibanaUrl] = useState('');
  const [kibanaApiKey, setKibanaApiKey] = useState('');
  const [cloudId, setCloudId] = useState('');
  const [showCloudId, setShowCloudId] = useState(false);
  const [status, setStatus] = useState<FieldStatus>({ es: 'idle', kibana: 'idle' });
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);

  
  const handleCloudId = useCallback((val: string) => {
    setCloudId(val);
    if (!val.trim()) return;
    const decoded = decodeCloudId(val.trim());
    if (decoded) {
      setEsUrl(decoded.esUrl);
      setKibanaUrl(decoded.kibanaUrl);
    }
  }, []);

  const handleValidate = async () => {
    if (!esUrl.trim() || !esApiKey.trim()) return;
    setValidating(true);
    setValidated(false);
    setStatus({ es: 'loading', kibana: kibanaUrl.trim() ? 'loading' : 'idle' });

    const [esResult, kibanaResult] = await Promise.all([
      validateEs(esUrl.trim(), esApiKey.trim()),
      kibanaUrl.trim() && kibanaApiKey.trim()
        ? validateKibana(kibanaUrl.trim(), kibanaApiKey.trim())
        : Promise.resolve({ ok: true as const, error: undefined }),
    ]);

    setStatus({
      es: esResult.ok ? 'ok' : 'error',
      kibana: kibanaUrl.trim() ? (kibanaResult.ok ? 'ok' : 'error') : 'idle',
      esError: esResult.error,
      kibanaError: kibanaResult.error,
    });

    if (esResult.ok) setValidated(true);
    setValidating(false);
  };

  const handleSave = () => {
    const config: ConnectionConfig = {
      esUrl: esUrl.trim(),
      esApiKey: esApiKey.trim(),
      kibanaUrl: kibanaUrl.trim(),
      kibanaApiKey: kibanaApiKey.trim(),
    };
    saveConnectionConfig(config);
    onConnected();
  };

  const handleSkip = () => {
    skipOnboarding();
    onConnected();
  };

  const canValidate = esUrl.trim() && esApiKey.trim() && !validating;
  const canSave = validated && status.es === 'ok';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base overflow-y-auto">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-accent-cyan/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[300px] rounded-full bg-accent-cyan/[0.03] blur-[100px]" />
      </div>

      <div className="relative w-full max-w-lg mx-auto px-4 py-12">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-dim border border-accent-cyan/25 shadow-[0_0_30px_rgba(6,182,212,0.15)] mb-4">
            <Shield size={26} className="text-accent-cyan" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">SENTINEL</h1>
          <p className="text-sm text-text-muted mt-1">Autonomous Incident Intelligence</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-surface/80 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5 mb-1">
              <Link2 size={15} className="text-accent-cyan" />
              <h2 className="text-base font-semibold text-text-primary">Connect your Elastic cluster</h2>
            </div>
            <p className="text-[12px] text-text-muted">
              Enter your Elasticsearch and Kibana credentials to get started. Stored locally — never sent anywhere else.
            </p>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Cloud ID shortcut */}
            <div>
              <button
                onClick={() => setShowCloudId(s => !s)}
                className="flex items-center gap-2 text-[11px] text-accent-bright hover:text-white transition-colors mb-2"
              >
                <Cloud size={12} />
                {showCloudId ? 'Hide' : 'Have a Cloud ID? Paste it to auto-fill'}
                <ChevronRight size={10} className={`transition-transform ${showCloudId ? 'rotate-90' : ''}`} />
              </button>
              {showCloudId && (
                <Field
                  label="Cloud ID"
                  value={cloudId}
                  onChange={handleCloudId}
                  placeholder="my-deployment:dXMtY2VudHJhbDEuZ2NwLmNsb3VkLmVzLmlvOjQ0MyQ..."
                  hint="Paste your Cloud ID — ES URL and Kibana URL will be filled automatically"
                />
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[10px] text-text-muted uppercase tracking-wider">Elasticsearch</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <Field
              label="Elasticsearch URL"
              value={esUrl}
              onChange={v => { setEsUrl(v); setValidated(false); setStatus(s => ({ ...s, es: 'idle' })); }}
              placeholder="https://abc123.us-central1.gcp.cloud.es.io:443"
              status={status.es}
              error={status.esError}
            />
            <Field
              label="Elasticsearch API Key"
              value={esApiKey}
              onChange={v => { setEsApiKey(v); setValidated(false); setStatus(s => ({ ...s, es: 'idle' })); }}
              placeholder="VnVhQ2ZHY0JDZGJjZXRhb..."
              type="password"
              hint="Create one in Kibana → Stack Management → API Keys"
            />

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[10px] text-text-muted uppercase tracking-wider">Kibana (optional)</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <Field
              label="Kibana URL"
              value={kibanaUrl}
              onChange={v => { setKibanaUrl(v); setStatus(s => ({ ...s, kibana: 'idle' })); }}
              placeholder="https://abc123.kb.us-central1.gcp.cloud.es.io"
              status={status.kibana}
              error={status.kibanaError}
              hint="Required for AI Query Assistant and Agent Builder features"
            />
            <Field
              label="Kibana API Key"
              value={kibanaApiKey}
              onChange={v => { setKibanaApiKey(v); setStatus(s => ({ ...s, kibana: 'idle' })); }}
              placeholder="VnVhQ2ZHY0JDZGJjZXRhb..."
              type="password"
            />

            {/* Actions */}
            <div className="flex flex-col gap-2.5 pt-1">
              {!validated ? (
                <button
                  onClick={handleValidate}
                  disabled={!canValidate}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-cyan text-sm font-semibold transition-all hover:bg-accent-bright disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                  style={{ color: '#0B0F14' }}
                >
                  {validating
                    ? <><Loader2 size={14} className="animate-spin" /> Validating...</>
                    : <><Zap size={14} /> Validate & Connect</>
                  }
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-status-ok text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-30 shadow-sm"
                  style={{ color: '#0B0F14' }}
                >
                  <CheckCircle size={14} /> Save & Launch SENTINEL
                </button>
              )}

              {validated && (
                <button
                  onClick={handleValidate}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.08] text-sm text-text-secondary hover:border-white/20 hover:text-text-primary transition-all"
                >
                  Re-validate
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
            >
              <Key size={10} />
              I've configured .env — skip this
            </button>
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
              <div className="w-1.5 h-1.5 rounded-full bg-status-ok" />
              Stored locally only
            </div>
          </div>
        </div>

        {/* Feature hints */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: Zap, label: 'ES|QL Workbench', desc: 'Run queries live' },
            { icon: Shield, label: 'AI Incident Response', desc: 'Autonomous agents' },
            { icon: Cloud, label: 'Agent Builder', desc: 'Natural language queries' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <Icon size={14} className="text-accent-cyan mx-auto mb-1.5" />
              <p className="text-[10px] font-semibold text-text-secondary">{label}</p>
              <p className="text-[9px] text-text-muted mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
