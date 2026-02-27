import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type PageId = 'dashboard' | 'incidents' | 'agents' | 'queries' | 'geo' | 'impact' | 'builder';

interface AppStoreState {
  activePage: PageId;
  selectedIncidentId: string | null;
  sidebarCollapsed: boolean;
}

interface AppStoreContextValue extends AppStoreState {
  navigate: (page: PageId) => void;
  selectIncident: (id: string | null) => void;
  toggleSidebar: () => void;
}

const AppStoreContext = createContext<AppStoreContextValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppStoreState>({
    activePage: 'dashboard',
    selectedIncidentId: 'inc-001',
    sidebarCollapsed: false,
  });

  const navigate = useCallback((page: PageId) => {
    setState(s => ({ ...s, activePage: page }));
  }, []);

  const selectIncident = useCallback((id: string | null) => {
    setState(s => ({ ...s, selectedIncidentId: id }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setState(s => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }));
  }, []);

  return (
    <AppStoreContext.Provider value={{ ...state, navigate, selectIncident, toggleSidebar }}>
      {children}
    </AppStoreContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider');
  return ctx;
}
