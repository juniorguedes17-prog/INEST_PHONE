import { ReactNode } from 'react';
import { AppShell } from '@/components/layout';

export default function ProtectedLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
