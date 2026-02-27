import React from 'react';
import { TrendingDown, Clock, MousePointerClick, AlertTriangle, TrendingUp, Zap, CheckCircle } from 'lucide-react';
import type { ImpactMetric } from '../../types/metrics.types';
import { CountUp } from '../ui/CountUp';

const ICON_MAP: Record<string, React.ElementType> = {
  Clock,
  MousePointerClick,
  AlertTriangle,
  TrendingUp,
  Zap,
  CheckCircle,
};

interface ImpactKPICardProps {
  metric: ImpactMetric;
  animate?: boolean;
  className?: string;
}

export function ImpactKPICard({ metric, animate = true, className = '' }: ImpactKPICardProps) {
  const Icon = ICON_MAP[metric.icon] ?? TrendingDown;
  const decimals = metric.after < 10 && metric.after !== Math.floor(metric.after) ? 1 : 0;

  const formatBefore = (v: number) => {
    if (metric.unit === '$') return `$${(v / 1000).toFixed(0)}K`;
    if (metric.unit === '%') return `${v.toFixed(1)}%`;
    return `${v.toFixed(decimals)} ${metric.unit}`;
  };

  const formatAfter = (v: number) => {
    if (metric.unit === '$') return v;
    return v;
  };

  return (
    <div className={`sentinel-card p-5 flex flex-col gap-3 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-text-muted font-medium">{metric.label}</p>
          <p className="text-[10px] text-text-muted mt-0.5">{metric.description}</p>
        </div>
        <div className="p-2 rounded-lg bg-accent-dim">
          <Icon size={14} className="text-accent-bright" />
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] text-text-muted mb-0.5">Before</span>
          <span className="text-sm font-mono text-text-muted line-through">{formatBefore(metric.before)}</span>
        </div>
        <div className="flex-1 flex flex-col items-end">
          <span className="text-[10px] text-status-ok mb-0.5">After SENTINEL</span>
          <div className="text-2xl font-bold font-mono text-text-primary">
            {metric.unit === '$' ? '$' : ''}
            <CountUp
              to={formatAfter(metric.after) as number}
              durationMs={1600}
              decimals={metric.after < 10 && metric.after !== Math.floor(metric.after) ? 1 : metric.unit === '$' ? 0 : 0}
              trigger={animate}
            />
            {metric.unit !== '$' ? <span className="text-sm font-normal text-text-muted ml-1">{metric.unit}</span> : null}
            {metric.unit === '$' ? <span className="text-sm font-normal text-text-muted ml-1">K saved</span> : null}
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <TrendingDown size={11} className="text-status-ok" />
          <span className="text-xs font-semibold text-status-ok">{metric.improvement}</span>
        </div>
      </div>
    </div>
  );
}
