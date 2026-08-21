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
        'inest-sidebar flex h-full min-h-0 flex-col border-r border-white/10 bg-[var(--inest-sidebar)] px-3.5 py-5 text-white transition-[width] duration-200',
        collapsed ? 'w-[76px]' : 'w-[244px]',
      )}
    >
      <div className={cn('flex min-h-16 items-center gap-2.5', collapsed && 'justify-center')}>
        <INestLogo variant={collapsed ? 'compact' : 'navigation'} priority />
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <span className="block whitespace-nowrap text-[11px] font-medium tracking-wide text-[var(--inest-sidebar-muted)]">
              Gestão Comercial
            </span>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        className="mt-6 hidden h-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-xs font-bold text-[var(--inest-sidebar-muted)] transition-colors hover:bg-white/10 hover:text-white lg:flex"
      >
        {collapsed ? '>' : '<'}
      </button>

      <nav className="mt-7 grid gap-1.5 overflow-y-auto pr-1" aria-label="Modulos">
        {visibleNavigationItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={item.label}
              className={cn(
                'group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[var(--inest-sidebar-muted)] transition-all focus:outline-none focus:ring-2 focus:ring-inest-blue focus:ring-offset-2 focus:ring-offset-[#080a0f]',
                active
                  ? 'bg-gradient-to-r from-inest-blue/25 to-inest-purple/15 text-white shadow-[0_10px_22px_rgba(0,0,0,0.20)] before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-r-full before:bg-inest-blue'
                  : 'hover:bg-white/[0.06] hover:text-white',
                collapsed && 'justify-center',
              )}
            >
              <span
                className={cn(
                  'grid h-7 w-6 flex-none place-items-center text-[10px] font-bold tracking-wide transition-colors',
                  active
                    ? 'text-white'
                    : 'text-[var(--inest-sidebar-muted)] group-hover:text-white',
                )}
              >
                {item.icon}
              </span>
              {!collapsed ? (
                <span className="truncate text-sm font-medium">{item.label}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5 rounded-2xl border border-white/10 bg-[var(--inest-sidebar-surface)] p-3 shadow-[0_18px_34px_rgba(0,0,0,0.22)]">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-white/10 text-xs font-bold text-white">
            AD
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <strong className="block truncate text-sm font-semibold text-white">Admin</strong>
              <span className="block truncate text-xs text-[var(--inest-sidebar-muted)]">
                Online agora
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
