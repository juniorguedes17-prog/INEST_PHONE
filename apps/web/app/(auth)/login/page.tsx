'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
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
      setError(loginError instanceof Error ? loginError.message : 'Nao foi possivel acessar.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-inest-bg px-6 py-8 text-inest-text">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1fr_440px]">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wide text-inest-blue">Acesso seguro</p>
          <h1 className="mt-4 font-display text-5xl font-black tracking-normal">iNest Phone</h1>
          <p className="mt-5 text-lg leading-8 text-inest-muted">
            Plataforma comercial preparada para radar de precos, precificacao, ofertas e gestao
            operacional com controle de acesso por perfil.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-panel"
        >
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-inest-blue">Login</p>
            <h2 className="mt-2 font-display text-3xl font-black">Entrar no sistema</h2>
          </div>

          <label className="mt-8 block">
            <span className="text-sm font-bold text-inest-muted">E-mail</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base outline-none transition focus:border-inest-blue focus:bg-white"
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
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base outline-none transition focus:border-inest-blue focus:bg-white"
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
            className="mt-7 h-12 w-full rounded-xl bg-inest-blue px-5 text-base font-black text-white shadow-soft transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
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
