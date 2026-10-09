import {
  isPublicContractToken,
  isResolvedPublicContractLink,
} from '../../../lib/public-contract-link';
import { createPublicServerClient } from '../../../lib/supabase/public-server';
import { PublicBuyerForm } from './public-buyer-form';

type PublicCollectionPageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicCollectionPage({ params }: PublicCollectionPageProps) {
  const { token } = await params;
  const isWellFormedToken = isPublicContractToken(token);
  let isValidLink = false;

  if (isWellFormedToken) {
    const supabase = createPublicServerClient();
    const { data, error } = await supabase.rpc('resolve_public_contract_link', {
      p_public_token: token,
    });
    isValidLink = isResolvedPublicContractLink(data, error);
  }

  if (!isValidLink) {
    return (
      <section className="route-placeholder" aria-labelledby="public-link-status">
        <p className="route-kicker">Link indisponível</p>
        <h1 className="route-title" id="public-link-status">
          Este link não está disponível.
        </h1>
      </section>
    );
  }

  return (
    <section className="public-buyer-card" aria-labelledby="public-buyer-title">
      <p className="route-kicker">Cadastro do comprador</p>
      <h1 className="route-title" id="public-buyer-title">
        Preencha seus dados cadastrais
      </h1>
      <p className="route-description">Informe somente os dados abaixo para conferência.</p>
      <PublicBuyerForm publicToken={token} />
    </section>
  );
}
