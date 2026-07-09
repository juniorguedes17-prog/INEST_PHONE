import { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-inest-line bg-white p-8 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-inest-soft text-2xl text-inest-muted">
          □
        </div>
        <h3 className="mt-5 font-display text-2xl font-black text-inest-text">{title}</h3>
        {description ? <p className="mt-3 max-w-xl text-inest-muted">{description}</p> : null}
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}
