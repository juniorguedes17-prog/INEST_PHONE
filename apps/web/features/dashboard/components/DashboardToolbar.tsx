import { ActionButton, StatusBadge, Toolbar } from '@/components/shared';

interface DashboardToolbarProps {
  loading: boolean;
  lastUpdated: string;
  onRefresh: () => Promise<void>;
}

export function DashboardToolbar({ loading, lastUpdated, onRefresh }: DashboardToolbarProps) {
  return (
    <section
      className="rounded-2xl border border-inest-line/70 bg-inest-surface px-4 py-3 shadow-[0_14px_34px_rgba(16,24,40,0.055)]"
      aria-label="Ferramentas do Dashboard"
    >
      <Toolbar>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-inest-muted">
            Ultima atualizacao
          </span>
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
          {loading ? 'Sincronizando...' : 'Sincronizar Google Sheets'}
        </ActionButton>
      </Toolbar>
    </section>
  );
}
