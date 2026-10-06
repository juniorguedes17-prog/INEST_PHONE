import Link from 'next/link';

export default function ContractsPage() {
  return (
    <section className="contracts-card" aria-labelledby="contracts-title">
      <h1 className="route-title" id="contracts-title">Contratos</h1>
      <Link className="contract-action" href="/contratos/novo">
        Novo contrato
      </Link>
    </section>
  );
}
