'use client';

import { useSearchParams } from 'next/navigation';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  ListHeader,
  LoadingState,
  PageHeader,
  ProductCard,
  SettingsCard,
  StatusBadge,
} from '@/components/shared';
import { OfferItem } from '../types/offers';
import { useOffers } from '../hooks/useOffers';

export function OffersPageContent() {
  const searchParams = useSearchParams();
  const offers = useOffers(searchParams.get('productId'));

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Comercial"
        title="Gerador de Ofertas"
        description="Mensagens comerciais geradas a partir da precificacao oficial, sem recalcular valores."
        actions={
          <>
            {offers.success ? <StatusBadge tone="green">{offers.success}</StatusBadge> : null}
            <ActionButton onClick={() => void offers.generate()} disabled={offers.saving}>
              {offers.saving ? 'Gerando...' : 'Gerar Oferta'}
            </ActionButton>
          </>
        }
      />

      {offers.error ? <ErrorState title="Atencao" description={offers.error} /> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-6">
          <SettingsCard
            eyebrow="Dados oficiais"
            title="Produto e template"
            description="O preco vem da Precificacao. O texto usa os templates oficiais do BRD."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <SelectInput
                label="Produto precificado"
                value={offers.selectedProductId}
                options={offers.pricingItems.map((item) => [item.productId, item.productName])}
                onChange={offers.setSelectedProductId}
              />
              <SelectInput
                label="Template"
                value={offers.selectedTemplateId}
                options={[
                  ['', 'Automatico pelo tipo do produto'],
                  ...offers.templates.map((template) => [template.id, template.name]),
                ]}
                onChange={offers.setSelectedTemplateId}
              />
            </div>
          </SettingsCard>

          <ListHeader
            eyebrow="Historico"
            title={`${offers.offers.length} ofertas geradas`}
            description="Registro de ofertas criadas, duplicadas, copiadas e compartilhadas."
          />

          <div className="grid gap-4">
            {offers.loading ? <LoadingState /> : null}
            {!offers.loading && !offers.offers.length ? (
              <EmptyState
                title="Nenhuma oferta gerada."
                description="Selecione um produto precificado e gere a primeira mensagem."
              />
            ) : null}
            {!offers.loading
              ? offers.offers.map((offer) => (
                  <OfferHistoryCard
                    key={offer.id}
                    offer={offer}
                    onPreview={() => offers.setCurrentOffer(offer)}
                    onCopy={() => void offers.copy(offer)}
                    onShare={() => void offers.share(offer)}
                    onDuplicate={() => void offers.duplicate(offer.id)}
                    onDelete={() => void offers.remove(offer.id)}
                  />
                ))
              : null}
          </div>
        </div>

        <aside className="grid content-start gap-6">
          {offers.selectedProduct ? (
            <ProductCard
              title={offers.selectedProduct.productName}
              status={offers.selectedProduct.productType}
              tags={[
                offers.selectedProduct.color,
                offers.selectedProduct.capacity,
                offers.selectedProduct.deliveryTime,
              ].filter(Boolean)}
              meta="Produto carregado da Precificacao oficial."
              supplier={{
                name: offers.selectedProduct.supplier.name,
                location: 'Preco oficial',
                delivery: offers.selectedProduct.deliveryTime || 'Prazo padrao',
              }}
              price={formatCurrency(offers.selectedProduct.offerPrice)}
              priceLabel="Preco de oferta"
              actions={[
                {
                  label: 'Gerar Oferta',
                  variant: 'success',
                  onClick: () => void offers.generate(),
                },
              ]}
            />
          ) : null}

          <SettingsCard
            eyebrow="Previa"
            title="Mensagem comercial"
            description="A previa e atualizada a partir da ultima oferta gerada."
          >
            {offers.currentOffer ? (
              <div className="grid gap-4">
                <pre className="whitespace-pre-wrap rounded-xl border border-inest-line bg-inest-soft p-4 text-sm leading-6 text-inest-text">
                  {offers.currentOffer.message}
                </pre>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ActionButton
                    variant="secondary"
                    onClick={() => void offers.copy(offers.currentOffer!)}
                  >
                    Copiar Texto
                  </ActionButton>
                  <ActionButton
                    variant="success"
                    onClick={() => void offers.share(offers.currentOffer!)}
                  >
                    WhatsApp
                  </ActionButton>
                </div>
              </div>
            ) : (
              <EmptyState
                title="Sem previa."
                description="Gere ou selecione uma oferta para visualizar a mensagem."
              />
            )}
          </SettingsCard>
        </aside>
      </section>
    </div>
  );
}

function OfferHistoryCard({
  offer,
  onPreview,
  onCopy,
  onShare,
  onDuplicate,
  onDelete,
}: {
  offer: OfferItem;
  onPreview: () => void;
  onCopy: () => void;
  onShare: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-xl border border-inest-line bg-white p-5 shadow-card">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-inest-blue">
            {offer.template?.name ?? 'Template'}
          </p>
          <h3 className="mt-1 font-display text-2xl font-black text-inest-text">
            {formatCurrency(offer.offerPrice)}
          </h3>
          <p className="mt-2 text-sm text-inest-muted">
            Criada em {formatDateTime(offer.createdAt)} - Status {offer.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ActionButton variant="secondary" onClick={onPreview}>
            Previa
          </ActionButton>
          <ActionButton variant="secondary" onClick={onCopy}>
            Copiar
          </ActionButton>
          <ActionButton variant="success" onClick={onShare}>
            WhatsApp
          </ActionButton>
          <ActionButton variant="secondary" onClick={onDuplicate}>
            Duplicar
          </ActionButton>
          <ActionButton variant="danger" onClick={onDelete}>
            Excluir
          </ActionButton>
        </div>
      </div>
    </article>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-control"
      >
        {options.map(([valueOption, labelOption]) => (
          <option key={valueOption} value={valueOption}>
            {labelOption}
          </option>
        ))}
      </select>
    </label>
  );
}
