import { Card, StatusBadge } from '@/components/shared';

type StatusTone = 'blue' | 'green' | 'amber' | 'gray';

interface OperationalCardProps {
  eyebrow: string;
  title: string;
  quantity: string;
  quantityLabel: string;
  status: string;
  statusTone: StatusTone;
  updatedAt: string;
}

export function OperationalCard({
  eyebrow,
  title,
  quantity,
  quantityLabel,
  status,
  statusTone,
  updatedAt,
}: OperationalCardProps) {
  return (
    <Card className="min-h-40 bg-white p-4 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase text-inest-blue">{eyebrow}</p>
          <h3 className="mt-0.5 truncate font-display text-lg font-black text-inest-text">
            {title}
          </h3>
        </div>
        <StatusBadge tone={statusTone}>{status}</StatusBadge>
      </div>

      <div className="mt-5 flex items-end gap-2">
        <strong className="font-display text-3xl font-black leading-none text-inest-text">
          {quantity}
        </strong>
        <span className="pb-0.5 text-sm font-bold text-inest-muted">{quantityLabel}</span>
      </div>

      <p className="mt-4 border-t border-inest-line pt-3 text-xs text-inest-muted">
        Atualizado: {updatedAt}
      </p>
    </Card>
  );
}
