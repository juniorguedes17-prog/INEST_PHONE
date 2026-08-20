'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { INestLogo } from '@/components/shared/INestLogo';
import { visibleNavigationItems } from './navigation';
import { cn } from '@/utils/cn';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

export function Sidebar({ collapsed, onToggle, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col border-r border-inest-line/80 bg-[var(--inest-sidebar)] px-3 py-4 transition-[width] duration-200',
        collapsed ? 'w-[76px]' : 'w-[244px]',
      )}
    >
      <div className={cn('flex min-h-16 items-center gap-2', collapsed && 'justify-center')}>
        <INestLogo variant={collapsed ? 'compact' : 'navigation'} priority />
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <span className="block whitespace-nowrap text-xs font-semibold text-inest-muted">
              Gestão Comercial
            </span>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        className="mt-4 hidden h-9 items-center justify-center rounded-lg border border-inest-line text-inest-muted transition-colors hover:bg-inest-soft hover:text-inest-text lg:flex"
      >
        {collapsed ? '>' : '<'}
      </button>

      <nav className="mt-4 grid gap-1 overflow-y-auto pr-1" aria-label="Modulos">
        {visibleNavigationItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={item.label}
              className={cn(
                'group flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-inest-muted transition-colors focus:outline-none focus:ring-2 focus:ring-inest-blue focus:ring-offset-1',
                active
                  ? 'bg-inest-blue/10 text-inest-blue'
                  : 'hover:bg-inest-soft hover:text-inest-text',
                collapsed && 'justify-center',
              )}
            >
              <span className="grid h-8 w-8 flex-none place-items-center rounded-md border border-inest-line bg-inest-surface text-xs font-black transition-colors group-hover:border-inest-blue/40 group-hover:text-inest-blue">
                {item.icon}
              </span>
              {!collapsed ? (
                <span className="truncate text-sm font-semibold">{item.label}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 rounded-xl border border-inest-line bg-inest-surface p-2.5 shadow-[0_8px_22px_rgba(16,24,40,0.035)]">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-inest-soft text-xs font-black text-inest-blue">
            AD
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <strong className="block truncate text-sm font-black text-inest-text">Admin</strong>
              <span className="block truncate text-xs text-inest-muted">Online agora</span>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
