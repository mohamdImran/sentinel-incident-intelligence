import React from 'react';
import { TrendingDown, Award, ArrowRight, BarChart2, CheckCircle2, Zap } from 'lucide-react';
import { ImpactKPICard } from '../components/metrics/ImpactKPICard';
import { DEMO_IMPACT_METRICS, DEMO_INCIDENT_HISTORY } from '../data/demo-impact-metrics';
import { Badge } from '../components/ui/Badge';
import { DEMO_CONFIG } from '../config/demo.config';
import { useLiveRunner } from '../store/LiveRunnerContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function WaterfallBar({ label, beforeMin, afterMin }: { label: string; beforeMin: number; afterMin: number }) {
  const maxVal = 80;
  const beforePct = Math.min(100, (beforeMin / maxVal) * 100);
  const afterPct = Math.min(100, (afterMin / maxVal) * 100);
  const reduction = Math.round(((beforeMin - afterMin) / beforeMin) * 100);

  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-text-muted w-48 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 flex flex-col gap-1">
        <div className="relative h-2.5 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-status-critical/60 rounded-full transition-all duration-700"
            style={{ width: `${beforePct}%` }}
          />
        </div>
        <div className="relative h-2.5 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-status-ok/70 rounded-full transition-all duration-700"
            style={{ width: `${afterPct}%` }}
          />
        </div>
      </div>
      <div className="text-right w-20 flex-shrink-0">
        <div className="text-[10px] text-text-muted font-mono">{beforeMin}m → {afterMin.toFixed(1)}m</div>
        <div className="text-[10px] font-semibold text-status-ok">↓ {reduction}%</div>
      </div>
    </div>
  );
}

