'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ContractFillFlow } from '../../../domain/contract-fill-flow';
import type { ContractStatus } from '../../../domain/contract-status';
import { createClient } from '../../../lib/supabase/client';
import { toCreatedPublicContractLink } from '../../../lib/public-contract-link';

type ContractStartOption = {
  fillFlow: ContractFillFlow;
  status: ContractStatus;
};

const clientRequestOption: ContractStartOption = {
  fillFlow: 'Solicitar dados ao cliente',
  status: 'Aguardando cliente',
};

const manualOption: ContractStartOption = {
  fillFlow: 'Preencher manualmente',
  status: 'Pendente',
};

export function NewContractFlow() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function startContract(option: ContractStartOption) {
    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();
    if (option.fillFlow === 'Solicitar dados ao cliente') {
      const { data, error } = await supabase.rpc('create_contract_with_public_link');
      const createdLink = toCreatedPublicContractLink(data);

      if (error || !createdLink) {
        setErrorMessage('Não foi possível criar o contrato. Tente novamente.');
        setIsSubmitting(false);
        return;
      }

      sessionStorage.setItem('inest-public-contract-link', JSON.stringify(createdLink));
      router.replace('/contratos');
      router.refresh();
      return;
    }

    const { error } = await supabase.from('contracts').insert({
      fill_flow: option.fillFlow,
      status: option.status,
    });

    if (error) {
      setErrorMessage('Não foi possível criar o contrato. Tente novamente.');
      setIsSubmitting(false);
      return;
    }

    router.replace('/contratos');
    router.refresh();
  }

  return (
    <section className="contracts-card" aria-labelledby="new-contract-title">
      <p className="route-kicker">Novo contrato</p>
      <h1 className="route-title" id="new-contract-title">Como deseja começar?</h1>
      <div className="contract-choice-list">
        <button
          className="contract-choice"
          disabled={isSubmitting}
          onClick={() => startContract(clientRequestOption)}
          type="button"
        >
          Solicitar dados ao cliente
        </button>
        <button
          className="contract-choice"
          disabled={isSubmitting}
          onClick={() => startContract(manualOption)}
          type="button"
        >
          Preencher manualmente
        </button>
      </div>
      {errorMessage ? <p className="contract-error" role="alert">{errorMessage}</p> : null}
    </section>
  );
}
