import { useState } from 'react';
import { AppStoreProvider, useAppStore } from './store/AppStoreContext';
import { AgentStoreProvider } from './store/AgentStoreContext';
import { DemoStoreProvider } from './store/DemoStoreContext';
import { LiveRunnerProvider } from './store/LiveRunnerContext';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { AgentsPage } from './pages/AgentsPage';
import { QueriesPage } from './pages/QueriesPage';
import { GeoPage } from './pages/GeoPage';
import { ImpactPage } from './pages/ImpactPage';
import { AgentBuilderPage } from './pages/AgentBuilderPage';
import { ConnectPage } from './pages/ConnectPage';
import { hasConnectionConfig, isEnvConfigured } from './lib/connectionStore';
import { DEMO_CONFIG } from './config/demo.config';

function PageRouter() {
  const { activePage } = useAppStore();

  return (
    <div className="h-full">
      {activePage === 'dashboard' && <DashboardPage />}
      {activePage === 'incidents' && <IncidentsPage />}
      {activePage === 'agents' && <AgentsPage />}
      {activePage === 'queries' && <QueriesPage />}
      {activePage === 'geo' && <GeoPage />}
      {activePage === 'impact' && <ImpactPage />}
      {activePage === 'builder' && <AgentBuilderPage />}
    </div>
  );
}

function AppWithOnboarding() {
  
  const skipOnboarding = DEMO_CONFIG.DEMO_MODE || isEnvConfigured() || hasConnectionConfig();
  const [connected, setConnected] = useState(skipOnboarding);

  if (!connected) {
    return <ConnectPage onConnected={() => setConnected(true)} />;
  }

  return (
    <DemoStoreProvider>
      <AppStoreProvider>
        <AgentStoreProvider>
          <LiveRunnerProvider>
            <AppShell>
              <PageRouter />
            </AppShell>
          </LiveRunnerProvider>
        </AgentStoreProvider>
      </AppStoreProvider>
    </DemoStoreProvider>
  );
}

export default function App() {
  return <AppWithOnboarding />;
}
