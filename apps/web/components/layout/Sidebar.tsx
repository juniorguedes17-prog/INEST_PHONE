'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
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
        'flex h-full min-h-0 flex-col border-r border-inest-line bg-[var(--inest-sidebar)] px-3 py-4 transition-[width] duration-200',
        collapsed ? 'w-[76px]' : 'w-[244px]',
      )}
    >
      <div className="flex min-h-12 items-center gap-3 px-2">
        <Image
          src="/brand/inest-phone-logo.jpg"
          alt="iNest Phone"
          width={56}
          height={56}
          priority
          className="h-12 w-12 flex-none object-contain"
        />
        {!collapsed ? (
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-inest-muted">Gestao Comercial</span>
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
              <span className="grid h-8 w-8 flex-none place-items-center rounded-md border border-inest-line bg-white text-xs font-black transition-colors group-hover:border-slate-300">
                {item.icon}
              </span>
              {!collapsed ? (
                <span className="truncate text-sm font-semibold">{item.label}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 rounded-xl border border-inest-line bg-white p-2.5">
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
