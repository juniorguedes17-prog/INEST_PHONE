import { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <section
      className="flex min-h-14 flex-col gap-3 border-b border-inest-line/80 px-1 pb-4 lg:flex-row lg:items-center lg:justify-between"
      aria-label={`Acoes de ${title}`}
    >
      <div className="min-w-0">
        <h2 className="sr-only">{title}</h2>
        {eyebrow ? (
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-inest-blue">
            {eyebrow}
          </p>
        ) : null}
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-inest-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}
