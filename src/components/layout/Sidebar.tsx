import React from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  Bot,
  Code2,
  Globe,
  BarChart3,
  Hexagon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useAppStore, type PageId } from '../../store/AppStoreContext';
import { DEMO_INCIDENTS } from '../../data/demo-incidents';
import { DEMO_CONFIG } from '../../config/demo.config';
import { isAgentBuilderConfigured } from '../../lib/agentBuilder';

const NAV_ITEMS: { id: PageId; label: string; icon: React.ElementType; badge?: number; highlight?: boolean }[] = [
  { id: 'dashboard', label: 'Mission Control', icon: LayoutDashboard },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { id: 'agents', label: 'Agent Workbench', icon: Bot },
  { id: 'queries', label: 'ES|QL Queries', icon: Code2 },
  { id: 'geo', label: 'Geographic Intel', icon: Globe },
  { id: 'impact', label: 'Impact Metrics', icon: BarChart3 },
  { id: 'builder', label: 'Agent Builder', icon: Sparkles, highlight: true },
];

export function Sidebar() {
  const { activePage, navigate, sidebarCollapsed, toggleSidebar } = useAppStore();
  const criticalCount = DEMO_CONFIG.DEMO_MODE
    ? DEMO_INCIDENTS.filter(i => i.severity === 'critical' && i.status !== 'resolved' && i.status !== 'auto_resolved').length
    : 0;
  const builderLive = isAgentBuilderConfigured();

  return (
    <aside
      className={`flex flex-col bg-surface border-r border-white/[0.06] transition-all duration-200 flex-shrink-0 ${
        sidebarCollapsed ? 'w-14' : 'w-[220px]'
      }`}
    >
      <div className={`flex items-center gap-2.5 px-4 h-12 border-b border-white/[0.06] ${sidebarCollapsed ? 'justify-center px-0' : ''}`}>
        <div className="flex items-center gap-2 text-accent-cyan">
          <Hexagon size={20} strokeWidth={1.5} className="text-accent-bright" />
          {!sidebarCollapsed && (
            <span className="font-semibold text-text-primary tracking-tight text-base">
              SENTINEL
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const badgeCount = item.id === 'incidents' ? criticalCount : item.badge;
          const isActive = activePage === item.id;
          const isLive = item.id === 'builder' && builderLive;

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`nav-item w-full text-left ${isActive ? 'active' : ''} ${sidebarCollapsed ? 'justify-center px-0 w-10 mx-auto' : ''} ${item.highlight && !isActive ? 'border border-accent-cyan/20 bg-accent-dim/50' : ''}`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon size={15} className={`flex-shrink-0 ${item.highlight && !isActive ? 'text-accent-cyan' : ''}`} />
              {!sidebarCollapsed && (
                <>
                  <span className={`flex-1 truncate ${item.highlight && !isActive ? 'text-accent-bright' : ''}`}>{item.label}</span>
                  {isLive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-status-ok flex-shrink-0" title="Live" />
                  )}
                  {badgeCount && badgeCount > 0 ? (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                      item.id === 'incidents' ? 'bg-status-critical/20 text-status-critical' : 'bg-white/10 text-text-muted'
                    }`}>
                      {badgeCount}
                    </span>
                  ) : null}
                </>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-2 border-t border-white/[0.06]">
        <button onClick={toggleSidebar} className="nav-item w-full">
          {sidebarCollapsed ? <ChevronRight size={15} /> : (
            <>
              <ChevronLeft size={15} />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>

      {!sidebarCollapsed && (
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${builderLive ? 'bg-status-ok' : 'bg-amber-400'} animate-pulse`} />
            <span className="text-xs text-text-muted">Elastic Agent Builder</span>
          </div>
          <div className="text-xs text-text-muted mt-0.5 font-mono">
            {builderLive ? 'v9 · Connected' : 'v9 · Demo mode'}
          </div>
        </div>
      )}
    </aside>
  );
}
