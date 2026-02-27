import React from 'react';
import { DemoModeBanner } from './DemoModeBanner';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { DEMO_CONFIG } from '../../config/demo.config';
import { useDemoOrchestrator } from '../../hooks/useDemoOrchestrator';
import { useAppStore } from '../../store/AppStoreContext';

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  dashboard: { title: 'Mission Control', subtitle: 'Real-time AI agent orchestration & incident intelligence' },
  incidents: { title: 'Incidents', subtitle: 'Active investigations and resolution history' },
  agents: { title: 'Agent Workbench', subtitle: 'Multi-step reasoning with Elastic Agent Builder' },
  queries: { title: 'ES|QL Workbench', subtitle: 'Natural language and structured queries against Elasticsearch' },
  geo: { title: 'Geographic Intelligence', subtitle: 'Distributed node health and geo-anomaly detection' },
  impact: { title: 'Impact Metrics', subtitle: 'Measurable outcomes from autonomous agent operations' },
  builder: { title: 'Agent Builder', subtitle: 'Create, deploy, and chat with agents via Elastic Agent Builder API' },
};

function DemoOrchestration() {
  useDemoOrchestrator();
  return null;
}

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { activePage } = useAppStore();
  const pageInfo = PAGE_TITLES[activePage] ?? { title: 'SENTINEL' };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-base">
      {DEMO_CONFIG.DEMO_MODE && <DemoModeBanner />}
      {DEMO_CONFIG.DEMO_MODE && <DemoOrchestration />}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar title={pageInfo.title} subtitle={pageInfo.subtitle} />
          <main className="flex-1 overflow-y-auto">
            <div className="h-full animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
