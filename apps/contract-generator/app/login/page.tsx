'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMessage('Não foi possível entrar com estas credenciais. Confira seu e-mail e senha.');
      setIsSubmitting(false);
      return;
    }

    router.replace('/contratos');
    router.refresh();
  }

  return (
    <section className="login-card" aria-labelledby="login-title">
      <p className="route-kicker">Acesso interno</p>
      <h1 className="route-title" id="login-title">
        Entrar no gerador
      </h1>
      <p className="route-description">Use as suas credenciais internas para continuar.</p>

      <form className="login-form" onSubmit={handleSubmit}>
        <label className="login-field">
          <span>E-mail</span>
          <input autoComplete="email" disabled={isSubmitting} name="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        </label>
        <label className="login-field">
          <span>Senha</span>
          <input autoComplete="current-password" disabled={isSubmitting} name="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
        </label>
        {errorMessage ? <p className="login-error" role="alert">{errorMessage}</p> : null}
        <button className="login-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </section>
  );
}
