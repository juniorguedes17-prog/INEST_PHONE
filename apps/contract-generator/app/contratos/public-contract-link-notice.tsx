'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  publicContractLinkUrl,
  toCreatedPublicContractLink,
  type CreatedPublicContractLink,
} from '../../lib/public-contract-link';

const createdLinkStorageKey = 'inest-public-contract-link';

export function PublicContractLinkNotice() {
  const [createdLink, setCreatedLink] = useState<CreatedPublicContractLink | null>(null);

  useEffect(() => {
    const storedLink = sessionStorage.getItem(createdLinkStorageKey);
    sessionStorage.removeItem(createdLinkStorageKey);
    if (storedLink === null) return;

    try {
      setCreatedLink(toCreatedPublicContractLink(JSON.parse(storedLink)));
    } catch {
      setCreatedLink(null);
    }
  }, []);

  if (!createdLink) return null;

  const publicUrl = publicContractLinkUrl(window.location.origin, createdLink.publicToken);

  return (
    <section className="public-link-notice" aria-live="polite">
      <p className="route-kicker">Link público criado</p>
      <p className="public-link-description">Compartilhe este link com o cliente.</p>
      <a className="public-link-value" href={publicUrl}>{publicUrl}</a>
      <div className="public-link-actions">
        <button className="contract-choice" onClick={() => navigator.clipboard.writeText(publicUrl)} type="button">
          Copiar link
        </button>
        <Link className="contract-action" href={`/contratos/${createdLink.contractId}`}>
          Gerenciar link
        </Link>
      </div>
    </section>
  );
}
