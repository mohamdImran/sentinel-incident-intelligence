import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Play, Clock, Database, ChevronRight, Wifi, WifiOff,
  AlertCircle, Sparkles, Send, Square, RotateCcw,
  Wand2, CheckCircle, Pencil, MessageSquare,
} from 'lucide-react';
import { MonacoEditor } from '../components/ui/MonacoEditor';
import { DEMO_ESQL_RESULTS } from '../data/demo-metrics';
import { runEsqlQuery, isLiveElasticsearchConfigured } from '../lib/elasticsearch';
import { DEMO_CONFIG } from '../config/demo.config';
import {
  converseWithAgent, isAgentBuilderConfigured, listAgents,
  getConversation,
  type AgentBuilderAgent,
} from '../lib/agentBuilder';
import type { ESQLQueryResult } from '../types/metrics.types';


const _cache: {
  agent: AgentBuilderAgent | null;
  agentLoaded: boolean;
  convId: string | undefined;
  aiQueries: SavedQuery[];    
  chatHistory: ChatTurn[];
} = { agent: null, agentLoaded: false, convId: undefined, aiQueries: [], chatHistory: [] };

function cacheAddQuery(q: SavedQuery) {
  if (!_cache.aiQueries.find(x => x.id === q.id)) {
    _cache.aiQueries = [..._cache.aiQueries, q];
  }
}


const PRESET_QUERIES: SavedQuery[] = [
  { id: 'p0', label: 'Index overview', query: 'FROM * METADATA _index\n| STATS doc_count = COUNT(*) BY _index\n| SORT doc_count DESC\n| LIMIT 15', source: 'preset' },
  { id: 'p1', label: 'Recent log errors', query: 'FROM logs-* METADATA _index\n| WHERE @timestamp > NOW() - 1h\n| WHERE log.level == "ERROR" OR log.level == "error"\n| STATS error_count = COUNT(*) BY _index\n| SORT error_count DESC\n| LIMIT 20', source: 'preset' },
  { id: 'p2', label: 'Event volume / min', query: 'FROM * METADATA _index\n| WHERE @timestamp > NOW() - 30m\n| STATS event_count = COUNT(*) BY BUCKET(@timestamp, 1 minute)\n| SORT `BUCKET(@timestamp, 1 minute)` DESC\n| LIMIT 30', source: 'preset' },
  { id: 'p3', label: 'Cluster doc count', query: 'FROM * METADATA _index\n| STATS total_docs = COUNT(*), index_count = COUNT_DISTINCT(_index)', source: 'preset' },
];


interface SavedQuery { id: string; label: string; query: string; source: 'preset' | 'ai'; }
interface RunHistoryEntry { id: string; label: string; query: string; tookMs: number; rows: number; isLive: boolean; error?: string; ts: string; }
interface ChatTurn { prompt: string; response: string; query: string | null; ts: string; }


function extractEsqlBlock(text: string): string | null {
  const m = text.match(/```(?:esql|sql|ES\|QL)?\s*\n?([\s\S]+?)```/i);
  return m ? m[1].trim() : null;
}

function ColumnTypeChip({ type }: { type: string }) {
  const colors: Record<string, string> = {
    keyword: 'text-accent-bright bg-accent-dim', long: 'text-orange-400 bg-orange-400/10',
    double: 'text-orange-400 bg-orange-400/10', date: 'text-green-400 bg-green-400/10',
    boolean: 'text-yellow-400 bg-yellow-400/10', text: 'text-text-secondary bg-white/5',
  };
  return <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${colors[type] ?? 'text-text-muted bg-white/5'}`}>{type}</span>;
}


function ShimmerLine({ w = 'w-full', h = 'h-3' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} rounded bg-white/[0.06] animate-pulse`} />;
}

