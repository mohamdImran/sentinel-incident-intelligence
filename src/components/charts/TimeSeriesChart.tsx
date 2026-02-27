import React, { useState, useRef, useCallback } from 'react';
import type { TimeSeries } from '../../types/metrics.types';

interface TimeSeriesChartProps {
  series: TimeSeries;
  height?: number;
  showAnomaly?: boolean;
  color?: string;
  anomalyColor?: string;
  className?: string;
}

function formatValue(v: number, unit: string): string {
  if (unit === 'ms' && v >= 1000) return `${(v / 1000).toFixed(1)}s`;
  if (unit === '%') return `${v.toFixed(1)}%`;
  if (unit === 'conn') return v.toFixed(0);
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toFixed(1);
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function TimeSeriesChart({ series, height = 120, showAnomaly = true, color = '#06B6D4', anomalyColor = '#EF4444', className = '' }: TimeSeriesChartProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: number; ts: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const points = series.dataPoints.slice(-60);
  if (points.length < 2) return null;

  const values = points.map(p => p.value);
  const min = Math.min(...values) * 0.9;
  const max = Math.max(...values) * 1.05;
  const range = max - min || 1;

  const W = 100;
  const H = 100;
  const pxL = 0;
  const pxR = W;
  const pyT = 4;
  const pyB = H - 4;
  const drawH = pyB - pyT;
  const drawW = pxR - pxL;

  const toX = (i: number) => pxL + (i / (points.length - 1)) * drawW;
  const toY = (v: number) => pyT + drawH - ((v - min) / range) * drawH;

  const linePts = points.map((p, i) => `${toX(i).toFixed(2)},${toY(p.value).toFixed(2)}`);
  const linePath = `M ${linePts.join(' L ')}`;

  const firstPt = linePts[0].split(',');
  const lastPt = linePts[linePts.length - 1].split(',');
  const areaPath = `M ${firstPt[0]},${pyB} L ${linePts.join(' L ')} L ${lastPt[0]},${pyB} Z`;

  const anomalyIndices: number[] = [];
  let anomalyStart = -1;
  let anomalyEnd = -1;
  points.forEach((p, i) => {
    if (p.isAnomaly) {
      if (anomalyStart === -1) anomalyStart = i;
      anomalyEnd = i;
      anomalyIndices.push(i);
    }
  });

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(relX * (points.length - 1));
    const clampedIdx = Math.max(0, Math.min(points.length - 1, idx));
    const pt = points[clampedIdx];
    if (pt) {
      setTooltip({ x: relX * 100, y: toY(pt.value), value: pt.value, ts: pt.timestamp });
    }
  }, [points, toY]);

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id={`grad-${series.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
          <clipPath id={`clip-${series.id}`}>
            <rect x={pxL} y={pyT} width={drawW} height={drawH} />
          </clipPath>
        </defs>

        {[0.25, 0.5, 0.75].map(pct => (
          <line
            key={pct}
            x1={pxL} y1={pyT + drawH * pct}
            x2={pxR} y2={pyT + drawH * pct}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="0.5"
          />
        ))}

        {showAnomaly && anomalyStart !== -1 && (
          <rect
            x={toX(anomalyStart)}
            y={pyT}
            width={Math.max(1, toX(anomalyEnd) - toX(anomalyStart))}
            height={drawH}
            fill={anomalyColor}
            fillOpacity={0.08}
            clipPath={`url(#clip-${series.id})`}
          />
        )}

        <path
          d={areaPath}
          fill={`url(#grad-${series.id})`}
          clipPath={`url(#clip-${series.id})`}
        />

        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath={`url(#clip-${series.id})`}
        />

        {showAnomaly && anomalyIndices.slice(0, 5).map(i => (
          <circle
            key={i}
            cx={toX(i)}
            cy={toY(points[i].value)}
            r="1.5"
            fill={anomalyColor}
            opacity="0.9"
          />
        ))}

        {tooltip && (
          <>
            <line
              x1={tooltip.x} y1={pyT}
              x2={tooltip.x} y2={pyB}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
            <circle cx={tooltip.x} cy={tooltip.y} r="2" fill={color} />
          </>
        )}
      </svg>

      {tooltip && (
        <div
          className="absolute pointer-events-none bg-overlay border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-text-primary shadow-lg z-10 whitespace-nowrap"
          style={{
            left: `${Math.min(tooltip.x, 70)}%`,
            top: `${Math.max(5, tooltip.y - 15)}%`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="text-text-accent font-semibold">{formatValue(tooltip.value, series.unit)} {series.unit}</div>
          <div className="text-text-muted">{formatTime(tooltip.ts)}</div>
        </div>
      )}
    </div>
  );
}
