import Link from 'next/link';
import { PublicContractLinkNotice } from './public-contract-link-notice';

export default function ContractsPage() {
  return (
    <section className="contracts-card" aria-labelledby="contracts-title">
      <h1 className="route-title" id="contracts-title">Contratos</h1>
      <Link className="contract-action" href="/contratos/novo">
        Novo contrato
      </Link>
      <PublicContractLinkNotice />
    </section>
  );
}
