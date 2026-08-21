'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { INestLogo } from '@/components/shared/INestLogo';
import { login } from '@/services/auth-service';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@inestphone.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      router.push('/dashboard');
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Não foi possível acessar.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-inest-bg px-4 py-4 text-inest-text sm:px-6 sm:py-8">
      <section className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl items-center gap-4 sm:gap-5 lg:min-h-[calc(100vh-4rem)] lg:gap-8 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="inest-login-brand w-full max-w-2xl rounded-[24px] bg-[#080a0f] p-5 text-white lg:rounded-[28px] lg:p-10 xl:p-14">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9eb0ff]">
            Acesso seguro
          </p>
          <INestLogo variant="login" priority className="mt-3 sm:mt-4" />
          <p className="mt-3 text-sm leading-6 text-slate-300 sm:mt-5 sm:text-lg sm:leading-8">
            Plataforma comercial preparada para radar de preços, precificação, ofertas e gestão
            operacional com controle de acesso por perfil.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[24px] border border-inest-line/70 bg-inest-surface p-5 shadow-[0_24px_52px_rgba(16,24,40,0.12)] sm:p-8"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-inest-blue">
              Login
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Entrar no sistema</h2>
          </div>

          <label className="mt-5 block sm:mt-8">
            <span className="text-sm font-bold text-inest-muted">E-mail</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              className="mt-2 h-12 w-full rounded-xl border border-inest-line bg-inest-soft/60 px-4 text-base outline-none transition focus:border-inest-blue focus:bg-inest-surface focus:ring-4 focus:ring-inest-blue/10"
              required
            />
          </label>

          <label className="mt-5 block">
            <span className="text-sm font-bold text-inest-muted">Senha</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              className="mt-2 h-12 w-full rounded-xl border border-inest-line bg-inest-soft/60 px-4 text-base outline-none transition focus:border-inest-blue focus:bg-inest-surface focus:ring-4 focus:ring-inest-blue/10"
              required
            />
          </label>

          {error ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 h-12 w-full rounded-xl bg-gradient-to-r from-inest-blue to-[#6b69ec] px-5 text-base font-semibold text-white shadow-soft transition hover:brightness-[0.97] disabled:cursor-not-allowed disabled:opacity-60 sm:mt-7"
          >
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>

          <Link
            href="/forgot-password"
            className="mt-5 block text-center text-sm font-bold text-inest-muted transition hover:text-inest-blue"
          >
            Esqueci minha senha
          </Link>
        </form>
      </section>
    </main>
  );
}
