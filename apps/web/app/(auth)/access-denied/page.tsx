import Link from 'next/link';

export default function AccessDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-inest-bg px-6 py-8 text-inest-text">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-panel">
        <p className="text-sm font-bold uppercase tracking-wide text-red-600">Acesso negado</p>
        <h1 className="mt-3 font-display text-3xl font-black">Permissao insuficiente</h1>
        <p className="mt-4 leading-7 text-inest-muted">
          Seu perfil nao possui permissao para acessar esta area. Entre em contato com um
          administrador caso precise de acesso.
        </p>
        <Link
          href="/dashboard"
          className="mt-7 inline-flex h-11 items-center rounded-xl bg-inest-blue px-5 font-black text-white shadow-soft"
        >
          Ir para o dashboard
        </Link>
      </section>
    </main>
  );
}
