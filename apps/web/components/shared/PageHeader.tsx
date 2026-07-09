import { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-xs font-black uppercase tracking-wide text-inest-blue">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-4xl font-black tracking-normal text-inest-text">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-3xl text-base leading-7 text-inest-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
