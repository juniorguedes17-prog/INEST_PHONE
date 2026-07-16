'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ActionButton, ContentContainer, SearchInput } from '@/components/shared';
import { logout } from '@/services/auth-service';
import { getNavigationItem } from './navigation';

interface HeaderProps {
  onOpenMenu: () => void;
}

type AppTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'inest.theme';

export function Header({ onOpenMenu }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const item = getNavigationItem(pathname);
  const [theme, setTheme] = useState<AppTheme>('light');

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme: AppTheme = storedTheme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme: AppTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
  }

  async function handleLogout() {
    await logout();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-inest-line bg-[var(--inest-header)] backdrop-blur">
      <ContentContainer className="flex min-h-[72px] items-center justify-between gap-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Abrir menu lateral"
            className="grid h-10 w-10 place-items-center rounded-lg border border-inest-line bg-white text-xs font-black text-inest-text lg:hidden"
          >
            Menu
          </button>
          <Image
            src="/brand/inest-phone-logo.jpg"
            alt="iNest Phone"
            width={40}
            height={40}
            priority
            className="hidden h-10 w-10 flex-none object-contain sm:block"
          />
          <div className="min-w-0">
            <nav
              aria-label="Breadcrumb"
              className="text-[11px] font-black uppercase text-inest-blue"
            >
              Operacao Comercial / {item.eyebrow ?? 'Sistema'}
            </nav>
            <h1 className="truncate font-display text-xl font-black text-inest-text sm:text-2xl">
              {item.label}
            </h1>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <SearchInput
            placeholder="Buscar produto, cliente ou oferta"
            aria-label="Busca global"
            className="hidden w-[260px] xl:flex 2xl:w-[340px]"
          />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Alternar tema"
            title={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            className="hidden h-10 w-10 place-items-center rounded-lg border border-inest-line bg-white text-sm font-black text-inest-text transition-colors hover:bg-inest-soft sm:grid"
          >
            O
          </button>
          <div className="hidden items-center gap-2 rounded-lg border border-inest-line bg-white px-2.5 py-1.5 lg:flex">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-inest-soft text-xs font-black text-inest-blue">
              AD
            </span>
            <div className="leading-tight">
              <strong className="block text-sm font-black text-inest-text">Admin</strong>
              <span className="text-xs text-inest-muted">Administrador</span>
            </div>
          </div>
          <ActionButton variant="ghost" onClick={handleLogout} className="hidden sm:inline-flex">
            Sair
          </ActionButton>
          <ActionButton variant="primary" className="hidden md:inline-flex">
            Nova oferta
          </ActionButton>
        </div>
      </ContentContainer>
    </header>
  );
}
