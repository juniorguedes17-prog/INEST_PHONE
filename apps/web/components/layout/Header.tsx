'use client';

import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { ActionButton, SearchInput } from '@/components/shared';
import { logout } from '@/services/auth-service';
import { getNavigationItem } from './navigation';

interface HeaderProps {
  onOpenMenu: () => void;
}

export function Header({ onOpenMenu }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const item = getNavigationItem(pathname);

  async function handleLogout() {
    await logout();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="flex flex-col gap-4 border-b border-inest-line bg-inest-bg/95 px-5 py-5 backdrop-blur md:px-8 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menu lateral"
          className="grid h-11 w-11 place-items-center rounded-xl border border-inest-line bg-white text-inest-text lg:hidden"
        >
          ☰
        </button>
        <div className="min-w-0">
          <nav
            aria-label="Breadcrumb"
            className="text-xs font-black uppercase tracking-wide text-inest-blue"
          >
            iNest Phone / {item.eyebrow ?? 'Sistema'}
          </nav>
          <h1 className="mt-1 truncate font-display text-4xl font-black tracking-normal text-inest-text">
            {item.label}
          </h1>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          placeholder="Buscar produto, cliente ou oferta"
          aria-label="Busca global"
          className="w-full sm:w-[360px]"
        />
        <button
          type="button"
          aria-label="Alternar tema"
          title="Tema claro/escuro preparado"
          className="grid h-12 w-12 place-items-center rounded-xl border border-inest-line bg-white text-inest-text"
        >
          ◐
        </button>
        <div className="hidden items-center gap-3 rounded-xl border border-inest-line bg-white px-3 py-2 lg:flex">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-inest-soft text-xs font-black text-inest-blue">
            AD
          </span>
          <div className="leading-tight">
            <strong className="block text-sm font-black text-inest-text">Admin</strong>
            <span className="text-xs text-inest-muted">Administrador</span>
          </div>
        </div>
        <ActionButton variant="secondary" onClick={handleLogout}>
          Sair
        </ActionButton>
        <ActionButton variant="primary">Nova oferta</ActionButton>
      </div>
    </header>
  );
}
