'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigationItems } from './navigation';
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
        'flex h-full min-h-0 flex-col border-r border-inest-line bg-white/95 p-5 transition-all',
        collapsed ? 'w-[92px]' : 'w-[280px]',
      )}
    >
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-gradient-to-br from-inest-blue to-inest-purple font-display text-lg font-black text-white">
          iN
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <strong className="block truncate text-lg font-black text-inest-text">
              iNest Phone
            </strong>
            <span className="block truncate text-sm text-inest-muted">Gestão Comercial</span>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        className="mt-6 hidden h-10 items-center justify-center rounded-xl border border-inest-line text-inest-muted hover:bg-inest-soft lg:flex"
      >
        {collapsed ? '›' : '‹'}
      </button>

      <nav className="mt-6 grid gap-2 overflow-y-auto pr-1" aria-label="Módulos">
        {navigationItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={item.label}
              className={cn(
                'flex min-h-12 items-center gap-3 rounded-xl px-3 text-inest-muted transition focus:outline-none focus:ring-2 focus:ring-inest-blue',
                active
                  ? 'bg-inest-soft text-inest-text'
                  : 'hover:bg-inest-soft hover:text-inest-text',
                collapsed && 'justify-center',
              )}
            >
              <span className="grid h-9 w-9 flex-none place-items-center rounded-xl border border-inest-line bg-white text-sm font-bold">
                {item.icon}
              </span>
              {!collapsed ? (
                <span className="truncate text-base font-semibold">{item.label}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-inest-line bg-white p-3">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-inest-soft font-black text-inest-blue">
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
