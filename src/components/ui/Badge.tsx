import React from 'react';

type BadgeVariant = 'critical' | 'high' | 'medium' | 'low' | 'ok' | 'info' | 'default';

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  critical: 'bg-status-critical/15 text-status-critical border border-status-critical/30',
  high: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  medium: 'bg-status-warning/15 text-status-warning border border-status-warning/30',
  low: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  ok: 'bg-status-ok/15 text-status-ok border border-status-ok/30',
  info: 'bg-accent-cyan/15 text-accent-bright border border-accent-cyan/30',
  default: 'bg-white/8 text-text-secondary border border-white/10',
};

interface BadgeProps {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', size = 'sm', children, className = '' }: BadgeProps) {
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';
  return (
    <span className={`inline-flex items-center font-semibold rounded uppercase tracking-wider ${sizeClass} ${VARIANT_STYLES[variant]} ${className}`}>
      {children}
    </span>
  );
}
