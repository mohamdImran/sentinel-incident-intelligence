import { useState } from 'react';
import { Filter } from 'lucide-react';
import type { Incident } from '../../types/incident.types';
import { IncidentCard } from './IncidentCard';
import { DEMO_INCIDENTS } from '../../data/demo-incidents';
import { useAppStore } from '../../store/AppStoreContext';

const SORT_OPTIONS = ['newest', 'severity', 'status'] as const;
type SortOption = typeof SORT_OPTIONS[number];

function sortIncidents(incidents: Incident[], sort: SortOption): Incident[] {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const statusOrder = { open: 0, investigating: 1, remediating: 2, resolved: 3, auto_resolved: 4 };

  const sorted = [...incidents];
  if (sort === 'severity') sorted.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  else if (sort === 'status') sorted.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  else sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return sorted;
}

interface IncidentQueueProps {
  className?: string;
}

export function IncidentQueue({ className = '' }: IncidentQueueProps) {
  const { selectedIncidentId, selectIncident } = useAppStore();
  const [sort, setSort] = useState<SortOption>('severity');

  const sorted = sortIncidents(DEMO_INCIDENTS, sort);
  const activeCount = DEMO_INCIDENTS.filter(i => i.status === 'open' || i.status === 'investigating' || i.status === 'remediating').length;

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div>
          <h3 className="text-xs font-semibold text-text-primary">Incidents</h3>
          <p className="text-[10px] text-text-muted mt-0.5">{activeCount} active · {DEMO_INCIDENTS.length} total</p>
        </div>
        <div className="flex items-center gap-1">
          <Filter size={11} className="text-text-muted" />
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortOption)}
            className="text-[10px] bg-transparent text-text-muted border-none outline-none cursor-pointer"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o} value={o} className="bg-overlay text-text-secondary capitalize">
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {sorted.map(incident => (
          <IncidentCard
            key={incident.id}
            incident={incident}
            isSelected={selectedIncidentId === incident.id}
            onClick={() => selectIncident(incident.id)}
          />
        ))}
      </div>
    </div>
  );
}
