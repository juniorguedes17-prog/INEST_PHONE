'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { INestLogo } from '@/components/shared/INestLogo';
import { SidebarIconName, visibleNavigationItems } from './navigation';
import { cn } from '@/utils/cn';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

function SidebarIcon({ name }: { name: SidebarIconName }) {
  const commonProps = {
    'aria-hidden': true,
    className: 'h-[18px] w-[18px]',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg {...commonProps}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'radar':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3.5 2" />
          <path d="M12 3.5V2M3.5 12H2M21.5 12H22M12 21.5V22" />
        </svg>
      );
    case 'import':
      return (
        <svg {...commonProps}>
          <path d="M12 3v11" />
          <path d="m7.5 9.5 4.5 4.5 4.5-4.5" />
          <path d="M4 18.5V21h16v-2.5" />
        </svg>
      );
    case 'pricing':
      return (
        <svg {...commonProps}>
          <path d="m5 19 14-14" />
          <circle cx="7" cy="7" r="2" />
          <circle cx="17" cy="17" r="2" />
        </svg>
      );
    case 'offers':
      return (
        <svg {...commonProps}>
          <path d="m4 5 9.5.5L20 12l-8 8-8-8Z" />
          <circle cx="8.5" cy="8.5" r="1" />
        </svg>
      );
    case 'products':
      return (
        <svg {...commonProps}>
          <path d="m4 7 8-4 8 4v10l-8 4-8-4Z" />
          <path d="m4 7 8 4 8-4M12 11v10" />
        </svg>
      );
    case 'customers':
      return (
        <svg {...commonProps}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14.5a4.5 4.5 0 0 1 4 5.5" />
        </svg>
      );
    case 'suppliers':
      return (
        <svg {...commonProps}>
          <path d="M3 10h18M5 10v10M19 10v10M3 20h18M4 10l2-6h12l2 6M8 14h3v6H8zM15 14h2v2h-2z" />
        </svg>
      );
    case 'finance':
      return (
        <svg {...commonProps}>
          <path d="M4 6.5h14a2 2 0 0 1 2 2v9H6a2 2 0 0 1-2-2Z" />
          <path d="M4 8V6a2 2 0 0 1 2-2h11" />
          <path d="M16 13h4" />
        </svg>
      );
    case 'bi':
      return (
        <svg {...commonProps}>
          <path d="M4 19V5M4 19h17" />
          <path d="m7 15 3-3 3 2 5-6" />
        </svg>
      );
    case 'integrations':
      return (
        <svg {...commonProps}>
          <path d="M8 12h8M7 7h3v3H7zM14 14h3v3h-3z" />
          <path d="M10 8h4a2 2 0 0 1 2 2v4M14 16h-4a2 2 0 0 1-2-2v-4" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...commonProps}>
          <path d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
          <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

export function Sidebar({ collapsed, onToggle, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'inest-sidebar flex h-full min-h-0 flex-col border-r border-white/10 bg-inest-dark p-4 text-white transition-[width] duration-200',
        collapsed ? 'w-[92px]' : 'w-[280px]',
      )}
    >
      <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
        <INestLogo variant={collapsed ? 'compact' : 'navigation'} priority />
        {!collapsed ? (
          <div className="min-w-0">
            <strong className="block truncate text-sm font-black text-white">iNest Phone</strong>
            <span className="block truncate text-[11px] text-slate-400">Gestão Comercial</span>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        className={cn(
          'mt-4 hidden h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-inest-blue lg:flex',
          collapsed ? 'self-center' : 'self-end',
        )}
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d={collapsed ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'} />
        </svg>
      </button>

      <nav className="mt-5 grid min-h-0 gap-1.5 overflow-y-auto pr-1" aria-label="Módulos">
        {visibleNavigationItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={item.label}
              className={cn(
                'group flex min-h-11 items-center gap-3 rounded-xl border border-transparent px-2.5 text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-inest-blue',
                active
                  ? 'border-white/10 bg-gradient-to-r from-inest-blue/20 to-inest-purple/20 text-white shadow-soft'
                  : 'hover:bg-white/10 hover:text-white',
                collapsed && 'justify-center px-0',
              )}
            >
              <span
                className={cn(
                  'grid h-8 w-8 flex-none place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition group-hover:text-white',
                  active && 'border-inest-blue/40 bg-inest-blue/20 text-white',
                )}
              >
                <SidebarIcon name={item.icon} />
              </span>
              {!collapsed ? (
                <span className="truncate text-sm font-medium">{item.label}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-2.5">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-inest-blue/15 text-xs font-black text-inest-blue">
            AD
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <strong className="block truncate text-sm font-black text-white">Admin</strong>
              <span className="block truncate text-[11px] text-slate-400">Online agora</span>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
