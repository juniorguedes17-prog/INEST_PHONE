import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-inest-bg px-6 py-8 text-inest-text">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-panel">
        <p className="text-sm font-bold uppercase tracking-wide text-inest-blue">
          Recuperacao de acesso
        </p>
        <h1 className="mt-3 font-display text-3xl font-black">Esqueci minha senha</h1>
        <p className="mt-4 leading-7 text-inest-muted">
          Estrutura preparada para o fluxo de recuperacao. A emissao de e-mails sera conectada em
          etapa futura, quando a politica operacional for definida.
        </p>
        <Link
          href="/login"
          className="mt-7 inline-flex h-11 items-center rounded-xl bg-inest-blue px-5 font-black text-white shadow-soft"
        >
          Voltar ao login
        </Link>
      </section>
    </main>
  );
}
