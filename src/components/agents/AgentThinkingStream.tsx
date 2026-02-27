import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Play, CheckCircle2, Loader2, AlertCircle, Copy, Check } from 'lucide-react';
import { proxyFetch, getConnectionConfig } from '../../lib/connectionStore';

interface AgentThinkingStreamProps {
  text: string;
  isActive: boolean;
  className?: string;
}



interface DetectedCommand {
  method: string;
  path: string;
  body?: string;
  label: string;
  risk: 'low' | 'medium' | 'high';
}


function detectCommands(text: string): DetectedCommand[] {
  const commands: DetectedCommand[] = [];

  
  const cmdWithBodyRegex = /\b(GET|POST|PUT|DELETE)\s+([\w\-_.*\/]+(?:\?[^\s{}\n]*)?)\s*\n?\s*(\{[\s\S]*?\})\s*(?:\n|$)/g;
  let match: RegExpExecArray | null;

  while ((match = cmdWithBodyRegex.exec(text)) !== null) {
    const method = match[1];
    const path = match[2].trim();
    let body = match[3]?.trim();

    if (path.length < 2 || path.includes('**') || path.includes('//')) continue;
    if (!path.match(/^[_a-zA-Z\-.*]/) && !path.startsWith('/')) continue;
    
    try { JSON.parse(body); } catch { body = undefined as unknown as string; }

    if (body) {
      commands.push(buildCommand(method, path, body));
    }
  }

  
  const cmdNobodyRegex = /\b(GET|POST|PUT|DELETE)\s+([\w\-_.*\/]+(?:\?[^\s{}\n]*)?)(?:\s*$|\s*\n)/gm;
  while ((match = cmdNobodyRegex.exec(text)) !== null) {
    const method = match[1];
    const path = match[2].trim();

    if (path.length < 2 || path.includes('**') || path.includes('//')) continue;
    if (!path.match(/^[_a-zA-Z\-.*]/) && !path.startsWith('/')) continue;
    
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    if (commands.some(c => c.path === normalizedPath && c.method === method)) continue;

    commands.push(buildCommand(method, path, undefined));
  }

  
  const seen = new Set<string>();
  return commands.filter(c => {
    const key = `${c.method}:${c.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildCommand(method: string, path: string, body?: string): DetectedCommand {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const risk: DetectedCommand['risk'] =
    method === 'DELETE' || normalizedPath.includes('_delete_by_query') || normalizedPath.includes('_reindex') ? 'high' :
    method === 'PUT' || normalizedPath.includes('_update_by_query') ? 'medium' : 'low';

  const label =
    normalizedPath.includes('_delete_by_query') ? 'Delete by Query' :
    normalizedPath.includes('_refresh') ? 'Refresh Index' :
    normalizedPath.includes('_count') ? 'Count Documents' :
    normalizedPath.includes('_snapshot') ? (method === 'POST' && normalizedPath.includes('_restore') ? 'Restore Snapshot' : 'Create Snapshot') :
    normalizedPath.includes('_reindex') ? 'Reindex' :
    normalizedPath.includes('_forcemerge') ? 'Force Merge' :
    normalizedPath.includes('_update_by_query') ? 'Update by Query' :
    normalizedPath.includes('_tasks') ? 'Check Tasks' :
    normalizedPath.includes('_cat') ? 'Cluster Info' :
    `${method} ${normalizedPath.split('/').pop() || normalizedPath}`;

  return { method, path: normalizedPath, body, label, risk };
}


function formatReasoningText(text: string): string {
  
  let processed = text.replace(
    /\[([a-zA-Z0-9_.]+)\]\s*(\{[^}]*\})/g,
    (_match, toolId: string, params: string) => {
      let formatted = params;
      try { formatted = JSON.stringify(JSON.parse(params), null, 2); } catch { /* keep raw */ }
      return `\n**🔧 Tool Call:** \`${toolId}\`\n\`\`\`json\n${formatted}\n\`\`\`\n`;
    }
  );

  
  processed = processed.replace(
    /COMMAND:\s*\n?\s*((?:GET|POST|PUT|DELETE)\s+[^\n]+(?:\n\s*\{[\s\S]*?\n\s*\})?)/g,
    (_match, cmd: string) => {
      return `\n**⚡ Command:**\n\`\`\`\n${cmd.trim()}\n\`\`\`\n`;
    }
  );

  return processed;
}



