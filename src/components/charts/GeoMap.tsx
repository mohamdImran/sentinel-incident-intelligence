import { useState } from 'react';
import type { GeoNode } from '../../types/incident.types';

const STATUS_COLORS = {
  healthy: '#10B981',
  degraded: '#F59E0B',
  down: '#EF4444',
};

function geoToSVG(lat: number, lon: number, w: number, h: number): [number, number] {
  const x = ((lon + 180) / 360) * w;
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = (h / 2) - (w * mercN) / (2 * Math.PI);
  return [x, y];
}

const WORLD_SIMPLIFIED = [
  { d: 'M 155 45 L 175 40 L 185 38 L 195 40 L 200 45 L 200 55 L 195 65 L 185 70 L 175 72 L 165 70 L 158 65 L 153 58 Z', id: 'namerica' },
  { d: 'M 165 72 L 172 70 L 180 72 L 182 80 L 178 88 L 172 92 L 166 88 L 162 80 Z', id: 'samerica' },
  { d: 'M 220 42 L 230 38 L 240 36 L 248 38 L 252 44 L 252 52 L 248 60 L 238 64 L 228 65 L 220 62 L 215 55 L 215 48 Z', id: 'europe' },
  { d: 'M 222 65 L 235 62 L 248 60 L 260 58 L 268 60 L 272 68 L 270 78 L 262 84 L 248 86 L 235 84 L 224 78 L 220 70 Z', id: 'africa' },
  { d: 'M 262 38 L 272 33 L 285 30 L 300 32 L 312 38 L 316 46 L 314 56 L 305 64 L 290 68 L 275 67 L 265 60 L 260 50 Z', id: 'asia' },
  { d: 'M 320 60 L 330 58 L 338 60 L 340 68 L 336 76 L 326 78 L 318 72 L 316 65 Z', id: 'australia' },
];

interface GeoMapProps {
  nodes: GeoNode[];
  width?: number;
  height?: number;
  className?: string;
}

export function GeoMap({ nodes, width = 400, height = 220, className = '' }: GeoMapProps) {
  const [hoveredNode, setHoveredNode] = useState<GeoNode | null>(null);

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        style={{ height }}
      >
        <rect width={width} height={height} fill="#0B0F14" rx="6" />

        {WORLD_SIMPLIFIED.map(({ d, id }) => (
          <path
            key={id}
            d={d}
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.5"
          />
        ))}

        {Array.from({ length: 8 }).map((_, i) => (
          <line
            key={`lat-${i}`}
            x1={0} y1={height * (i / 8)}
            x2={width} y2={height * (i / 8)}
            stroke="rgba(255,255,255,0.02)"
            strokeWidth="0.5"
          />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={`lon-${i}`}
            x1={width * (i / 12)} y1={0}
            x2={width * (i / 12)} y2={height}
            stroke="rgba(255,255,255,0.02)"
            strokeWidth="0.5"
          />
        ))}

        {nodes.map(node => {
          const [svgX, svgY] = geoToSVG(node.lat, node.lon, width, height);
          const color = STATUS_COLORS[node.status];
          const isDown = node.status === 'down';
          const isDegraded = node.status === 'degraded';
          const r = 4 + Math.min(node.activeConnections / 50, 4);
          const isHovered = hoveredNode?.id === node.id;

          return (
            <g key={node.id} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}>
              {(isDown || isDegraded) && (
                <circle
                  cx={svgX}
                  cy={svgY}
                  r={r * 2.5}
                  fill={color}
                  opacity={0}
                  style={{ animation: 'node-pulse-ring 2s ease-out infinite' }}
                />
              )}

              <circle
                cx={svgX}
                cy={svgY}
                r={isHovered ? r * 1.5 : r}
                fill={color}
                opacity={0.85}
                style={{ transition: 'r 0.15s ease', filter: `drop-shadow(0 0 ${r}px ${color}80)` }}
              />

              {isHovered && (
                <circle cx={svgX} cy={svgY} r={r + 3} fill="none" stroke={color} strokeWidth="1" opacity="0.5" />
              )}
            </g>
          );
        })}
      </svg>

      {hoveredNode && (
        <div className="absolute pointer-events-none bg-overlay/95 border border-white/10 rounded-lg p-3 shadow-xl z-20 min-w-[180px]"
          style={{ top: '10px', right: '10px' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[hoveredNode.status] }} />
            <span className="text-xs font-semibold text-text-primary">{hoveredNode.displayName}</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-text-muted">Region</span>
              <span className="font-mono text-text-secondary">{hoveredNode.region}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-text-muted">Error Rate</span>
              <span className={`font-mono ${hoveredNode.errorRate > 0.1 ? 'text-status-critical' : 'text-status-ok'}`}>
                {(hoveredNode.errorRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-text-muted">P99 Latency</span>
              <span className={`font-mono ${hoveredNode.latencyP99 > 1000 ? 'text-status-critical' : 'text-text-secondary'}`}>
                {hoveredNode.latencyP99 >= 1000 ? `${(hoveredNode.latencyP99 / 1000).toFixed(1)}s` : `${hoveredNode.latencyP99}ms`}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-text-muted">Connections</span>
              <span className="font-mono text-text-secondary">{hoveredNode.activeConnections}</span>
            </div>
          </div>
          {hoveredNode.status !== 'healthy' && (
            <div className="mt-2 pt-2 border-t border-white/[0.06] text-[10px] text-status-warning">
              Affected by incident {hoveredNode.affectedByIncidentId}
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-2 left-2 flex items-center gap-3">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-text-muted capitalize">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
