import type { ReactNode } from 'react';
import { LogoutButton } from '../_components/logout-button';

export default function ContractsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <div className="internal-header"><LogoutButton /></div>
      {children}
    </>
  );
}