function ExecutableCommandCard({ cmd }: { cmd: DetectedCommand }) {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const riskColors = {
    low: { bg: 'bg-status-ok/10', border: 'border-status-ok/20', text: 'text-status-ok', label: 'LOW' },
    medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', label: 'MED' },
    high: { bg: 'bg-status-critical/10', border: 'border-status-critical/20', text: 'text-status-critical', label: 'HIGH' },
  };
  const risk = riskColors[cmd.risk];

  const handleExecute = useCallback(async () => {
    setStatus('running');
    setResult(null);
    try {
      const cfg = getConnectionConfig();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `ApiKey ${cfg.esApiKey}`,
      };
      const init: RequestInit = {
        method: cmd.method,
        headers,
      };
      if (cmd.body && (cmd.method === 'POST' || cmd.method === 'PUT')) {
        init.body = cmd.body;
      }
      const res = await proxyFetch(cfg.esUrl, cmd.path, init);
      const data = await res.text();
      let formatted: string;
      try { formatted = JSON.stringify(JSON.parse(data), null, 2); } catch { formatted = data; }
      setResult(formatted);
      setStatus(res.ok ? 'success' : 'error');
      setExpanded(true);
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Request failed');
      setStatus('error');
      setExpanded(true);
    }
  }, [cmd]);

  const handleCopy = useCallback(() => {
    const text = `${cmd.method} ${cmd.path}${cmd.body ? '\n' + cmd.body : ''}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [cmd]);

  return (
    <div className={`rounded-lg border ${risk.border} ${risk.bg} overflow-hidden my-2`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${risk.bg} ${risk.text} border ${risk.border}`}>
          {risk.label}
        </span>
        <span className="text-[10px] font-semibold text-text-primary flex-1 truncate">{cmd.label}</span>
        <code className="text-[9px] font-mono text-text-muted">{cmd.method}</code>
        <button onClick={handleCopy} className="p-1 rounded hover:bg-white/[0.08] transition-colors" title="Copy command">
          {copied ? <Check size={10} className="text-status-ok" /> : <Copy size={10} className="text-text-muted" />}
        </button>
        <button
          onClick={handleExecute}
          disabled={status === 'running'}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold transition-all ${
            status === 'running' ? 'bg-white/[0.06] text-text-muted cursor-wait' :
            status === 'success' ? 'bg-status-ok/15 text-status-ok border border-status-ok/25' :
            status === 'error' ? 'bg-status-critical/15 text-status-critical border border-status-critical/25' :
            cmd.risk === 'high'
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25'
              : 'bg-accent-cyan/15 text-accent-bright border border-accent-cyan/25 hover:bg-accent-cyan/25'
          }`}
          title={cmd.risk === 'high' ? 'Execute (destructive operation)' : 'Execute command'}
        >
          {status === 'running' ? <Loader2 size={9} className="animate-spin" /> :
           status === 'success' ? <CheckCircle2 size={9} /> :
           status === 'error' ? <AlertCircle size={9} /> :
           <Play size={9} />}
          {status === 'running' ? 'Running' : status === 'success' ? 'Done' : status === 'error' ? 'Failed' : 'Execute'}
        </button>
      </div>
      <div className="px-3 pb-2">
        <pre className="text-[9px] font-mono text-cyan-300/70 bg-black/20 rounded px-2 py-1.5 overflow-x-auto whitespace-pre leading-relaxed">
          {cmd.method} {cmd.path}{cmd.body ? '\n' + cmd.body : ''}
        </pre>
      </div>
      {expanded && result && (
        <div className="px-3 pb-2">
          <div className={`rounded px-2 py-1.5 text-[9px] font-mono overflow-x-auto max-h-[150px] overflow-y-auto whitespace-pre leading-relaxed ${
            status === 'success' ? 'bg-status-ok/5 text-status-ok/80 border border-status-ok/15' :
            'bg-status-critical/5 text-status-critical/80 border border-status-critical/15'
          }`}>
            {result.slice(0, 2000)}
          </div>
        </div>
      )}
    </div>
  );
}



export function AgentThinkingStream({ text, isActive, className = '' }: AgentThinkingStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text]);

  const processedText = formatReasoningText(text);
  const commands = detectCommands(text);

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto ${className}`}
    >
      <div className="prose prose-invert prose-xs max-w-none
        prose-p:text-text-secondary prose-p:text-[11px] prose-p:leading-relaxed prose-p:my-1
        prose-headings:text-text-primary prose-headings:font-semibold prose-headings:mt-2 prose-headings:mb-1
        prose-h1:text-xs prose-h2:text-[11px] prose-h3:text-[11px]
        prose-strong:text-text-primary prose-strong:font-semibold
        prose-em:text-text-secondary prose-em:italic
        prose-code:text-accent-bright prose-code:bg-accent-dim prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[10px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-white/[0.04] prose-pre:border prose-pre:border-white/[0.08] prose-pre:rounded-lg prose-pre:p-2.5 prose-pre:text-[10px] prose-pre:font-mono prose-pre:overflow-x-auto
        prose-ul:text-[11px] prose-ul:my-1 prose-ul:pl-4 prose-ul:space-y-0.5
        prose-ol:text-[11px] prose-ol:my-1 prose-ol:pl-4 prose-ol:space-y-0.5
        prose-li:text-text-secondary prose-li:my-0
        prose-blockquote:border-l-2 prose-blockquote:border-accent-cyan/40 prose-blockquote:pl-3 prose-blockquote:text-text-muted prose-blockquote:text-[11px] prose-blockquote:not-italic
        prose-hr:border-white/[0.08]
        prose-table:text-[10px] prose-th:text-text-primary prose-th:font-semibold prose-td:text-text-secondary
        prose-a:text-accent-bright prose-a:no-underline hover:prose-a:underline
        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{processedText}</ReactMarkdown>
        {isActive && text.length > 0 && (
          <span className="inline-block w-1.5 h-3 bg-accent-cyan ml-0.5 animate-pulse align-middle" />
        )}
      </div>

      {/* Executable command cards — shown after the reasoning text */}
      {commands.length > 0 && !isActive && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider mb-2">
            ⚡ Detected Commands ({commands.length})
          </p>
          {commands.map((cmd, i) => (
            <ExecutableCommandCard key={`${cmd.method}-${cmd.path}-${i}`} cmd={cmd} />
          ))}
        </div>
      )}
    </div>
  );
}
