import { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="grid min-h-60 place-items-center rounded-xl border border-dashed border-inest-line bg-white p-8 text-center">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-inest-soft text-xl font-black text-inest-muted">
          +
        </div>
        <h3 className="mt-4 text-card-title">{title}</h3>
        {description ? <p className="mt-2 max-w-xl text-body-muted">{description}</p> : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}
