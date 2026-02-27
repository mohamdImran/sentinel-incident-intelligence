
type DotStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'complete' | 'error' | 'ok' | 'warning' | 'critical';

const DOT_COLORS: Record<DotStatus, string> = {
  idle: 'bg-white/20',
  thinking: 'bg-accent-cyan',
  executing: 'bg-accent-cyan',
  waiting: 'bg-status-warning',
  complete: 'bg-status-ok',
  error: 'bg-status-critical',
  ok: 'bg-status-ok',
  warning: 'bg-status-warning',
  critical: 'bg-status-critical',
};

const PULSE_STATUSES: DotStatus[] = ['thinking', 'executing', 'warning', 'critical'];

interface GlowDotProps {
  status: DotStatus;
  size?: number;
  className?: string;
}

export function GlowDot({ status, size = 8, className = '' }: GlowDotProps) {
  const shouldPulse = PULSE_STATUSES.includes(status);
  const colorClass = DOT_COLORS[status] ?? 'bg-white/20';

  return (
    <span className={`relative inline-flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}>
      {shouldPulse && (
        <span
          className={`absolute rounded-full opacity-75 animate-ping ${colorClass}`}
          style={{ width: size, height: size }}
        />
      )}
      <span
        className={`relative rounded-full ${colorClass}`}
        style={{ width: size, height: size }}
      />
    </span>
  );
}
