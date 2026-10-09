'use client';

import { useState } from 'react';
import { isPublicContractToken, publicContractLinkUrl } from '../../../lib/public-contract-link';
import { createClient } from '../../../lib/supabase/client';
import { PublicBuyerRegistration } from './public-buyer-registration';

type PublicContractLinkManagerProps = {
  contractId: string;
};

export function PublicContractLinkManager({ contractId }: PublicContractLinkManagerProps) {
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const publicUrl = publicToken ? publicContractLinkUrl(window.location.origin, publicToken) : null;

  async function regenerateLink() {
    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('regenerate_contract_public_link', {
      p_contract_id: contractId,
    });

    if (error || !isPublicContractToken(data)) {
      setErrorMessage('Não foi possível atualizar o link. Tente novamente.');
      setIsSubmitting(false);
      return;
    }

    setPublicToken(data);
    setIsSubmitting(false);
  }

  async function revokeLink() {
    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('revoke_contract_public_link', {
      p_contract_id: contractId,
    });

    if (error || data !== true) {
      setErrorMessage('Não foi possível revogar o link. Tente novamente.');
      setIsSubmitting(false);
      return;
    }

    setPublicToken(null);
    setIsSubmitting(false);
  }

  return (
    <section className="contracts-card" aria-labelledby="public-link-title">
      <p className="route-kicker">Contrato</p>
      <h1 className="route-title" id="public-link-title">
        Link público
      </h1>
      <p className="route-description">Gere um novo link ou revogue o acesso atual.</p>
      <div className="public-link-actions">
        <button
          className="contract-choice"
          disabled={isSubmitting}
          onClick={regenerateLink}
          type="button"
        >
          Gerar novo link
        </button>
        <button
          className="contract-choice"
          disabled={isSubmitting}
          onClick={revokeLink}
          type="button"
        >
          Revogar link
        </button>
      </div>
      {publicUrl ? (
        <div className="public-link-notice" aria-live="polite">
          <p className="public-link-description">Compartilhe o novo link com o cliente.</p>
          <a className="public-link-value" href={publicUrl}>
            {publicUrl}
          </a>
          <button
            className="contract-choice"
            onClick={() => navigator.clipboard.writeText(publicUrl)}
            type="button"
          >
            Copiar link
          </button>
        </div>
      ) : null}
      {errorMessage ? (
        <p className="contract-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <PublicBuyerRegistration contractId={contractId} />
    </section>
  );
}
