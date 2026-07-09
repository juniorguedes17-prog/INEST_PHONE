'use client';

import { ReactNode, useState } from 'react';
import { Drawer } from '@/components/shared';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { cn } from '@/utils/cn';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-inest-bg text-inest-text">
      <div
        className={cn(
          'grid min-h-screen transition-[grid-template-columns]',
          collapsed ? 'lg:grid-cols-[92px_minmax(0,1fr)]' : 'lg:grid-cols-[280px_minmax(0,1fr)]',
        )}
      >
        <div className="sticky top-0 hidden h-screen min-h-0 lg:block">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
        </div>

        <div className="min-w-0">
          <Header onOpenMenu={() => setDrawerOpen(true)} />
          <main className="min-w-0 px-5 py-6 md:px-8">{children}</main>
        </div>
      </div>

      <Drawer open={drawerOpen} title="Menu" onClose={() => setDrawerOpen(false)}>
        <Sidebar
          collapsed={false}
          onToggle={() => undefined}
          onNavigate={() => setDrawerOpen(false)}
        />
      </Drawer>
    </div>
  );
}
