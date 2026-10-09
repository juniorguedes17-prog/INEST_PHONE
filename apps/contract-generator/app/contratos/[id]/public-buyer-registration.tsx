'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StoredBuyerRegistration } from '../../../lib/public-buyer-form';
import { createClient } from '../../../lib/supabase/client';
import { InternalBuyerRegistrationForm } from './internal-buyer-registration-form';

export function PublicBuyerRegistration({ contractId }: { contractId: string }) {
  const [registration, setRegistration] = useState<StoredBuyerRegistration | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const loadRegistration = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_contract_buyer_registration', {
      p_contract_id: contractId,
    });
    setHasError(Boolean(error));
    setRegistration(
      !error && Array.isArray(data) && data.length === 1
        ? (data[0] as StoredBuyerRegistration)
        : null,
    );
    setHasLoaded(true);
  }, [contractId]);

  useEffect(() => {
    void loadRegistration();
  }, [loadRegistration]);

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
      {!hasError && !isEditing ? (
        <button className="contract-choice" onClick={() => setIsEditing(true)} type="button">
          {registration?.client_full_name
            ? 'Editar dados cadastrais'
            : 'Preencher dados cadastrais'}
        </button>
      ) : null}
      {!hasError && isEditing ? (
        <InternalBuyerRegistrationForm
          contractId={contractId}
          initialRegistration={registration}
          key={JSON.stringify(registration)}
          onSaved={() => {
            void loadRegistration();
          }}
        />
      ) : null}
    </section>
  );
}
