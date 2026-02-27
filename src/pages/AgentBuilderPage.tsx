import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot, Plus, Trash2, Send, Loader2, CheckCircle2, AlertCircle,
  Zap, Code2, Settings, ChevronRight, Wifi, WifiOff, RefreshCw,
  ChevronDown, Wrench, Brain, Cpu, Square, MessageSquare, Clock,
  Paperclip, X, Wand2, Pencil, Tag,
} from 'lucide-react';
import {
  listAgents, createAgent, deleteAgent, converseWithAgent,
  createTool, deleteTool, listTools,
  listConnectors, listConversations, getConversation, createAttachment,
  isAgentBuilderConfigured,
  SENTINEL_AGENT_DEFINITION, SENTINEL_ESQL_TOOL, ALL_SENTINEL_AGENTS,
  type AgentBuilderAgent, type AgentBuilderTool, type ChatMessage,
  type KibanaConnector, type ConverseStep, type AgentConversation,
} from '../lib/agentBuilder';
import { Badge } from '../components/ui/Badge';
import { CodeBlock } from '../components/ui/CodeBlock';
import { MonacoEditor } from '../components/ui/MonacoEditor';
import { useLiveAgentOrchestrator } from '../hooks/useLiveAgentOrchestrator';
import { DEMO_CONFIG } from '../config/demo.config';



function StepIcon({ type }: { type: string }) {
  if (type === 'reasoning') return <Brain size={9} className="text-accent-cyan flex-shrink-0" />;
  if (type === 'tool_call') return <Wrench size={9} className="text-orange-400 flex-shrink-0" />;
  return <Cpu size={9} className="text-text-muted flex-shrink-0" />;
}

function ThinkingSteps({ steps, defaultOpen = false }: { steps: ConverseStep[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { if (defaultOpen) setOpen(true); }, [defaultOpen]);
  if (!steps.length) return null;
  const reasoningCount = steps.filter(s => s.type === 'reasoning').length;
  const toolCount = steps.filter(s => s.type === 'tool_call').length;
  return (
    <div className="w-full rounded-lg border border-white/[0.06] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left"
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Brain size={10} className="text-accent-cyan flex-shrink-0" />
          <span className="text-[10px] font-semibold text-accent-bright">Thinking</span>
          <span className="text-[9px] text-text-muted ml-1">
            {reasoningCount > 0 && `${reasoningCount} reasoning`}
            {reasoningCount > 0 && toolCount > 0 && ' · '}
            {toolCount > 0 && `${toolCount} tool call${toolCount > 1 ? 's' : ''}`}
          </span>
        </div>
        <ChevronDown size={10} className={`text-text-muted transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="divide-y divide-white/[0.04]">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-2.5 px-3 py-2.5 bg-white/[0.01]">
              <div className="mt-0.5 flex-shrink-0"><StepIcon type={step.type} /></div>
              <div className="flex-1 min-w-0">
                {step.type === 'reasoning' && (
                  <>
                    <span className="text-[9px] font-semibold text-accent-cyan uppercase tracking-wider block mb-0.5">Reasoning</span>
                    <p className="text-[10px] text-text-muted leading-relaxed">{step.reasoning}</p>
                  </>
                )}
                {step.type === 'tool_call' && (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-semibold text-orange-400 uppercase tracking-wider">Tool</span>
                      <code className="text-[9px] font-mono text-orange-300 bg-orange-400/10 px-1.5 py-0.5 rounded">{step.tool_id}</code>
                    </div>
                    {step.progression && step.progression.length > 0 && (
                      <p className="text-[10px] text-text-muted italic">{step.progression[0].message}</p>
                    )}
                    {step.params && Object.keys(step.params).length > 0 && (
                      <pre className="text-[9px] font-mono text-text-muted mt-1 bg-white/[0.03] rounded px-2 py-1 overflow-x-auto">
                        {JSON.stringify(step.params, null, 2)}
                      </pre>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



function MarkdownContent({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  return (
    <div className="prose prose-invert prose-xs max-w-none text-text-secondary
      prose-p:text-text-secondary prose-p:text-xs prose-p:leading-relaxed prose-p:my-1
      prose-headings:text-text-primary prose-headings:font-semibold
      prose-h1:text-sm prose-h2:text-xs prose-h3:text-xs
      prose-strong:text-text-primary prose-strong:font-semibold
      prose-code:text-accent-bright prose-code:bg-white/[0.06] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[10px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-white/[0.04] prose-pre:border prose-pre:border-white/[0.08] prose-pre:rounded-lg prose-pre:p-3 prose-pre:text-[10px]
      prose-ul:text-xs prose-ul:my-1 prose-ul:pl-4
      prose-ol:text-xs prose-ol:my-1 prose-ol:pl-4
      prose-li:text-text-secondary prose-li:my-0.5
      prose-blockquote:border-l-accent-cyan prose-blockquote:text-text-muted prose-blockquote:text-xs
      prose-table:text-xs prose-th:text-text-primary prose-td:text-text-secondary
      prose-a:text-accent-bright prose-a:no-underline hover:prose-a:underline
      [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-0.5 h-3 bg-accent-cyan ml-0.5 animate-pulse align-middle" />
      )}
    </div>
  );
}



function ConnectionBanner({ configured }: { configured: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-medium border ${
      configured
        ? 'bg-status-ok/10 text-status-ok border-status-ok/20'
        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    }`}>
      {configured ? <Wifi size={10} /> : <WifiOff size={10} />}
      {configured ? 'Connected · Elastic Agent Builder' : 'Add VITE_KIBANA_URL + VITE_KIBANA_API_KEY to .env'}
    </div>
  );
}



const MODEL_PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#D97706',
  openai: '#10B981',
  google: '#3B82F6',
  elastic: '#06B6D4',
};

function getProviderColor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('claude') || lower.includes('anthropic')) return MODEL_PROVIDER_COLORS.anthropic;
  if (lower.includes('gpt') || lower.includes('openai')) return MODEL_PROVIDER_COLORS.openai;
  if (lower.includes('gemini') || lower.includes('google')) return MODEL_PROVIDER_COLORS.google;
  return MODEL_PROVIDER_COLORS.elastic;
}

