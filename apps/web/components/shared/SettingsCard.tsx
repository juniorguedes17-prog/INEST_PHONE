import { ReactNode } from 'react';

interface SettingsCardProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function SettingsCard({ eyebrow, title, description, children }: SettingsCardProps) {
  return (
    <section className="rounded-2xl border border-inest-line bg-white p-6 shadow-panel">
      {eyebrow ? (
        <p className="text-xs font-black uppercase tracking-wide text-inest-blue">{eyebrow}</p>
      ) : null}
      <h2 className="mt-1 font-display text-2xl font-black text-inest-text">{title}</h2>
      {description ? (
        <p className="mt-2 text-base leading-7 text-inest-muted">{description}</p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}