function AiStreamingSkeleton() {
  return (
    <div className="space-y-2 p-3">
      <ShimmerLine w="w-3/4" />
      <ShimmerLine w="w-full" />
      <ShimmerLine w="w-5/6" />
      <div className="mt-3 rounded-lg border border-accent-cyan/20 overflow-hidden">
        <div className="px-3 py-1.5 bg-accent-dim/60 flex items-center gap-2">
          <div className="w-12 h-2.5 rounded bg-accent-cyan/30 animate-pulse" />
        </div>
        <div className="p-3 space-y-1.5">
          <ShimmerLine w="w-2/3" h="h-2.5" />
          <ShimmerLine w="w-full" h="h-2.5" />
          <ShimmerLine w="w-1/2" h="h-2.5" />
        </div>
      </div>
    </div>
  );
}


function AiResponseRenderer({ text, onUseQuery }: { text: string; onUseQuery: (q: string) => void }) {
  
  const parts = text.split(/(```(?:esql|sql|ES\|QL)?[\s\S]*?```)/gi);
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        const codeMatch = part.match(/```(?:esql|sql|ES\|QL)?\s*\n?([\s\S]+?)```/i);
        if (codeMatch) {
          const code = codeMatch[1].trim();
          return (
            <div key={i} className="rounded-lg overflow-hidden border border-accent-cyan/25 shadow-sm">
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a1628] border-b border-accent-cyan/15">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
                  <span className="text-[9px] font-mono font-semibold text-accent-bright uppercase tracking-wider">ES|QL</span>
                </div>
                <button
                  onClick={() => onUseQuery(code)}
                  className="flex items-center gap-1 text-[9px] font-semibold text-accent-bright hover:text-white transition-colors px-2 py-0.5 rounded-md bg-accent-cyan/15 hover:bg-accent-cyan/25 border border-accent-cyan/20"
                >
                  <CheckCircle size={8} /> Load into editor
                </button>
              </div>
              <pre className="p-3 text-[10px] font-mono text-cyan-300/80 bg-[#060d1a] overflow-x-auto whitespace-pre leading-relaxed">{code}</pre>
            </div>
          );
        }
        if (!part.trim()) return null;
        
        return (
          <div key={i} className="prose prose-invert prose-xs max-w-none
            prose-p:text-text-secondary prose-p:text-[11px] prose-p:leading-relaxed prose-p:my-0.5
            prose-headings:text-text-primary prose-headings:font-semibold
            prose-h1:text-xs prose-h2:text-[11px] prose-h3:text-[11px]
            prose-strong:text-text-primary prose-strong:font-semibold
            prose-code:text-accent-bright prose-code:bg-accent-dim prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[10px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
            prose-ul:text-[11px] prose-ul:my-0.5 prose-ul:pl-4
            prose-ol:text-[11px] prose-ol:my-0.5 prose-ol:pl-4
            prose-li:text-text-secondary prose-li:my-0
            [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{part}</ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
}


function ChatHistoryPanel({ history, onSelect }: {
  history: ChatTurn[];
  onSelect: (turn: ChatTurn) => void;
}) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <MessageSquare size={18} className="text-text-muted mb-2" />
        <p className="text-[11px] text-text-muted">No AI queries yet</p>
        <p className="text-[10px] text-text-muted mt-1">Ask the AI to generate a query above</p>
      </div>
    );
  }
  return (
    <div className="space-y-1 p-2">
      {[...history].reverse().map((turn, i) => (
        <button key={i} onClick={() => onSelect(turn)}
          className="w-full text-left p-2.5 rounded-lg border border-transparent hover:border-white/[0.08] hover:bg-white/[0.03] transition-all group">
          <div className="flex items-start gap-2">
            <Sparkles size={9} className="text-accent-cyan mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-text-secondary truncate group-hover:text-text-primary transition-colors">{turn.prompt}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[9px] text-text-muted">{turn.ts}</p>
                {turn.query && <span className="text-[9px] text-accent-bright/60">· has query</span>}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}


interface AiComposerProps {
  currentQuery: string;
  onUseQuery: (query: string, label: string) => void;
  onHistoryLoaded: (turns: ChatTurn[]) => void;
  restoreTurn?: ChatTurn | null;
  onRestoreConsumed: () => void;
}

type ComposerMode = 'generate' | 'explain' | 'improve';

function AiQueryComposer({ currentQuery, onUseQuery, onHistoryLoaded, restoreTurn, onRestoreConsumed }: AiComposerProps) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [mode, setMode] = useState<ComposerMode>('generate');
  const [agent, setAgent] = useState<AgentBuilderAgent | null>(_cache.agent);
  const [agentLoaded, setAgentLoaded] = useState(_cache.agentLoaded);
  const [lastPrompt, setLastPrompt] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  
  useEffect(() => {
    if (!restoreTurn) return;
    setLastPrompt(restoreTurn.prompt);
    setResponse(restoreTurn.response);
    setMode('generate');
    onRestoreConsumed();
  }, [restoreTurn]);

  
  useEffect(() => {
    if (!isAgentBuilderConfigured() || _cache.agentLoaded) return;
    listAgents().then(agents => {
      const found = agents.find(a =>
        a.name.toLowerCase().includes('sentinel') ||
        a.name.toLowerCase().includes('esql') ||
        a.name.toLowerCase().includes('query')
      ) ?? agents[0] ?? null;
      _cache.agent = found;
      _cache.agentLoaded = true;
      setAgent(found);
      setAgentLoaded(true);
    }).catch(() => { _cache.agentLoaded = true; setAgentLoaded(true); });
  }, []);

  
  useEffect(() => {
    if (!isAgentBuilderConfigured() || !_cache.convId || _cache.chatHistory.length > 0) {
      if (_cache.chatHistory.length > 0) onHistoryLoaded(_cache.chatHistory);
      return;
    }
    setLoadingHistory(true);
    getConversation(_cache.convId).then(conv => {
      if (conv.rounds && conv.rounds.length > 0) {
        const turns: ChatTurn[] = conv.rounds.map(r => ({
          prompt: r.input?.message ?? '',
          response: r.response?.message ?? '',
          query: extractEsqlBlock(r.response?.message ?? ''),
          ts: new Date(conv.updated_at).toLocaleTimeString('en-US', { hour12: false }),
        }));
        _cache.chatHistory = turns;
        onHistoryLoaded(turns);
      }
    }).catch(() => {}).finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    if (response && responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  const buildSystemPrompt = (query: string, m: ComposerMode): string => {
    if (m === 'explain') return `You are an ES|QL expert. Explain the following ES|QL query in clear, plain English.
Structure your explanation as:
1. **What it does** — one sentence summary
2. **Step by step** — explain each pipe stage briefly
3. **Use case** — when you would run this query

Be concise and technical but accessible. Do not rewrite the query.

Query to explain:
\`\`\`esql
${query}
\`\`\``;
    if (m === 'improve') return `You are an ES|QL expert. Improve the following ES|QL query for better performance and readability.
Output:
1. One sentence describing what you improved
2. The improved query in a \`\`\`esql code block
3. Two bullet points explaining the key improvements

STRICT RULES:
- ONLY use valid ES|QL aggregate functions: COUNT, COUNT_DISTINCT, AVG, MIN, MAX, SUM, PERCENTILE, MEDIAN, VALUES
- NEVER use STDDEV_POPULATION, STDDEV_SAMPLE, VAR_POPULATION, VAR_SAMPLE
- Use METADATA _index when you need the _index field

Current query:
\`\`\`esql
${query}
\`\`\``;
    return `You are an ES|QL expert assistant inside SENTINEL, an Elasticsearch incident intelligence platform.

STRICT RULES — follow exactly:
1. Output EXACTLY ONE ES|QL query wrapped in \`\`\`esql ... \`\`\` code block
2. Write ONE short sentence explaining what the query does (before the code block)
3. Use METADATA _index when you need the _index field: \`FROM * METADATA _index\`
4. ONLY use these supported aggregate functions: COUNT, COUNT_DISTINCT, AVG, MIN, MAX, SUM, PERCENTILE, MEDIAN, VALUES
5. NEVER use: STDDEV_POPULATION, STDDEV_SAMPLE, VAR_POPULATION, VAR_SAMPLE — these do NOT exist in ES|QL
6. Use generic field names that work across index patterns (e.g. \`message\` not \`log.level\`)
7. Prefer \`FROM * METADATA _index\` for broad queries, or \`FROM logs-*\` for log-specific queries
8. Do NOT add explanations after the code block

Current query in editor (for context/improvement requests):
\`\`\`esql
${query}
\`\`\``;
  };

  async function runQuery(userPrompt: string, m: ComposerMode) {
    if (!agent || streaming) return;
    const label = m === 'explain' ? `Explain: ${currentQuery.slice(0, 50)}...`
      : m === 'improve' ? 'Improve query' : userPrompt;
    setLastPrompt(label);
    if (m === 'generate') setPrompt('');
    setStreaming(true);
    setResponse('');
    setMode(m);
    abortRef.current = new AbortController();
    const msg = m === 'explain' || m === 'improve'
      ? buildSystemPrompt(currentQuery, m)
      : `${buildSystemPrompt(currentQuery, m)}\n\nUser request: ${userPrompt}`;
    let fullResponse = '';
    try {
      await converseWithAgent(agent.id, msg, _cache.convId, undefined, {
        onConversationId: (id) => { _cache.convId = id; },
        onMessageChunk: (chunk) => { fullResponse += chunk; setResponse(r => r + chunk); },
      }, abortRef.current.signal);
      const turn: ChatTurn = {
        prompt: m === 'explain' ? 'Explain query' : m === 'improve' ? 'Improve query' : userPrompt,
        response: fullResponse,
        query: extractEsqlBlock(fullResponse),
        ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
      };
      _cache.chatHistory = [..._cache.chatHistory, turn];
      onHistoryLoaded([..._cache.chatHistory]);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setResponse(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setStreaming(false); }
  }

  async function handleAsk() {
    if (!prompt.trim() || streaming || !agent) return;
    await runQuery(prompt.trim(), 'generate');
  }

  const extractedQuery = response ? extractEsqlBlock(response) : null;
  const canUse = isAgentBuilderConfigured();
  const hasQuery = currentQuery.trim().length > 0;

  return (
    <div className="border-b border-white/[0.06] flex-shrink-0">
      {/* Header bar */}
      <div className="flex items-center gap-2.5 px-4 py-2 bg-gradient-to-r from-accent-dim/40 to-transparent border-b border-accent-cyan/10">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-accent-cyan/15 border border-accent-cyan/25 flex items-center justify-center">
            <Wand2 size={10} className="text-accent-cyan" />
          </div>
          <span className="text-xs font-semibold text-text-primary">Natural Language → ES|QL</span>
        </div>
        <span className="text-[10px] text-text-muted">via Elastic Agent Builder</span>
        <div className="ml-auto flex items-center gap-2">
          {loadingHistory && <span className="text-[10px] text-text-muted animate-pulse">Loading history...</span>}
          {!agentLoaded && canUse && <span className="text-[10px] text-text-muted animate-pulse">Connecting...</span>}
          {agentLoaded && agent && (
            <span className="flex items-center gap-1 text-[10px] text-status-ok font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-status-ok animate-pulse" />
              {agent.name}
            </span>
          )}
          {agentLoaded && !agent && canUse && (
            <span className="text-[10px] text-status-warning">No agent — create one in Agent Builder</span>
          )}
          {!canUse && <span className="text-[10px] text-text-muted">Configure Agent Builder in .env to enable</span>}
        </div>
      </div>

      {/* Input + quick actions */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex gap-2">
          <div className={`flex-1 flex items-center gap-2 rounded-xl border transition-all duration-200 ${
            streaming && mode === 'generate'
              ? 'border-accent-cyan/50 bg-accent-dim/40 shadow-[0_0_12px_rgba(6,182,212,0.08)]'
              : 'border-white/[0.10] bg-white/[0.03] hover:border-white/[0.16] focus-within:border-accent-cyan/40 focus-within:bg-accent-dim/20'
          }`}>
            <Wand2 size={13} className={`ml-3.5 flex-shrink-0 transition-colors ${streaming && mode === 'generate' ? 'text-accent-cyan' : 'text-text-muted'}`} />
            <input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
              placeholder={
                !canUse ? 'Add VITE_KIBANA_URL + VITE_KIBANA_API_KEY to .env to enable AI queries'
                : !agentLoaded ? 'Connecting to Agent Builder...'
                : !agent ? 'Create an agent in Agent Builder first'
                : 'Describe what you want to query in plain English...'
              }
              disabled={!agent || streaming}
              className="flex-1 bg-transparent py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            />
            {response && !streaming && (
              <button onClick={() => { setResponse(''); setLastPrompt(''); }}
                className="p-1.5 text-text-muted hover:text-text-secondary transition-colors" title="Clear">
                <RotateCcw size={11} />
              </button>
            )}
            <button
              onClick={streaming && mode === 'generate' ? () => abortRef.current?.abort() : handleAsk}
              disabled={(!prompt.trim() && !(streaming && mode === 'generate')) || !agent}
              className={`flex items-center gap-1.5 px-3.5 py-2 mr-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
                streaming && mode === 'generate'
                  ? 'bg-status-critical/15 text-status-critical hover:bg-status-critical/25 border border-status-critical/20'
                  : 'bg-accent-cyan/15 text-accent-bright hover:bg-accent-cyan/25 border border-accent-cyan/20 disabled:opacity-30 disabled:cursor-not-allowed'
              }`}
            >
              {streaming && mode === 'generate' ? <><Square size={10} /> Stop</> : <><Send size={10} /> Generate</>}
            </button>
          </div>
        </div>

        {/* Suggestion chips — only when idle and no response */}
        {!response && !streaming && agent && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {[
              'Show all indices by document count',
              'Find ERROR logs in the last hour',
              'Count events per minute for last 30 min',
              'Top 10 indices by size',
            ].map(s => (
              <button key={s} onClick={() => setPrompt(s)}
                className="text-[10px] px-2.5 py-1 rounded-full border border-white/[0.08] text-text-muted hover:border-accent-cyan/30 hover:text-accent-bright hover:bg-accent-dim/30 transition-all">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Explain / Improve quick actions — shown below input when query is loaded but no response yet */}
        {!response && !streaming && hasQuery && agent && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => runQuery('', 'explain')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.10] bg-white/[0.03] text-[11px] font-medium text-text-secondary hover:border-purple-400/40 hover:text-purple-300 hover:bg-purple-500/10 transition-all"
            >
              <Pencil size={9} /> Explain query
            </button>
            <button
              onClick={() => runQuery('', 'improve')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.10] bg-white/[0.03] text-[11px] font-medium text-text-secondary hover:border-accent-cyan/30 hover:text-accent-bright hover:bg-accent-dim/30 transition-all"
            >
              <Sparkles size={9} /> Improve query
            </button>
          </div>
        )}
      </div>

      {/* Response area */}
      {(response || streaming) && (
        <div className="px-4 pb-3">
          {lastPrompt && (
            <div className="flex items-center gap-1.5 mb-2 text-[10px]">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                mode === 'explain' ? 'bg-purple-500/15 text-purple-400' :
                mode === 'improve' ? 'bg-accent-dim text-accent-bright' :
                'bg-white/[0.06] text-text-muted'
              }`}>{mode}</span>
              <span className="text-text-secondary italic truncate max-w-xs">{lastPrompt}</span>
            </div>
          )}
          <div ref={responseRef}
            className="max-h-56 overflow-y-auto rounded-xl border border-white/[0.08] bg-[#060d1a]/80 backdrop-blur-sm">
            {streaming && !response
              ? <AiStreamingSkeleton />
              : response
                ? <div className="p-3"><AiResponseRenderer text={response} onUseQuery={(q) => onUseQuery(q, lastPrompt.slice(0, 45) || 'AI query')} /></div>
                : null
            }
            {streaming && response && (
              <div className="px-3 pb-2">
                <span className="inline-block w-1.5 h-3.5 bg-accent-cyan rounded-sm animate-pulse align-middle" />
              </div>
            )}
          </div>
          {extractedQuery && !streaming && mode !== 'explain' && (
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={() => onUseQuery(extractedQuery, lastPrompt.slice(0, 45) || 'AI query')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent-cyan text-[11px] font-semibold hover:bg-accent-bright transition-colors shadow-sm"
                style={{ color: '#0B0F14' }}
              >
                <CheckCircle size={11} /> Load into editor
              </button>
            </div>
          )}
          {/* Explain / Improve — appear below response when a query is in the editor */}
          {!streaming && hasQuery && agent && (
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={() => runQuery('', 'explain')}
                title="Explain what this query does in plain English"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.10] bg-white/[0.03] text-[11px] font-medium text-text-secondary hover:border-purple-400/40 hover:text-purple-300 hover:bg-purple-500/10 transition-all"
              >
                <Pencil size={9} /> Explain query
              </button>
              <button
                onClick={() => runQuery('', 'improve')}
                title="Improve this query for better performance"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.10] bg-white/[0.03] text-[11px] font-medium text-text-secondary hover:border-accent-cyan/30 hover:text-accent-bright hover:bg-accent-dim/30 transition-all"
              >
                <Sparkles size={9} /> Improve query
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export function QueriesPage() {
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>(() => [
    ...PRESET_QUERIES,
    ..._cache.aiQueries,
  ]);
  const [activeId, setActiveId] = useState<string>('p0');
  const [editorValue, setEditorValue] = useState<string>(PRESET_QUERIES[0].query);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ESQLQueryResult | null>(
    DEMO_CONFIG.DEMO_MODE ? DEMO_ESQL_RESULTS[0] : null
  );
  const [error, setError] = useState<string | null>(null);
  const [isLiveResult, setIsLiveResult] = useState(false);
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>(_cache.chatHistory);
  const [sidebarTab, setSidebarTab] = useState<'queries' | 'history'>('queries');
  const [restoreTurn, setRestoreTurn] = useState<ChatTurn | null>(null);
  const isLive = isLiveElasticsearchConfigured();
  const abortRef = useRef<AbortController | null>(null);

 
  useEffect(() => {
    const q = savedQueries.find(q => q.id === activeId);
    if (q) setEditorValue(q.query);
  }, [activeId]);

  function handleUseAiQuery(query: string, label: string) {
    
    const existing = _cache.aiQueries.find(q => q.query === query);
    if (existing) {
      setActiveId(existing.id);
      setEditorValue(existing.query);
      setResult(null); setError(null);
      return;
    }
    const id = `ai-${Date.now()}`;
    const newQ: SavedQuery = { id, label: label || 'AI query', query, source: 'ai' };
    cacheAddQuery(newQ);
    setSavedQueries(qs => {
      
      if (qs.find(q => q.query === query)) return qs;
      return [...qs, newQ];
    });
    setActiveId(id);
    setEditorValue(query);
    setResult(null);
    setError(null);
  }

  const handleRun = async () => {
    if (running) { abortRef.current?.abort(); return; }
    const queryToRun = editorValue.trim();
    if (!queryToRun) return;
    setRunning(true);
    setError(null);
    const activeQ = savedQueries.find(q => q.id === activeId);
    const label = activeQ?.label ?? 'Query';

    if (isLive) {
      abortRef.current = new AbortController();
      try {
        const liveResult = await runEsqlQuery(queryToRun);
        setResult(liveResult);
        setIsLiveResult(true);
        setRunHistory(h => [{
          id: `h-${Date.now()}`, label, query: queryToRun,
          tookMs: liveResult.tookMs, rows: liveResult.totalRows, isLive: true,
          ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
        }, ...h.slice(0, 9)]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        setIsLiveResult(false);
        setRunHistory(h => [{
          id: `h-${Date.now()}`, label, query: queryToRun,
          tookMs: 0, rows: 0, isLive: true, error: msg,
          ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
        }, ...h.slice(0, 9)]);
      } finally { setRunning(false); }
    } else {
      setTimeout(() => {
        const idx = savedQueries.findIndex(q => q.id === activeId);
        const demoResult = DEMO_ESQL_RESULTS[idx] ?? DEMO_ESQL_RESULTS[0];
        setResult(demoResult);
        setIsLiveResult(false);
        setRunHistory(h => [{
          id: `h-${Date.now()}`, label, query: queryToRun,
          tookMs: demoResult.tookMs, rows: demoResult.totalRows, isLive: false,
          ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
        }, ...h.slice(0, 9)]);
        setRunning(false);
      }, 600);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left sidebar ── */}
      <div className="w-[200px] flex-shrink-0 border-r border-white/[0.06] flex flex-col bg-surface">
        <div className="p-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-2">
            <Database size={12} className="text-accent-cyan" />
            <span className="text-xs font-semibold text-text-primary">ES|QL Workbench</span>
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium ${
            isLive ? 'bg-status-ok/10 text-status-ok border border-status-ok/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}>
            {isLive ? <Wifi size={9} /> : <WifiOff size={9} />}
            {isLive ? 'Live · Elasticsearch' : 'Demo mode'}
          </div>
        </div>

        {/* Sidebar tabs */}
        <div className="flex border-b border-white/[0.06]">
          {(['queries', 'history'] as const).map(t => (
            <button key={t} onClick={() => setSidebarTab(t)}
              className={`flex-1 py-1.5 text-[10px] font-medium capitalize transition-colors ${
                sidebarTab === t ? 'text-accent-bright border-b border-accent-cyan' : 'text-text-muted hover:text-text-secondary'
              }`}>
              {t === 'history' ? 'AI History' : 'Queries'}
            </button>
          ))}
        </div>

        {sidebarTab === 'queries' ? (
          <div className="flex-1 overflow-y-auto">
            {/* Presets */}
            <div className="px-2 pt-2 pb-1">
              <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider px-1">Presets</span>
            </div>
            <div className="px-2 space-y-0.5">
              {savedQueries.filter(q => q.source === 'preset').map(q => (
                <button key={q.id} onClick={() => { setActiveId(q.id); setResult(null); setError(null); }}
                  className={`w-full text-left p-2 rounded-lg border transition-all duration-150 ${
                    activeId === q.id ? 'border-accent-cyan/40 bg-accent-dim' : 'border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]'
                  }`}>
                  <div className="flex items-center gap-1.5">
                    <ChevronRight size={9} className={activeId === q.id ? 'text-accent-cyan' : 'text-text-muted'} />
                    <span className={`text-[11px] truncate ${activeId === q.id ? 'text-accent-bright' : 'text-text-secondary'}`}>{q.label}</span>
                  </div>
                </button>
              ))}
            </div>
            {/* AI Generated */}
            {savedQueries.some(q => q.source === 'ai') && (
              <>
                <div className="px-2 pt-3 pb-1">
                  <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider px-1 flex items-center gap-1">
                    <Sparkles size={8} className="text-accent-cyan" /> AI Generated
                  </span>
                </div>
                <div className="px-2 space-y-0.5">
                  {savedQueries.filter(q => q.source === 'ai').map(q => (
                    <button key={q.id} onClick={() => { setActiveId(q.id); setResult(null); setError(null); }}
                      className={`w-full text-left p-2 rounded-lg border transition-all duration-150 ${
                        activeId === q.id ? 'border-accent-cyan/40 bg-accent-dim' : 'border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]'
                      }`}>
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={8} className={activeId === q.id ? 'text-accent-cyan' : 'text-text-muted'} />
                        <span className={`text-[11px] truncate ${activeId === q.id ? 'text-accent-bright' : 'text-text-secondary'}`}>{q.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <ChatHistoryPanel
              history={chatHistory}
              onSelect={(turn) => {
                
                setRestoreTurn(turn);
                
                if (turn.query) {
                  handleUseAiQuery(turn.query, turn.prompt.slice(0, 45));
                }
                
                setSidebarTab('queries');
              }}
            />
          </div>
        )}

        {/* Run history */}
        <div className="p-3 border-t border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-1 mb-2">
            <Clock size={9} className="text-text-muted" />
            <span className="text-[10px] text-text-muted font-semibold">Run history</span>
          </div>
          {runHistory.length === 0
            ? <p className="text-[9px] text-text-muted italic pl-1">No runs yet</p>
            : runHistory.slice(0, 5).map(h => (
              <button key={h.id} onClick={() => {
                setEditorValue(h.query);
                setResult(null); setError(null);
              }} className="w-full text-left mb-1 hover:bg-white/[0.03] rounded px-1 py-0.5 transition-colors">
                <div className={`text-[9px] font-mono flex items-center gap-1 ${h.error ? 'text-status-critical' : 'text-text-muted'}`}>
                  {h.isLive && <span className="w-1 h-1 rounded-full bg-status-ok flex-shrink-0" />}
                  <span className="truncate flex-1">{h.label}</span>
                  <span className="flex-shrink-0">{h.ts}</span>
                </div>
                {!h.error && <div className="text-[9px] font-mono text-text-muted pl-2">{h.tookMs}ms · {h.rows} rows</div>}
              </button>
            ))
          }
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* AI Composer */}
        <AiQueryComposer
          currentQuery={editorValue}
          onUseQuery={handleUseAiQuery}
          onHistoryLoaded={(turns) => { setChatHistory(turns); _cache.chatHistory = turns; }}
          restoreTurn={restoreTurn}
          onRestoreConsumed={() => setRestoreTurn(null)}
        />

        {/* Editable ES|QL Editor */}
        <div className="p-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-primary">ES|QL Editor</span>
              <Pencil size={10} className="text-text-muted" />
              {savedQueries.find(q => q.id === activeId)?.source === 'ai' && (
                <span className="flex items-center gap-1 text-[10px] text-accent-bright bg-accent-dim px-1.5 py-0.5 rounded border border-accent-cyan/20">
                  <Sparkles size={8} /> AI generated
                </span>
              )}
              {isLiveResult && (
                <span className="flex items-center gap-1 text-[10px] text-status-ok font-medium">
                  <Wifi size={9} /> Live
                </span>
              )}
            </div>
            <button
              onClick={handleRun}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                running
                  ? 'bg-status-critical/15 text-status-critical border border-status-critical/25 hover:bg-status-critical/25'
                  : 'bg-accent-cyan hover:bg-accent-bright shadow-sm'
              }`}
              style={running ? undefined : { color: '#0B0F14' }}
            >
              <Play size={11} />
              {running ? 'Cancel' : isLive ? 'Execute (Live)' : 'Execute'}
            </button>
          </div>
          <MonacoEditor
            value={editorValue}
            onChange={setEditorValue}
            language="sql"
            height="160px"
          />
          <p className="text-[9px] text-text-muted mt-1.5">Ctrl+Enter to execute · Edit directly or load from AI</p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="flex gap-3 p-3 rounded-xl bg-status-critical/10 border border-status-critical/25">
              <AlertCircle size={14} className="text-status-critical flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-status-critical mb-1">Query Error</p>
                <p className="text-[11px] text-text-secondary font-mono leading-relaxed break-all">{error}</p>
                <p className="text-[10px] text-text-muted mt-2">Check your Elasticsearch URL and API key in <code className="text-accent-bright">.env</code></p>
              </div>
            </div>
          )}

          {result && !error && (
            <div className="sentinel-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Results</span>
                <span className="text-[10px] font-mono text-text-muted">{result.totalRows} rows · {result.tookMs}ms</span>
                {isLiveResult && <span className="ml-auto flex items-center gap-1 text-[10px] text-status-ok"><Wifi size={8} />from Elasticsearch</span>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {result.columns.map(col => (
                        <th key={col.name} className="text-left px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-text-muted">{col.name}</span>
                            <ColumnTypeChip type={col.type} />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        {result.columns.map(col => (
                          <td key={col.name} className="px-4 py-2.5 text-[11px] font-mono text-text-secondary">
                            {String(row[col.name] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!result && !error && !running && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Play size={24} className="text-text-muted mb-3" />
              <p className="text-sm text-text-muted">
                {isLive ? 'Click Execute (Live) to run against Elasticsearch' : 'Click Execute to run the query'}
              </p>
              <p className="text-[11px] text-text-muted mt-1">or use Ctrl+Enter in the editor</p>
            </div>
          )}

          {running && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-accent-cyan/30 border-t-accent-cyan animate-spin mb-3" />
              <p className="text-sm text-text-muted">{isLive ? 'Querying Elasticsearch...' : 'Running query...'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