function ModelSelector({ connectors, selected, onChange }: {
  connectors: KibanaConnector[];
  selected: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = connectors.find(c => c.id === selected);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!connectors.length) return null;
  const color = current ? getProviderColor(current.name) : '#06B6D4';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.14] hover:bg-white/[0.06] transition-all text-left"
      >
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[10px] text-text-secondary font-medium max-w-[140px] truncate">
          {current?.name ?? 'Select model'}
        </span>
        <ChevronDown size={9} className={`text-text-muted transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-[#0F1520] border border-white/[0.10] rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-white/[0.06]">
            <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">Select Model</span>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {connectors.map(c => {
              const isSelected = c.id === selected;
              const providerColor = getProviderColor(c.name);
              return (
                <button
                  key={c.id}
                  onClick={() => { onChange(c.id); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.04] transition-colors text-left ${isSelected ? 'bg-white/[0.03]' : ''}`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: providerColor }} />
                  <span className={`text-xs flex-1 truncate ${isSelected ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                    {c.name}
                  </span>
                  {isSelected && <CheckCircle2 size={10} className="text-accent-cyan flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}



function AgentCard({ agent, isSelected, onSelect, onDelete }: {
  agent: AgentBuilderAgent; isSelected: boolean; onSelect: () => void; onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
        isSelected ? 'border-accent-cyan/40 bg-accent-dim' : 'border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.02]'
      }`}
    >
      <div className="flex items-start gap-2">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{ backgroundColor: agent.avatar_color + '22', color: agent.avatar_color }}
        >
          {agent.avatar_symbol}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-text-primary truncate">{agent.name}</div>
          <div className="text-[10px] text-text-muted mt-0.5 line-clamp-2">{agent.description}</div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {agent.labels.slice(0, 3).map(l => (
              <span key={l} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-text-muted font-mono">{l}</span>
            ))}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded text-text-muted hover:text-status-critical hover:bg-status-critical/10 transition-colors flex-shrink-0"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}



function ConversationItem({ conv, isActive, onClick }: {
  conv: AgentConversation; isActive: boolean; onClick: () => void;
}) {
  const date = new Date(conv.updated_at);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-2.5 rounded-lg border transition-all duration-150 ${
        isActive ? 'border-accent-cyan/30 bg-accent-dim' : 'border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]'
      }`}
    >
      <div className="flex items-start gap-2">
        <MessageSquare size={10} className={`mt-0.5 flex-shrink-0 ${isActive ? 'text-accent-cyan' : 'text-text-muted'}`} />
        <div className="flex-1 min-w-0">
          <div className={`text-[10px] font-medium truncate ${isActive ? 'text-accent-bright' : 'text-text-secondary'}`}>
            {conv.title || 'Untitled conversation'}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock size={8} className="text-text-muted" />
            <span className="text-[9px] text-text-muted">{timeStr}</span>
          </div>
        </div>
      </div>
    </button>
  );
}



function ChatBubble({ msg, isStreaming }: { msg: ChatMessage; isStreaming?: boolean }) {
  const isUser = msg.role === 'user';
  const hasSteps = !isUser && msg.steps && msg.steps.length > 0;
  const hasContent = Boolean(msg.content);
  const isThinking = isStreaming && hasSteps && !hasContent;

  
  const userContent = isUser ? autoFormatUserMessage(msg.content) : msg.content;

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isUser ? 'bg-accent-dim' : 'bg-status-ok/10'
      }`}>
        {isUser
          ? <span className="text-[9px] font-bold text-accent-bright">YOU</span>
          : <Bot size={11} className="text-status-ok" />}
      </div>
      <div className={`flex-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
        {hasSteps && <ThinkingSteps steps={msg.steps!} defaultOpen={isThinking} />}
        {isStreaming && !hasSteps && !hasContent && (
          <div className="flex items-center gap-1 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        {hasContent && (
          <div className={`px-3 py-2.5 rounded-lg text-xs leading-relaxed ${
            isUser
              ? 'bg-accent-dim border border-accent-cyan/20'
              : 'bg-white/[0.04] border border-white/[0.06]'
          }`}>
            {isUser
              ? <MarkdownContent content={userContent} />
              : <MarkdownContent content={msg.content} isStreaming={isStreaming} />
            }
          </div>
        )}
      </div>
    </div>
  );
}


function autoFormatUserMessage(text: string): string {
  
  if (text.includes('```')) return text;

  
  const codePatterns = [
    /^(FROM|SELECT|POST|GET|PUT|DELETE|STATS|WHERE|LIMIT)\s/im,
    /^\s*\{[\s\S]*\}\s*$/m,  
    /^(curl|wget|fetch)\s/im,
    /\|\s*(WHERE|STATS|SORT|LIMIT|EVAL|KEEP|DROP)\s/i,
  ];

  const lines = text.split('\n');
  const hasCode = codePatterns.some(p => p.test(text));

  if (!hasCode) return text;

  
  if (lines.length <= 1 || codePatterns.some(p => p.test(lines[0]))) {
    
    const firstCodeLine = lines.findIndex(l => codePatterns.some(p => p.test(l.trim())));
    if (firstCodeLine > 0) {
      const prefix = lines.slice(0, firstCodeLine).join('\n');
      const code = lines.slice(firstCodeLine).join('\n');
      return `${prefix}\n\n\`\`\`\n${code}\n\`\`\``;
    }
    return `\`\`\`\n${text}\n\`\`\``;
  }

  return text;
}



function AttachmentPill({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.06] border border-white/[0.10] text-[10px] text-text-secondary">
      <Paperclip size={9} className="text-text-muted flex-shrink-0" />
      <span className="max-w-[120px] truncate">{name}</span>
      <button onClick={onRemove} className="text-text-muted hover:text-status-critical transition-colors">
        <X size={9} />
      </button>
    </div>
  );
}


const VALID_PARAM_TYPES = ['text', 'keyword', 'long', 'integer', 'double', 'float', 'boolean', 'date', 'object', 'nested'] as const;
type EsParamType = typeof VALID_PARAM_TYPES[number];

interface DraftToolParam { type: EsParamType; description: string; }
interface DraftTool {
  id: string;
  description: string;
  tags: string[];
  query: string;
  params: Record<string, DraftToolParam>;
}


const TOOL_BUILDER_SYSTEM_PROMPT = `You are an Elastic Agent Builder ES|QL tool designer.
Given a user's natural language description, output ONLY a valid JSON object (no markdown, no explanation) matching this exact schema:

{
  "id": "kebab-case-tool-id",
  "description": "One sentence describing what this tool does",
  "tags": ["tag1", "tag2"],
  "query": "FROM index-pattern METADATA _index\\n| WHERE ...\\n| STATS ...\\n| LIMIT 20",
  "params": {
    "paramName": {
      "type": "keyword|text|long|integer|double|float|boolean|date|object|nested",
      "description": "What this param controls"
    }
  }
}

STRICT RULES:
1. params.type MUST be one of: text, keyword, long, integer, double, float, boolean, date, object, nested
2. Use "keyword" for string/text params (time windows, names, patterns)
3. Use "long" or "integer" for numeric thresholds
4. Use "date" for timestamps
5. ES|QL query params use ?paramName syntax
6. ONLY use valid ES|QL aggregate functions: COUNT, COUNT_DISTINCT, AVG, MIN, MAX, SUM, PERCENTILE, MEDIAN, VALUES
7. NEVER use STDDEV_POPULATION, STDDEV_SAMPLE, VAR_POPULATION, VAR_SAMPLE
8. Use METADATA _index when you need the _index field: FROM * METADATA _index
9. Output ONLY the JSON object — no markdown fences, no explanation`;