export function ImpactPage() {
  const { status, incident, completedFindings, run } = useLiveRunner();

  if (!DEMO_CONFIG.DEMO_MODE) {
    const isComplete = status === 'complete';
    const isRunning = status === 'running' || status === 'detecting';

    return (
      <div className="h-full overflow-y-auto p-5 space-y-4">
        {/* Header KPIs — always show the pipeline flow */}
        <div className="sentinel-card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Live Pipeline Impact</h2>
              <p className="text-xs text-text-muted mt-1">
                {isComplete ? 'Pipeline complete — all 5 agents finished analysis'
                  : isRunning ? 'Pipeline running — agents are analyzing your cluster...'
                  : 'Run the pipeline from the Agent Workbench to see live impact metrics'}
              </p>
            </div>
            {isComplete && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-status-ok/15 border border-status-ok/30">
                <CheckCircle2 size={12} className="text-status-ok" />
                <span className="text-xs font-semibold text-status-ok">Analysis Complete</span>
              </div>
            )}
          </div>

          {/* Pipeline step flow */}
          <div className="flex items-start gap-0">
            {[
              { step: '01', title: 'Planner', desc: 'Decomposes incident into investigation tasks' },
              { step: '02', title: 'Investigator', desc: 'Runs ES|QL queries to find root cause' },
              { step: '03', title: 'Correlator', desc: 'Maps blast radius across indices' },
              { step: '04', title: 'Remediator', desc: 'Generates prioritized remediation steps' },
              { step: '05', title: 'Verifier', desc: 'Validates resolution and closes incident' },
            ].map((s, i) => (
              <React.Fragment key={s.step}>
                <div className="flex flex-col items-center text-center flex-1">
                  <div className={`w-9 h-9 rounded-full border flex items-center justify-center mb-2 transition-colors ${
                    isComplete ? 'bg-status-ok/15 border-status-ok/40' : 'bg-accent-dim border-accent-cyan/30'
                  }`}>
                    {isComplete
                      ? <CheckCircle2 size={14} className="text-status-ok" />
                      : <span className="text-[10px] font-bold text-accent-bright">{s.step}</span>
                    }
                  </div>
                  <div className="text-[10px] font-semibold text-text-primary mb-0.5">{s.title}</div>
                  <div className="text-[9px] text-text-muted leading-relaxed">{s.desc}</div>
                </div>
                {i < 4 && (
                  <div className="flex items-center justify-center pt-3 mx-0.5">
                    <ArrowRight size={12} className="text-text-muted flex-shrink-0" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Incident card */}
        {incident && (
          <div className="sentinel-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase ${
                incident.severity === 'critical' ? 'bg-status-critical/15 text-status-critical' :
                incident.severity === 'high' ? 'bg-orange-500/15 text-orange-400' :
                'bg-amber-500/15 text-amber-400'
              }`}>{incident.severity}</span>
              <span className="text-[10px] text-text-muted font-mono">{new Date(incident.detectedAt).toLocaleString()}</span>
            </div>
            <p className="text-xs font-semibold text-text-primary">{incident.title}</p>
            <p className="text-[11px] text-text-muted leading-relaxed">{incident.description}</p>
            <div className="flex flex-wrap gap-1 pt-1">
              {incident.indices.map((idx, i) => (
                <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-text-muted">{idx}</span>
              ))}
            </div>
          </div>
        )}

        {/* Agent findings */}
        {completedFindings && (
          <div className="sentinel-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={12} className="text-accent-cyan" />
              <span className="text-xs font-semibold text-text-primary">Agent Findings</span>
            </div>
            <div className="prose prose-invert prose-xs max-w-none
              prose-p:text-text-secondary prose-p:text-[11px] prose-p:leading-relaxed prose-p:my-1
              prose-headings:text-text-primary prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
              prose-h2:text-xs prose-h3:text-[11px]
              prose-strong:text-text-primary prose-strong:font-semibold
              prose-code:text-accent-bright prose-code:bg-accent-dim prose-code:px-1 prose-code:rounded prose-code:text-[10px] prose-code:before:content-none prose-code:after:content-none
              prose-ul:text-[11px] prose-ul:my-1 prose-ul:pl-4
              prose-ol:text-[11px] prose-ol:my-1 prose-ol:pl-4
              prose-li:text-text-secondary prose-li:my-0
              [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{completedFindings}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Not yet run */}
        {!incident && !isRunning && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart2 size={28} className="text-text-muted mb-3" />
            <p className="text-sm font-semibold text-text-primary mb-2">No pipeline run yet</p>
            <p className="text-xs text-text-muted max-w-xs leading-relaxed mb-4">
              Go to Agent Workbench and click "Run Live Pipeline" to start the 5-agent analysis.
            </p>
            <button onClick={run}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-dim border border-accent-cyan/30 text-xs font-semibold text-accent-bright hover:bg-accent-cyan/20 transition-colors">
              <Zap size={11} /> Run Pipeline Now
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5 space-y-6">
      <div className="sentinel-card p-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Measured Impact</h2>
            <p className="text-xs text-text-muted mt-1">
              Results from 6 autonomous investigations · Feb 2026
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-status-ok/15 border border-status-ok/30">
            <Award size={13} className="text-status-ok" />
            <span className="text-xs font-semibold text-status-ok">95.1% avg MTTR reduction</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {DEMO_IMPACT_METRICS.map(metric => (
          <ImpactKPICard key={metric.id} metric={metric} animate />
        ))}
      </div>

      <div className="sentinel-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown size={14} className="text-status-ok" />
          <h3 className="text-xs font-semibold text-text-primary">MTTR Comparison by Incident</h3>
          <div className="ml-auto flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-status-critical/60 inline-block" /> Manual</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-status-ok/70 inline-block" /> SENTINEL</span>
          </div>
        </div>
        <div className="space-y-3">
          {DEMO_INCIDENT_HISTORY.map(inc => (
            <WaterfallBar
              key={inc.id}
              label={inc.title}
              beforeMin={inc.mttrBefore}
              afterMin={inc.mttrAfter}
            />
          ))}
        </div>
      </div>

      <div className="sentinel-card p-5">
        <h3 className="text-xs font-semibold text-text-primary mb-4">Incident Resolution History</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] text-text-muted uppercase tracking-wider border-b border-white/[0.06]">
                <th className="text-left px-0 py-2 font-semibold pr-4">Incident</th>
                <th className="text-left px-3 py-2 font-semibold">Date</th>
                <th className="text-left px-3 py-2 font-semibold">Severity</th>
                <th className="text-right px-3 py-2 font-semibold">MTTR Before</th>
                <th className="text-right px-3 py-2 font-semibold">MTTR After</th>
                <th className="text-right px-3 py-2 font-semibold">Improvement</th>
                <th className="text-left px-3 py-2 font-semibold">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_INCIDENT_HISTORY.map(inc => {
                const improvement = Math.round(((inc.mttrBefore - inc.mttrAfter) / inc.mttrBefore) * 100);
                return (
                  <tr key={inc.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-4 text-xs text-text-secondary">{inc.title}</td>
                    <td className="px-3 py-2.5 text-[11px] font-mono text-text-muted">{inc.date}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={inc.severity as any}>{inc.severity}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[11px] font-mono text-text-muted">{inc.mttrBefore}m</td>
                    <td className="px-3 py-2.5 text-right text-[11px] font-mono text-status-ok">{inc.mttrAfter.toFixed(1)}m</td>
                    <td className="px-3 py-2.5 text-right text-[11px] font-semibold text-status-ok">↓ {improvement}%</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="ok">Auto-Resolved</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sentinel-card p-5">
        <h3 className="text-xs font-semibold text-text-primary mb-5">How SENTINEL Works</h3>
        <div className="flex items-start gap-0">
          {[
            { step: '01', title: 'Elastic ML Detects', desc: 'Anomaly scoring on metrics and log streams in real-time' },
            { step: '02', title: 'Planner Decomposes', desc: 'Multi-step investigation strategy via Agent Builder reasoning' },
            { step: '03', title: 'Agents Investigate', desc: 'ES|QL queries + semantic search across Elasticsearch indexes' },
            { step: '04', title: 'Workflow Remediates', desc: 'Elastic Workflows execute fixes autonomously with rollback' },
            { step: '05', title: 'Verifier Validates', desc: 'Post-fix metric monitoring confirms resolution and closes loop' },
          ].map((step, i) => (
            <React.Fragment key={step.step}>
              <div className="flex flex-col items-center text-center flex-1">
                <div className="w-10 h-10 rounded-full bg-accent-dim border border-accent-cyan/30 flex items-center justify-center mb-3">
                  <span className="text-xs font-bold text-accent-bright">{step.step}</span>
                </div>
                <div className="text-xs font-semibold text-text-primary mb-1">{step.title}</div>
                <div className="text-[10px] text-text-muted leading-relaxed">{step.desc}</div>
              </div>
              {i < 4 && (
                <div className="flex items-center justify-center pt-4 mx-1">
                  <ArrowRight size={14} className="text-text-muted flex-shrink-0" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
