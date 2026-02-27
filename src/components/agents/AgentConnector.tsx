import type { AgentRole } from '../../types/agent.types';

export function AgentConnectors({
  connections,
  activeHandoff,
}: {
  connections: Array<{ from: AgentRole; to: AgentRole; x1: number; y1: number; x2: number; y2: number }>;
  activeHandoff: { from: AgentRole; to: AgentRole } | null;
  svgWidth: number;
  svgHeight: number;
}) {
  return (
    <>
      {connections.map(({ from, to, x1, y1, x2, y2 }) => {
        const isActive = activeHandoff?.from === from && activeHandoff?.to === to;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len;
        const ny = dx / len;
        const cpX = midX + nx * 20;
        const cpY = midY + ny * 20;
        const pathD = `M ${x1},${y1} Q ${cpX},${cpY} ${x2},${y2}`;

        return (
          <g key={`${from}-${to}`}>
            <path
              d={pathD}
              fill="none"
              stroke={isActive ? '#06B6D4' : 'rgba(255,255,255,0.08)'}
              strokeWidth={isActive ? 1.5 : 1}
              strokeDasharray="5,4"
              style={isActive ? { animation: 'flow-dash 0.8s linear infinite' } : undefined}
              strokeLinecap="round"
            />
            <defs>
              <marker id={`arrow-${from}-${to}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <path d="M 0,0 L 6,3 L 0,6 Z" fill={isActive ? '#06B6D4' : 'rgba(255,255,255,0.15)'} />
              </marker>
            </defs>
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth="1"
              markerEnd={`url(#arrow-${from}-${to})`}
            />
          </g>
        );
      })}
    </>
  );
}