interface AiToolCreatorProps {
  agents: AgentBuilderAgent[];
  configured: boolean;
  onDeploy: (tool: Omit<AgentBuilderTool, 'readonly' | 'schema'>) => Promise<void>;
  deploying: boolean;
}

function AiToolCreator({ agents, configured, onDeploy, deploying }: AiToolCreatorProps) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<DraftTool | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editQuery, setEditQuery] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editId, setEditId] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editParams, setEditParams] = useState('');
  const [deployDone, setDeployDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  
  const agent = agents.find(a =>
    a.name.toLowerCase().includes('sentinel') ||
    a.name.toLowerCase().includes('esql') ||
    a.name.toLowerCase().includes('query')
  ) ?? agents[0] ?? null;

  const enterEdit = (d: DraftTool) => {
    setEditId(d.id);
    setEditDesc(d.description);
    setEditQuery(d.query);
    setEditTags(d.tags.join(', '));
    setEditParams(JSON.stringify(d.params, null, 2));
    setEditing(true);
  };

  const applyEdit = () => {
    try {
      const params = JSON.parse(editParams);
      setDraft({ id: editId, description: editDesc, query: editQuery, tags: editTags.split(',').map(t => t.trim()).filter(Boolean), params });
      setEditing(false);
      setGenError(null);
    } catch {
      setGenError('Invalid JSON in params field');
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !agent || generating) return;
    setGenerating(true);
    setDraft(null);
    setGenError(null);
    setDeployDone(false);
    abortRef.current = new AbortController();

    let fullText = '';
    try {
      await converseWithAgent(
        agent.id,
        `${TOOL_BUILDER_SYSTEM_PROMPT}\n\nUser request: ${prompt.trim()}`,
        undefined, undefined,
        { onMessageChunk: (c) => { fullText += c; } },
        abortRef.current.signal
      );
      
      const cleaned = fullText.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
      const parsed: DraftTool = JSON.parse(cleaned);
      
      for (const [k, v] of Object.entries(parsed.params ?? {})) {
        if (!VALID_PARAM_TYPES.includes(v.type as EsParamType)) {
          parsed.params[k].type = 'keyword'; 
        }
      }
      setDraft(parsed);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setGenError(`Generation failed: ${e instanceof Error ? e.message : 'Unknown error'}. Try rephrasing your request.`);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDeploy = async () => {
    if (!draft) return;
    const tool: Omit<AgentBuilderTool, 'readonly' | 'schema'> = {
      id: draft.id,
      type: 'esql',
      description: draft.description,
      tags: draft.tags,
      configuration: { query: draft.query, params: draft.params },
    };
    await onDeploy(tool);
    setDeployDone(true);
    setTimeout(() => { setDraft(null); setPrompt(''); setDeployDone(false); }, 2000);
  };

  const SUGGESTIONS = [
    'Find indices with the most documents in the last hour',
    'Detect services with error rates above a threshold',
    'Show top slow queries by average latency',
    'Count events per minute grouped by log level',
    'Find nodes with high indexing rates',
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-1">
        <div className="w-5 h-5 rounded-md bg-accent-dim border border-accent-cyan/25 flex items-center justify-center flex-shrink-0">
          <Wand2 size={10} className="text-accent-cyan" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-text-primary">AI Tool Creator</p>
          <p className="text-[9px] text-text-muted">Natural language → ES|QL tool → deploy</p>
        </div>
      </div>

      {!configured && (
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400">
          Configure Agent Builder to enable AI tool generation.
        </div>
      )}

      {configured && !agent && (
        <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[10px] text-text-muted">
          No agents found. Create an agent first to use AI tool generation.
        </div>
      )}

      {configured && agent && !draft && (
        <>
          <div className={`flex items-center gap-2 rounded-xl border transition-all ${
            generating ? 'border-accent-cyan/40 bg-accent-dim/30' : 'border-white/[0.10] bg-white/[0.03] focus-within:border-accent-cyan/40'
          }`}>
            <Wand2 size={11} className={`ml-3 flex-shrink-0 ${generating ? 'text-accent-cyan' : 'text-text-muted'}`} />
            <input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
              placeholder="Describe the tool you want to create..."
              disabled={generating}
              className="flex-1 bg-transparent py-2.5 text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={generating ? () => abortRef.current?.abort() : handleGenerate}
              disabled={!prompt.trim() && !generating}
              className={`flex items-center gap-1 px-3 py-2 mr-1 rounded-lg text-[10px] font-semibold transition-all flex-shrink-0 ${
                generating
                  ? 'bg-status-critical/15 text-status-critical border border-status-critical/20'
                  : 'bg-accent-cyan/15 text-accent-bright border border-accent-cyan/20 disabled:opacity-30'
              }`}
            >
              {generating ? <><Square size={9} /> Stop</> : <><Zap size={9} /> Generate</>}
            </button>
          </div>

          {generating && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <Loader2 size={11} className="text-accent-cyan animate-spin flex-shrink-0" />
              <span className="text-[10px] text-text-muted">Generating ES|QL tool definition...</span>
            </div>
          )}

          {!generating && !prompt && (
            <div className="space-y-1">
              <p className="text-[9px] text-text-muted uppercase tracking-wider font-semibold px-0.5">Suggestions</p>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => setPrompt(s)}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-white/[0.08] hover:bg-white/[0.03] transition-all group">
                  <ChevronRight size={9} className="text-text-muted group-hover:text-accent-cyan flex-shrink-0 transition-colors" />
                  <span className="text-[10px] text-text-muted group-hover:text-text-secondary transition-colors">{s}</span>
                </button>
              ))}
            </div>
          )}

          {genError && (
            <div className="flex gap-2 p-2.5 rounded-lg bg-status-critical/10 border border-status-critical/20">
              <AlertCircle size={11} className="text-status-critical flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-status-critical leading-relaxed">{genError}</p>
            </div>
          )}
        </>
      )}

      {/* Draft review panel */}
      {draft && !editing && (
        <div className="rounded-xl border border-accent-cyan/20 bg-white/[0.02] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-accent-dim/40 border-b border-accent-cyan/15">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={11} className="text-status-ok" />
              <span className="text-[10px] font-semibold text-text-primary">Tool ready to review</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => enterEdit(draft)}
                className="flex items-center gap-1 px-2 py-1 rounded text-[9px] text-text-muted hover:text-accent-bright hover:bg-accent-dim transition-colors border border-transparent hover:border-accent-cyan/20">
                <Pencil size={8} /> Edit
              </button>
              <button onClick={() => { setDraft(null); setDeployDone(false); }}
                className="p-1 rounded text-text-muted hover:text-status-critical hover:bg-status-critical/10 transition-colors">
                <X size={10} />
              </button>
            </div>
          </div>

          <div className="p-3 space-y-2.5">
            {/* ID + description */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <code className="text-[10px] font-mono text-accent-bright bg-accent-dim px-1.5 py-0.5 rounded">{draft.id}</code>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-text-muted font-semibold uppercase">esql</span>
              </div>
              <p className="text-[10px] text-text-secondary leading-relaxed">{draft.description}</p>
            </div>

            {/* Tags */}
            {draft.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {draft.tags.map(t => (
                  <span key={t} className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-text-muted font-mono">
                    <Tag size={7} />{t}
                  </span>
                ))}
              </div>
            )}

            {/* Query */}
            <div className="rounded-lg overflow-hidden border border-white/[0.08]">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0a1628] border-b border-white/[0.06]">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
                <span className="text-[9px] font-mono font-semibold text-accent-bright uppercase tracking-wider">ES|QL Query</span>
              </div>
              <pre className="p-2.5 text-[10px] font-mono text-cyan-300/80 bg-[#060d1a] overflow-x-auto whitespace-pre leading-relaxed">{draft.query}</pre>
            </div>

            {/* Params */}
            {Object.keys(draft.params).length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">Parameters</p>
                {Object.entries(draft.params).map(([name, p]) => (
                  <div key={name} className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <code className="text-[9px] font-mono text-accent-bright flex-shrink-0 mt-0.5">?{name}</code>
                    <span className="text-[9px] px-1 py-0.5 rounded bg-white/[0.06] text-text-muted font-mono flex-shrink-0">{p.type}</span>
                    <span className="text-[9px] text-text-muted leading-relaxed">{p.description}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Deploy button */}
            <button
              onClick={handleDeploy}
              disabled={deploying || deployDone}
              className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all ${
                deployDone
                  ? 'bg-status-ok/15 text-status-ok border border-status-ok/30'
                  : 'bg-accent-cyan text-[#0B0F14] hover:bg-accent-bright disabled:opacity-40'
              }`}
            >
              {deploying ? <Loader2 size={11} className="animate-spin" /> : deployDone ? <CheckCircle2 size={11} /> : <Zap size={11} />}
              {deploying ? 'Deploying...' : deployDone ? 'Deployed!' : 'Deploy to Agent Builder'}
            </button>
          </div>
        </div>
      )}

      {/* Edit mode */}
      {draft && editing && (
        <div className="rounded-xl border border-white/[0.10] bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-white/[0.02]">
            <span className="text-[10px] font-semibold text-text-primary flex items-center gap-1.5"><Pencil size={9} className="text-accent-cyan" /> Edit Tool</span>
            <button onClick={() => setEditing(false)} className="p-1 rounded text-text-muted hover:text-text-secondary transition-colors"><X size={10} /></button>
          </div>
          <div className="p-3 space-y-2.5">
            {[
              { label: 'Tool ID', val: editId, set: setEditId, mono: true },
              { label: 'Description', val: editDesc, set: setEditDesc, mono: false },
              { label: 'Tags (comma-separated)', val: editTags, set: setEditTags, mono: false },
            ].map(({ label, val, set, mono }) => (
              <div key={label}>
                <label className="text-[9px] font-semibold text-text-muted uppercase tracking-wider block mb-1">{label}</label>
                <input value={val} onChange={e => set(e.target.value)}
                  className={`w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-2 text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/40 ${mono ? 'font-mono' : ''}`} />
              </div>
            ))}
            <div>
              <label className="text-[9px] font-semibold text-text-muted uppercase tracking-wider block mb-1">ES|QL Query</label>
              <MonacoEditor
                value={editQuery}
                onChange={setEditQuery}
                language="sql"
                height="140px"
              />
            </div>
            <div>
              <label className="text-[9px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                Params (JSON) — types: {VALID_PARAM_TYPES.join(', ')}
              </label>
              <MonacoEditor
                value={editParams}
                onChange={setEditParams}
                language="json"
                height="110px"
              />
            </div>
            {genError && <p className="text-[10px] text-status-critical">{genError}</p>}
            <div className="flex gap-2">
              <button onClick={applyEdit}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-accent-cyan text-[11px] font-semibold hover:bg-accent-bright transition-colors"
                style={{ color: '#0B0F14' }}>
                <CheckCircle2 size={11} /> Apply Changes
              </button>
              <button onClick={() => { setEditing(false); setGenError(null); }}
                className="px-3 py-2 rounded-lg border border-white/[0.08] text-[11px] text-text-muted hover:text-text-secondary transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



type Tab = 'agents' | 'create' | 'tools' | 'ai-tool';
type RightPanel = 'chat' | 'history';

export function AgentBuilderPage() {
  const configured = isAgentBuilderConfigured();
  const { replayResponse } = useLiveAgentOrchestrator();

  
  const [leftWidth, setLeftWidth] = useState(346);
  const isResizing = useRef(false);
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startW = leftWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      setLeftWidth(Math.min(480, Math.max(220, startW + ev.clientX - startX)));
    };
    const onUp = () => {
      isResizing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [leftWidth]);

  const [tab, setTab] = useState<Tab>('agents');
  const [rightPanel, setRightPanel] = useState<RightPanel>('chat');
  const [agents, setAgents] = useState<AgentBuilderAgent[]>([]);
  const [tools, setTools] = useState<AgentBuilderTool[]>([]);
  const [connectors, setConnectors] = useState<KibanaConnector[]>([]);
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [selectedConnectorId, setSelectedConnectorId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentBuilderAgent | null>(null);

  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  
  const [pendingAttachments, setPendingAttachments] = useState<Array<{ name: string; type: string; data: unknown }>>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createInstructions, setCreateInstructions] = useState('');
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(['platform.core.search', 'platform.core.list_indices', 'platform.core.get_index_mapping']);
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);

  
  const [deployingTool, setDeployingTool] = useState(false);
  const [deployingAgent, setDeployingAgent] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null);

  
  const [deployingAll, setDeployingAll] = useState(false);
  const [deployAllProgress, setDeployAllProgress] = useState<Record<string, 'pending' | 'deploying' | 'done' | 'skipped' | 'error'>>({});

  
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) setShowAttachMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadAgents = useCallback(async () => {
    if (!configured) return;
    setLoading(true); setError(null);
    try {
      const [list, conns, toolList] = await Promise.all([
        listAgents(),
        listConnectors().catch(() => [] as KibanaConnector[]),
        listTools().catch(() => [] as AgentBuilderTool[]),
      ]);
      setAgents(list);
      setConnectors(conns);
      setTools(toolList);
      if (conns.length && !selectedConnectorId) setSelectedConnectorId(conns[0].id);
      if (list.length > 0 && !selectedAgent) {
        setSelectedAgent(list[0]);
        setMessages([]); setConversationId(undefined);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents');
    } finally { setLoading(false); }
  }, [configured, selectedAgent, selectedConnectorId]);

  const loadConversations = useCallback(async (agentId?: string) => {
    if (!configured) return;
    try {
      const list = await listConversations(agentId);
      setConversations(list);
    } catch { /* non-fatal */ }
  }, [configured]);

  /** Load a past conversation by ID and reconstruct the messages array from rounds */
  const handleLoadConversation = useCallback(async (convId: string) => {
    setLoadingHistory(true);
    setRightPanel('chat');
    setMessages([]);
    setConversationId(convId);
    try {
      const conv = await getConversation(convId);
      if (conv.rounds && conv.rounds.length > 0) {
        const rebuilt: ChatMessage[] = [];
        for (const round of conv.rounds) {
          rebuilt.push({ role: 'user', content: round.input?.message ?? '' });
          rebuilt.push({
            role: 'assistant',
            content: round.response?.message ?? '',
            steps: Array.isArray(round.steps) ? round.steps : [],
          });
        }
        setMessages(rebuilt);
      }
    } catch {
     
      
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'agents') loadAgents();
  }, [tab, loadAgents]);

  useEffect(() => {
    if (selectedAgent) loadConversations(selectedAgent.id);
  }, [selectedAgent, loadConversations]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStop = useCallback(() => { abortControllerRef.current?.abort(); }, []);

  const liveStepsRef = useRef<ConverseStep[]>([]);

  const handleSend = async () => {
    if (!input.trim() || !selectedAgent || streaming) return;
    const userMsg = input.trim();
    setInput('');
    setPendingAttachments([]);
    setMessages(m => [...m, { role: 'user', content: userMsg }]);
    setStreaming(true);
    liveStepsRef.current = [];

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setMessages(m => [...m, { role: 'assistant', content: '', steps: [] }]);

    const updateLast = (patch: Partial<ChatMessage>) =>
      setMessages(m => {
        const updated = [...m];
        updated[updated.length - 1] = { ...updated[updated.length - 1], ...patch };
        return updated;
      });

    try {
      
      let attachConvId = conversationId;

      const result = await converseWithAgent(
        selectedAgent.id, userMsg, conversationId, selectedConnectorId || undefined,
        {
          onConversationId: async (id) => {
            setConversationId(id);
            attachConvId = id;
            
            if (pendingAttachments.length > 0) {
              await Promise.allSettled(
                pendingAttachments.map(att =>
                  createAttachment(id, { type: att.type, data: att.data, description: att.name })
                )
              );
            }
          },
          onReasoning: (text, transient) => {
            if (!transient) {
              liveStepsRef.current = [...liveStepsRef.current, { type: 'reasoning', reasoning: text }];
              updateLast({ steps: liveStepsRef.current });
            }
          },
          onToolCall: (toolId, params) => {
            liveStepsRef.current = [...liveStepsRef.current, { type: 'tool_call', tool_id: toolId, params, progression: [] }];
            updateLast({ steps: liveStepsRef.current });
          },
          onToolProgress: (_tcId, message) => {
            const steps = [...liveStepsRef.current];
            const last = [...steps].reverse().find(s => s.type === 'tool_call');
            if (last) last.progression = [...(last.progression ?? []), { message }];
            liveStepsRef.current = steps;
            updateLast({ steps: liveStepsRef.current });
          },
          onMessageChunk: (chunk) =>
            setMessages(m => {
              const updated = [...m];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = { ...last, content: (last.content ?? '') + chunk };
              return updated;
            }),
        },
        controller.signal
      );

      
      setMessages(m => {
        const updated = [...m];
        const last = updated[updated.length - 1];
        updated[updated.length - 1] = {
          ...last,
          content: last.content || result.response?.message || '',
          steps: result.steps?.length ? result.steps : liveStepsRef.current,
        };
        return updated;
      });

      if (!DEMO_CONFIG.DEMO_MODE && result.steps?.length) {
        replayResponse(result, `live-${Date.now()}`);
      }

      
      if (attachConvId) loadConversations(selectedAgent.id);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        updateLast({ steps: liveStepsRef.current });
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        updateLast({ content: `Error: ${msg}`, steps: [] });
      }
    } finally {
      abortControllerRef.current = null;
      setStreaming(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!createName.trim()) return;
    setCreating(true); setError(null);
    try {
      const newAgent = await createAgent({
        id: `sentinel-custom-${Date.now()}`,
        name: createName,
        description: createDesc,
        labels: ['sentinel', 'custom'],
        avatar_color: '#06B6D4',
        avatar_symbol: createName.slice(0, 2).toUpperCase(),
        configuration: {
          instructions: createInstructions || 'You are a helpful agent connected to Elasticsearch data.',
          tools: [{ tool_ids: selectedToolIds.length ? selectedToolIds : ['platform.core.search', 'platform.core.list_indices'] }],
        },
      });
      setAgents(a => [...a, newAgent]);
      setCreateSuccess(true);
      setCreateName(''); setCreateDesc(''); setCreateInstructions('');
      setSelectedToolIds(['platform.core.search', 'platform.core.list_indices', 'platform.core.get_index_mapping']);
      setTimeout(() => { setCreateSuccess(false); setTab('agents'); }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally { setCreating(false); }
  };

  const handleDeleteAgent = async (id: string) => {
    try {
      await deleteAgent(id);
      setAgents(a => a.filter(ag => ag.id !== id));
      if (selectedAgent?.id === id) setSelectedAgent(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Delete failed'); }
  };

  const handleDeploySentinelAgent = async () => {
    setDeployingAgent(true); setDeploySuccess(null); setError(null);
    try {
      await createAgent(SENTINEL_AGENT_DEFINITION);
      setDeploySuccess('SENTINEL Incident Responder deployed');
      await loadAgents(); setTab('agents');
    } catch (e) { setError(e instanceof Error ? e.message : 'Deploy failed'); }
    finally { setDeployingAgent(false); }
  };

  const handleDeploySentinelTool = async () => {
    setDeployingTool(true); setDeploySuccess(null); setError(null);
    try {
      await createTool(SENTINEL_ESQL_TOOL);
      setDeploySuccess('Connection Pool Analyzer tool deployed');
    } catch (e) { setError(e instanceof Error ? e.message : 'Deploy failed'); }
    finally { setDeployingTool(false); }
  };

  const handleDeployAllAgents = async () => {
    setDeployingAll(true); setDeploySuccess(null); setError(null);
    const initial: Record<string, 'pending' | 'deploying' | 'done' | 'skipped' | 'error'> = {};
    ALL_SENTINEL_AGENTS.forEach(a => { initial[a.id] = 'pending'; });
    setDeployAllProgress(initial);
    let successCount = 0;
    let skippedCount = 0;
    for (const agentDef of ALL_SENTINEL_AGENTS) {
      setDeployAllProgress(p => ({ ...p, [agentDef.id]: 'deploying' }));
      try {
        await createAgent(agentDef);
        setDeployAllProgress(p => ({ ...p, [agentDef.id]: 'done' }));
        successCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        
        if (msg.includes('already exists')) {
          setDeployAllProgress(p => ({ ...p, [agentDef.id]: 'skipped' }));
          skippedCount++;
        } else {
          setDeployAllProgress(p => ({ ...p, [agentDef.id]: 'error' }));
        }
      }
    }
    setDeployingAll(false);
    const totalOk = successCount + skippedCount;
    if (totalOk === ALL_SENTINEL_AGENTS.length) {
      if (skippedCount === ALL_SENTINEL_AGENTS.length) {
        setDeploySuccess('All 5 SENTINEL agents already deployed — ready to go');
      } else if (skippedCount > 0) {
        setDeploySuccess(`${successCount} deployed, ${skippedCount} already existed — all agents ready`);
      } else {
        setDeploySuccess(`All ${successCount} SENTINEL agents deployed successfully`);
      }
      await loadAgents();
      setTab('agents');
    } else {
      setError(`${totalOk}/${ALL_SENTINEL_AGENTS.length} agents ready — ${ALL_SENTINEL_AGENTS.length - totalOk} failed. Check Kibana API key permissions.`);
    }
  };

  const handleDeployAiTool = async (tool: Omit<AgentBuilderTool, 'readonly' | 'schema'>) => {
    setDeployingTool(true); setDeploySuccess(null); setError(null);
    try {
      await createTool(tool);
      setTools(ts => [...ts, { ...tool, readonly: false }]);
      setDeploySuccess(`Tool "${tool.id}" deployed successfully`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Deploy failed'); }
    finally { setDeployingTool(false); }
  };

  const addContextAttachment = (type: 'screen_context' | 'json' | 'text', label: string, data: unknown) => {
    setPendingAttachments(a => [...a, { name: label, type, data }]);
    setShowAttachMenu(false);
  };

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'create', label: 'Create', icon: Plus },
    { id: 'tools', label: 'Deploy', icon: Code2 },
    { id: 'ai-tool', label: 'AI Tool', icon: Wand2 },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel ── */}
      <div className="flex-shrink-0 border-r border-white/[0.06] flex flex-col" style={{ width: leftWidth }}>
        <div className="p-3 border-b border-white/[0.06] space-y-2">
          <ConnectionBanner configured={configured} />
          <div className="flex gap-1">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-medium transition-colors ${
                    tab === t.id ? 'bg-accent-dim text-accent-bright border border-accent-cyan/30' : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.04]'
                  }`}>
                  <Icon size={10} />{t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {error && (
            <div className="flex gap-2 p-2.5 rounded-lg bg-status-critical/10 border border-status-critical/20">
              <AlertCircle size={12} className="text-status-critical flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-status-critical leading-relaxed break-all">{error}</p>
            </div>
          )}
          {deploySuccess && (
            <div className="flex gap-2 p-2.5 rounded-lg bg-status-ok/10 border border-status-ok/20">
              <CheckCircle2 size={12} className="text-status-ok flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-status-ok leading-relaxed">{deploySuccess}</p>
            </div>
          )}

          {/* Agents tab */}
          {tab === 'agents' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">
                  {agents.length} agent{agents.length !== 1 ? 's' : ''}
                </span>
                <button onClick={loadAgents} disabled={loading}
                  className="p-1 rounded text-text-muted hover:text-accent-bright hover:bg-accent-dim transition-colors">
                  <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
              {loading && <div className="flex items-center justify-center py-8"><Loader2 size={16} className="text-accent-cyan animate-spin" /></div>}
              {!loading && agents.length === 0 && !error && (
                <div className="text-center py-8">
                  <Bot size={24} className="text-text-muted mx-auto mb-2" />
                  <p className="text-xs text-text-muted">No agents yet</p>
                  <p className="text-[10px] text-text-muted mt-1">Deploy SENTINEL or create a custom agent</p>
                </div>
              )}
              {agents.map(agent => (
                <AgentCard key={agent.id} agent={agent} isSelected={selectedAgent?.id === agent.id}
                  onSelect={() => { setSelectedAgent(agent); setMessages([]); setConversationId(undefined); }}
                  onDelete={() => handleDeleteAgent(agent.id)} />
              ))}
            </>
          )}

          {/* Create tab */}
          {tab === 'create' && (
            <div className="space-y-3">
              {(['Agent Name', 'Description'] as const).map((label, i) => (
                <div key={label}>
                  <label className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block mb-1">{label}</label>
                  <input
                    value={i === 0 ? createName : createDesc}
                    onChange={e => i === 0 ? setCreateName(e.target.value) : setCreateDesc(e.target.value)}
                    placeholder={i === 0 ? 'e.g. DB Incident Analyzer' : 'What does this agent do?'}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/40"
                  />
                </div>
              ))}
              <div>
                <label className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block mb-1">System Instructions</label>
                <MonacoEditor
                  value={createInstructions}
                  onChange={setCreateInstructions}
                  language="markdown"
                  height="110px"
                />
              </div>
              <div>
                <label className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block mb-1.5">
                  Tools {tools.length > 0 && <span className="text-text-muted font-normal normal-case">({tools.length} available)</span>}
                </label>
                <div className="space-y-1 max-h-[160px] overflow-y-auto pr-0.5">
                  {tools.length === 0 && <p className="text-[10px] text-text-muted italic">Load agents tab first to fetch tools</p>}
                  {tools.map(tool => {
                    const checked = selectedToolIds.includes(tool.id);
                    return (
                      <label key={tool.id} className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${
                        checked ? 'bg-accent-dim border border-accent-cyan/20' : 'hover:bg-white/[0.03] border border-transparent'
                      }`}>
                        <input type="checkbox" checked={checked}
                          onChange={e => setSelectedToolIds(ids => e.target.checked ? [...ids, tool.id] : ids.filter(id => id !== tool.id))}
                          className="mt-0.5 accent-cyan-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-text-primary truncate">{tool.id}</span>
                            <span className={`text-[8px] px-1 py-0.5 rounded font-semibold uppercase ${
                              tool.type === 'builtin' ? 'bg-accent-dim text-accent-bright' : 'bg-white/[0.06] text-text-muted'
                            }`}>{tool.type}</span>
                          </div>
                          <p className="text-[9px] text-text-muted mt-0.5 line-clamp-1">{tool.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <button onClick={handleCreateAgent} disabled={creating || !createName.trim() || !configured}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-accent-cyan text-xs font-semibold disabled:opacity-40 hover:bg-accent-bright transition-colors"
                style={{ color: '#0B0F14' }}>
                {creating ? <Loader2 size={11} className="animate-spin" /> : createSuccess ? <CheckCircle2 size={11} /> : <Plus size={11} />}
                {creating ? 'Creating...' : createSuccess ? 'Created!' : 'Create Agent'}
              </button>
            </div>
          )}

          {/* Tools/Deploy tab */}
          {tab === 'tools' && (
            <div className="space-y-3">
              <p className="text-[10px] text-text-muted leading-relaxed">Deploy pre-built SENTINEL tools and agents to your Elastic Agent Builder instance.</p>

              {/* ── Deploy Full Pipeline ── */}
              <div className="p-3 rounded-xl border border-accent-cyan/25 bg-gradient-to-b from-accent-dim/40 to-transparent space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-accent-cyan/15 border border-accent-cyan/25 flex items-center justify-center flex-shrink-0">
                    <Zap size={12} className="text-accent-cyan" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-text-primary">Deploy Full SENTINEL Pipeline</div>
                    <div className="text-[10px] text-text-muted">5 specialized agents — Planner · Investigator · Correlator · Remediator · Verifier</div>
                  </div>
                </div>

                {/* Per-agent progress */}
                {Object.keys(deployAllProgress).length > 0 && (
                  <div className="space-y-1">
                    {ALL_SENTINEL_AGENTS.map(a => {
                      const status = deployAllProgress[a.id] ?? 'pending';
                      return (
                        <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                          <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                            style={{ backgroundColor: a.avatar_color + '22', color: a.avatar_color }}>
                            {a.avatar_symbol}
                          </div>
                          <span className="flex-1 text-[10px] text-text-secondary truncate">{a.name}</span>
                          {status === 'pending' && <span className="text-[9px] text-text-muted">Waiting</span>}
                          {status === 'deploying' && <Loader2 size={10} className="text-accent-cyan animate-spin flex-shrink-0" />}
                          {status === 'done' && <CheckCircle2 size={10} className="text-status-ok flex-shrink-0" />}
                          {status === 'skipped' && <span className="text-[9px] text-accent-bright flex items-center gap-1"><CheckCircle2 size={9} /> exists</span>}
                          {status === 'error' && <AlertCircle size={10} className="text-status-critical flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  onClick={handleDeployAllAgents}
                  disabled={deployingAll || !configured}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-accent-cyan text-[11px] font-semibold hover:bg-accent-bright disabled:opacity-40 transition-colors"
                  style={{ color: '#0B0F14' }}
                >
                  {deployingAll ? <><Loader2 size={11} className="animate-spin" /> Deploying pipeline...</> : <><Zap size={11} /> Deploy All 5 Agents</>}
                </button>
              </div>

              <div className="border-t border-white/[0.06] pt-2">
                <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider mb-2">Individual Deploy</p>
              </div>

              <div className="p-3 rounded-lg border border-white/[0.08] bg-white/[0.02] space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-accent-dim flex items-center justify-center"><Bot size={11} className="text-accent-bright" /></div>
                  <div>
                    <div className="text-xs font-semibold text-text-primary">SENTINEL Incident Responder</div>
                    <div className="text-[10px] text-text-muted">Single all-in-one incident analysis agent</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['search', 'execute_esql', 'list_indices', 'get_document_by_id'].map(t => (
                    <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-accent-dim text-accent-bright font-mono">{t}</span>
                  ))}
                </div>
                <button onClick={handleDeploySentinelAgent} disabled={deployingAgent || !configured}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-semibold bg-accent-dim text-accent-bright border border-accent-cyan/30 hover:bg-accent-cyan/20 disabled:opacity-40 transition-colors">
                  {deployingAgent ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                  {deployingAgent ? 'Deploying...' : 'Deploy to Agent Builder'}
                </button>
              </div>
              <div className="p-3 rounded-lg border border-white/[0.08] bg-white/[0.02] space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-white/[0.06] flex items-center justify-center"><Code2 size={11} className="text-text-muted" /></div>
                  <div>
                    <div className="text-xs font-semibold text-text-primary">Connection Pool Analyzer</div>
                    <div className="text-[10px] text-text-muted">ES|QL tool for DB saturation detection</div>
                  </div>
                </div>
                <CodeBlock code={`FROM metrics-db.*\n| STATS avg_wait = AVG(db.connection.wait_ms)\n  BY db.shard.id, BUCKET(@timestamp, 5m)\n| WHERE avg_wait > ?threshold`} language="esql" maxHeight="80px" />
                <button onClick={handleDeploySentinelTool} disabled={deployingTool || !configured}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-semibold bg-white/[0.04] text-text-secondary border border-white/[0.08] hover:bg-white/[0.08] disabled:opacity-40 transition-colors">
                  {deployingTool ? <Loader2 size={10} className="animate-spin" /> : <Settings size={10} />}
                  {deployingTool ? 'Deploying...' : 'Deploy Tool'}
                </button>
              </div>
              {tools.filter(t => !t.readonly).length > 0 && (
                <div>
                  <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-1.5">Custom Tools ({tools.filter(t => !t.readonly).length})</div>
                  <div className="space-y-1">
                    {tools.filter(t => !t.readonly).map(tool => (
                      <div key={tool.id} className="flex items-center gap-2 p-2 rounded border border-white/[0.06] bg-white/[0.01]">
                        <Code2 size={10} className="text-text-muted flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-mono text-text-primary truncate">{tool.id}</div>
                          <div className="text-[9px] text-text-muted">{tool.type}</div>
                        </div>
                        <button onClick={async () => {
                          try { await deleteTool(tool.id); setTools(ts => ts.filter(t => t.id !== tool.id)); }
                          catch (e) { setError(e instanceof Error ? e.message : 'Delete failed'); }
                        }} className="p-1 rounded text-text-muted hover:text-status-critical hover:bg-status-critical/10 transition-colors flex-shrink-0">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Tool Creator tab */}
          {tab === 'ai-tool' && (
            <AiToolCreator
              agents={agents}
              configured={configured}
              onDeploy={handleDeployAiTool}
              deploying={deployingTool}
            />
          )}
        </div>
      </div>

      {/* ── Resize handle ── */}
      <div onMouseDown={startResize}
        className="w-1 flex-shrink-0 cursor-col-resize hover:bg-accent-cyan/30 active:bg-accent-cyan/50 transition-colors group relative">
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {selectedAgent ? (
          <>
            {/* Chat header */}
            <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-3 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: selectedAgent.avatar_color + '22', color: selectedAgent.avatar_color }}>
                {selectedAgent.avatar_symbol}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-text-primary truncate">{selectedAgent.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="ok">live</Badge>
                  <span className="text-[10px] text-text-muted">Elastic Agent Builder</span>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                <ModelSelector connectors={connectors} selected={selectedConnectorId} onChange={setSelectedConnectorId} />
                {/* Panel toggle: Chat / History */}
                <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
                  {(['chat', 'history'] as RightPanel[]).map(p => (
                    <button key={p} onClick={() => setRightPanel(p)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                        rightPanel === p ? 'bg-accent-dim text-accent-bright' : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.04]'
                      }`}>
                      {p === 'chat' ? <MessageSquare size={9} /> : <Clock size={9} />}
                      {p === 'chat' ? 'Chat' : 'History'}
                      {p === 'history' && conversations.length > 0 && (
                        <span className="ml-0.5 text-[8px] bg-white/[0.10] px-1 rounded-full">{conversations.length}</span>
                      )}
                    </button>
                  ))}
                </div>
                {rightPanel === 'chat' && messages.length > 0 && (
                  <button onClick={() => { setMessages([]); setConversationId(undefined); }}
                    className="px-2 py-1 rounded text-[10px] text-text-muted hover:text-text-secondary hover:bg-white/[0.06] border border-white/[0.06] transition-colors whitespace-nowrap">
                    New chat
                  </button>
                )}
              </div>
            </div>

            {/* Chat panel */}
            {rightPanel === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {loadingHistory && (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <Loader2 size={18} className="text-accent-cyan animate-spin" />
                      <p className="text-xs text-text-muted">Loading conversation...</p>
                    </div>
                  )}
                  {!loadingHistory && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold mb-4"
                        style={{ backgroundColor: selectedAgent.avatar_color + '22', color: selectedAgent.avatar_color }}>
                        {selectedAgent.avatar_symbol}
                      </div>
                      <p className="text-sm font-medium text-text-primary mb-1">{selectedAgent.name}</p>
                      <p className="text-xs text-text-muted max-w-xs leading-relaxed">{selectedAgent.description}</p>
                      <div className="mt-4 space-y-2 w-full max-w-sm">
                        {[
                          'Analyze the current DB connection pool incident',
                          'What services are affected by INC-001?',
                          'Run a slow query analysis on shard-03',
                        ].map(suggestion => (
                          <button key={suggestion} onClick={() => setInput(suggestion)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.06] hover:border-accent-cyan/30 hover:bg-accent-dim text-xs text-text-secondary hover:text-accent-bright transition-all w-full text-left">
                            <ChevronRight size={10} className="flex-shrink-0" />
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="max-w-4xl mx-auto space-y-4">
                    {!loadingHistory && messages.map((msg, i) => (
                      <ChatBubble key={i} msg={msg}
                        isStreaming={streaming && i === messages.length - 1 && msg.role === 'assistant'} />
                    ))}
                  </div>
                  <div ref={chatEndRef} />
                </div>

                {/* Input area */}
                <div className="p-4 border-t border-white/[0.06] flex-shrink-0">
                  <div className="max-w-2xl mx-auto space-y-2">
                    {/* Pending attachments */}
                    {pendingAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {pendingAttachments.map((att, i) => (
                          <AttachmentPill key={i} name={att.name}
                            onRemove={() => setPendingAttachments(a => a.filter((_, j) => j !== i))} />
                        ))}
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      {/* Attachment button */}
                      <div ref={attachMenuRef} className="relative flex-shrink-0">
                        <button onClick={() => setShowAttachMenu(o => !o)}
                          className={`w-[38px] h-[38px] rounded-lg border transition-colors flex items-center justify-center ${
                            showAttachMenu ? 'bg-accent-dim border-accent-cyan/30 text-accent-bright' : 'bg-white/[0.04] border-white/[0.08] text-text-muted hover:text-text-secondary hover:bg-white/[0.06]'
                          }`} title="Add attachment">
                          <Paperclip size={13} />
                        </button>
                        {showAttachMenu && (
                          <div className="absolute bottom-full mb-2 left-0 w-52 bg-[#0F1520] border border-white/[0.10] rounded-xl shadow-2xl z-50 overflow-hidden">
                            <div className="px-3 py-2 border-b border-white/[0.06]">
                              <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">Add Context</span>
                            </div>
                            <div className="py-1">
                              {[
                                { label: 'Screen context', type: 'screen_context' as const, data: { url: window.location.href, app: 'sentinel' } },
                                { label: 'Incident data (JSON)', type: 'json' as const, data: { source: 'sentinel', timestamp: new Date().toISOString() } },
                                { label: 'Custom text note', type: 'text' as const, data: 'Additional context from SENTINEL dashboard' },
                              ].map(opt => (
                                <button key={opt.label} onClick={() => addContextAttachment(opt.type, opt.label, opt.data)}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] transition-colors text-left">
                                  <Paperclip size={9} className="text-text-muted flex-shrink-0" />
                                  <span className="text-xs text-text-secondary">{opt.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <textarea value={input} onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="Message, query, or paste code..."
                        rows={1}
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/40 transition-colors resize-none font-mono leading-relaxed"
                        style={{ minHeight: '38px', maxHeight: '120px', height: Math.min(Math.max(38, (input.split('\n').length) * 18 + 16), 120) + 'px' }}
                      />
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        {streaming ? (
                          <button onClick={handleStop}
                            className="w-[38px] h-[38px] rounded-lg bg-white/[0.06] border border-white/[0.10] hover:bg-status-critical/20 hover:border-status-critical/40 transition-colors flex items-center justify-center text-text-muted hover:text-status-critical"
                            title="Stop generation">
                            <Square size={13} />
                          </button>
                        ) : (
                          <button onClick={handleSend} disabled={!input.trim()}
                            className="w-[38px] h-[38px] rounded-lg bg-accent-cyan hover:bg-accent-bright disabled:opacity-40 transition-colors flex items-center justify-center"
                            style={{ color: '#0B0F14' }}
                            title="Send message">
                            <Send size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-text-muted">
                      Powered by Elastic Agent Builder · reasoning steps replay in Mission Control
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* History panel */}
            {rightPanel === 'history' && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-2xl mx-auto space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary">Conversation History</span>
                    <button onClick={() => loadConversations(selectedAgent.id)}
                      className="p-1 rounded text-text-muted hover:text-accent-bright hover:bg-accent-dim transition-colors">
                      <RefreshCw size={10} />
                    </button>
                  </div>
                  {conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <MessageSquare size={24} className="text-text-muted mb-3" />
                      <p className="text-sm text-text-muted">No conversations yet</p>
                      <p className="text-xs text-text-muted mt-1">Start a chat to create your first conversation</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {conversations.map(conv => (
                        <ConversationItem key={conv.id} conv={conv}
                          isActive={conv.id === conversationId}
                          onClick={() => handleLoadConversation(conv.id)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-14 h-14 rounded-2xl bg-accent-dim border border-accent-cyan/20 flex items-center justify-center mb-4">
              <Bot size={24} className="text-accent-bright" />
            </div>
            <p className="text-sm font-semibold text-text-primary mb-2">Elastic Agent Builder</p>
            <p className="text-xs text-text-muted max-w-sm leading-relaxed mb-6">
              Create and chat with AI agents connected to your Elasticsearch data.
            </p>
            {!configured && (
              <div className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 max-w-sm text-left space-y-1">
                <p className="font-semibold">To enable live Agent Builder:</p>
                <p className="font-mono">VITE_KIBANA_URL=https://your.kb.elastic.cloud</p>
                <p className="font-mono">VITE_KIBANA_API_KEY=your_api_key</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
