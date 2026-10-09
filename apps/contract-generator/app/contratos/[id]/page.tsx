import { PublicContractLinkManager } from './public-contract-link-manager';

type ContractDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ContractDetailsPage({ params }: ContractDetailsPageProps) {
  const { id } = await params;

  return <PublicContractLinkManager contractId={id} />;
}
