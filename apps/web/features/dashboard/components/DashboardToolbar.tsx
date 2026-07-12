import { ActionButton, StatusBadge, Toolbar } from '@/components/shared';

interface DashboardToolbarProps {
  loading: boolean;
  lastUpdated: string;
  onRefresh: () => Promise<void>;
}

export function DashboardToolbar({
  loading,
  lastUpdated,
  onRefresh,
}: DashboardToolbarProps) {
  return (
    <section
      className="rounded-xl border border-inest-line bg-white px-3 py-2.5 shadow-card"
      aria-label="Ferramentas do Dashboard"
    >
      <Toolbar>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase text-inest-muted">Ultima atualizacao</span>
          <StatusBadge tone={loading ? 'amber' : 'green'}>
            {loading ? 'Atualizando' : lastUpdated}
          </StatusBadge>
        </div>
        <ActionButton
          variant="secondary"
          onClick={() => void onRefresh()}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? 'Atualizando...' : 'Atualizar Dashboard'}
        </ActionButton>
      </Toolbar>
    </section>
  );
}
