import { Clock, Zap } from 'lucide-react';
import type { Incident } from '../../types/incident.types';
import { Badge } from '../ui/Badge';
import { GlowDot } from '../ui/GlowDot';

const SEVERITY_VARIANT = { critical: 'critical', high: 'high', medium: 'medium', low: 'low' } as const;

const STATUS_LABEL: Record<Incident['status'], string> = {
  open: 'Open',
  investigating: 'Investigating',
  remediating: 'Remediating',
  resolved: 'Resolved',
  auto_resolved: 'Auto-Resolved',
};

const STATUS_DOT: Record<Incident['status'], string> = {
  open: 'critical',
  investigating: 'thinking',
  remediating: 'thinking',
  resolved: 'complete',
  auto_resolved: 'ok',
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

interface IncidentCardProps {
  incident: Incident;
  isSelected?: boolean;
  onClick?: () => void;
}

export function IncidentCard({ incident, isSelected, onClick }: IncidentCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all duration-150 group ${
        isSelected
          ? 'bg-accent-dim border-accent-cyan/40 shadow-glow-cyan'
          : 'bg-elevated border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]'
      }`}
    >
      <div className="flex items-start gap-3">
        <GlowDot status={STATUS_DOT[incident.status] as any} size={7} className="mt-1" />

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 justify-between">
            <p className={`text-xs font-medium leading-snug line-clamp-2 ${isSelected ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'} transition-colors`}>
              {incident.title}
            </p>
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant={SEVERITY_VARIANT[incident.severity]}>
              {incident.severity}
            </Badge>
            <span className={`text-[10px] font-medium ${
              incident.status === 'investigating' || incident.status === 'remediating'
                ? 'text-accent-cyan'
                : incident.status === 'auto_resolved' || incident.status === 'resolved'
                ? 'text-status-ok'
                : 'text-status-critical'
            }`}>
              {STATUS_LABEL[incident.status]}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-1 text-[10px] text-text-muted">
              <Clock size={9} />
              {timeAgo(incident.createdAt)}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-text-muted">
              <Zap size={9} />
              {incident.affectedServices.length} services
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
