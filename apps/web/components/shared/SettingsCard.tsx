import { ReactNode } from 'react';
import { Card } from './Card';

interface SettingsCardProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function SettingsCard({ eyebrow, title, description, children }: SettingsCardProps) {
  return (
    <Card>
      {eyebrow ? (
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-inest-blue">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1 text-card-title">{title}</h2>
      {description ? <p className="mt-2 text-body-muted">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </Card>
  );
}
