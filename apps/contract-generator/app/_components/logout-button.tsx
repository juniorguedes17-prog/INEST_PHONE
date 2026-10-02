'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: 'local' });
    router.replace('/login');
    router.refresh();
  }

  return <button className="logout-button" onClick={handleLogout} type="button">Sair</button>;
}
