'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ActionButton, ContentContainer, SearchInput } from '@/components/shared';
import { getSettings, updateUserTheme } from '@/features/settings/services/settings-service';
import {
  applyThemePreference,
  getStoredThemePreference,
  normalizeThemePreference,
  THEME_CHANGE_EVENT,
} from '@/lib/theme-preference';
import type { ThemePreference } from '@/lib/theme-preference';
import { clearAccessToken } from '@/services/authenticated-fetch';
import { logout } from '@/services/auth-service';
import { getNavigationItem } from './navigation';

interface HeaderProps {
  onOpenMenu: () => void;
}

export function Header({ onOpenMenu }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const item = getNavigationItem(pathname);
  const [theme, setTheme] = useState<ThemePreference>('light');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isUpdatingTheme, setIsUpdatingTheme] = useState(false);

  useEffect(() => {
    const localTheme = getStoredThemePreference();
    applyThemePreference(localTheme);
    setTheme(localTheme);

    void getSettings()
      .then((settings) => {
        const officialTheme = applyThemePreference(settings.userPreferences.theme);
        setTheme(officialTheme);
      })
      .catch(() => {
        // O cache local continua sendo usado quando a leitura oficial falhar.
      });
  }, []);

  useEffect(() => {
    function handleThemeChange(event: Event) {
      setTheme(normalizeThemePreference((event as CustomEvent<ThemePreference>).detail));
    }

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  }, []);

  async function toggleTheme() {
    if (isUpdatingTheme) {
      return;
    }

    const previousTheme = theme;
    const nextTheme = applyThemePreference(theme === 'dark' ? 'light' : 'dark');
    setTheme(nextTheme);
    setIsUpdatingTheme(true);

    try {
      const savedSettings = await updateUserTheme(nextTheme);
      const officialTheme = applyThemePreference(savedSettings.userPreferences.theme);
      setTheme(officialTheme);
    } catch {
      const restoredTheme = applyThemePreference(previousTheme);
      setTheme(restoredTheme);
    } finally {
      setIsUpdatingTheme(false);
    }
  }

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await logout();
    } finally {
      // A sessao local deve ser encerrada mesmo quando o refresh token ja expirou.
      clearAccessToken();
      router.replace('/login');
      router.refresh();
    }
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
            src="/brand/inest-phone-logo.png"
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
            disabled={isUpdatingTheme}
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
          <ActionButton
            variant="ghost"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="hidden sm:inline-flex"
          >
            {isLoggingOut ? 'Saindo...' : 'Sair'}
          </ActionButton>
        </div>
      </ContentContainer>
    </header>
  );
}
