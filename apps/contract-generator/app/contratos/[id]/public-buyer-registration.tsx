'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';

type BuyerRegistration = {
  client_full_name: string | null;
  client_person_type: string | null;
  client_document_number: string | null;
  client_email: string | null;
  client_address_street: string | null;
  client_address_number: string | null;
  client_address_neighborhood: string | null;
  client_address_complement: string | null;
  client_postal_code: string | null;
  client_city: string | null;
  client_state: string | null;
  client_phone: string | null;
};

export function PublicBuyerRegistration({ contractId }: { contractId: string }) {
  const [registration, setRegistration] = useState<BuyerRegistration | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadRegistration() {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_contract_buyer_registration', {
        p_contract_id: contractId,
      });

      if (!isMounted) return;
      setHasError(Boolean(error));
      setRegistration(
        !error && Array.isArray(data) && data.length === 1 ? (data[0] as BuyerRegistration) : null,
      );
      setHasLoaded(true);
    }

    void loadRegistration();
    return () => {
      isMounted = false;
    };
  }, [contractId]);

  if (!hasLoaded) return null;

  return (
    <section className="public-link-notice" aria-labelledby="buyer-registration-title">
      <p className="route-kicker">Cadastro do comprador</p>
      <h2 className="route-title" id="buyer-registration-title">
        Dados recebidos
      </h2>
      {hasError ? (
        <p className="contract-error" role="alert">
          Não foi possível carregar os dados cadastrais.
        </p>
      ) : null}
      {!hasError && !registration?.client_full_name ? (
        <p className="route-description">Os dados cadastrais ainda não foram recebidos.</p>
      ) : null}
      {!hasError && registration?.client_full_name ? (
        <dl className="contract-buyer-data">
          <div>
            <dt>Nome</dt>
            <dd>{registration.client_full_name}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{registration.client_person_type}</dd>
          </div>
          <div>
            <dt>CPF/CNPJ</dt>
            <dd>{registration.client_document_number}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{registration.client_email}</dd>
          </div>
          <div>
            <dt>Telefone</dt>
            <dd>{registration.client_phone}</dd>
          </div>
          <div>
            <dt>Endereço</dt>
            <dd>
              {registration.client_address_street}, {registration.client_address_number}
              {registration.client_address_complement
                ? ` - ${registration.client_address_complement}`
                : ''}
            </dd>
          </div>
          <div>
            <dt>Bairro</dt>
            <dd>{registration.client_address_neighborhood}</dd>
          </div>
          <div>
            <dt>CEP</dt>
            <dd>{registration.client_postal_code}</dd>
          </div>
          <div>
            <dt>Cidade/UF</dt>
            <dd>
              {registration.client_city}/{registration.client_state}
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
