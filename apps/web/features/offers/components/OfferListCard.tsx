import { memo } from 'react';
import { ActionButton, InfoTag, StatusBadge } from '@/components/shared';
import { getProductCardPresentation } from '@/utils/product-card-presentation';
import { OfferItem } from '../types/offers';
import { PricingItem } from '@/features/pricing/types/pricing';

interface OfferListCardProps {
  offer: OfferItem;
  product?: PricingItem;
  busy: boolean;
  onPreview: () => void;
  onShare: () => void;
  onDelete: () => void;
}

export const OfferListCard = memo(function OfferListCard({
  offer,
  product,
  busy,
  onPreview,
  onShare,
  onDelete,
}: OfferListCardProps) {
  const presentation = getProductCardPresentation({
    canonicalDescription: product?.profitProductDescription,
    rawDescription: product?.productName,
    condition: product?.profitCondition,
    capacity: product?.capacity,
    color: product?.color,
  });

  return (
    <article className="grid w-full gap-4 rounded-xl border border-inest-line/80 bg-inest-surface p-4 shadow-[0_10px_30px_rgba(16,24,40,0.045)] transition-all hover:border-inest-blue/30 hover:shadow-card focus-within:ring-4 focus-within:ring-inest-blue/10 lg:grid-cols-[minmax(220px,1fr)_160px_180px] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="line-clamp-2 text-base font-black leading-tight text-inest-text">
            {product ? presentation.title : 'Produto da oferta'}
          </h3>
          <StatusBadge tone={statusTone(offer.status)}>{translateStatus(offer.status)}</StatusBadge>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presentation.attributes.map((tag) => (
            <InfoTag key={tag}>{tag}</InfoTag>
          ))}
        </div>
        <p className="mt-1.5 truncate text-xs text-inest-muted">
          {offer.template?.name || 'Template comercial'}
        </p>
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase text-inest-muted">Condicoes comerciais</p>
        <strong className="mt-1 block truncate text-sm text-inest-text">
          {product?.deliveryTime || 'Prazo conforme oferta'}
        </strong>
        <p className="mt-2 text-xs text-inest-muted">{extractWarranty(offer.message)}</p>
        <p className="mt-1 text-xs text-inest-muted">Criada {formatDateTime(offer.createdAt)}</p>
      </div>

      <div className="flex min-w-0 flex-col items-start gap-2 lg:items-end">
        <span className="text-[10px] font-black uppercase text-inest-muted">Preco final</span>
        <strong className="font-display text-2xl font-black text-inest-text">
          {formatCurrency(offer.offerPrice)}
        </strong>
        <div className="flex flex-wrap gap-1.5 lg:justify-end">
          <ActionButton variant="secondary" className="h-8 px-2.5 text-xs" onClick={onPreview}>
            Visualizar
          </ActionButton>
          <ActionButton
            variant="secondary"
            className="h-8 px-2.5 text-xs"
            disabled
            title="Edicao nao disponivel no fluxo atual"
          >
            Editar
          </ActionButton>
          <ActionButton
            variant="success"
            className="h-8 px-2.5 text-xs"
            onClick={onShare}
            disabled={busy}
          >
            Compartilhar
          </ActionButton>
          <ActionButton
            variant="danger"
            className="h-8 px-2.5 text-xs"
            onClick={onDelete}
            disabled={busy}
          >
            Excluir
          </ActionButton>
        </div>
      </div>
    </article>
  );
});

function extractWarranty(message: string) {
  const warrantyLine = message
    .split(/\r?\n/)
    .find((line) => /garantia/i.test(line))
    ?.trim();
  return warrantyLine || 'Garantia conforme oferta';
}

function statusTone(status: string): 'green' | 'amber' | 'gray' {
  if (['ACTIVE', 'CREATED', 'SHARED'].includes(status)) return 'green';
  if (['DRAFT', 'PENDING'].includes(status)) return 'amber';
  return 'gray';
}

function translateStatus(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'Ativa',
    CREATED: 'Criada',
    SHARED: 'Compartilhada',
    DRAFT: 'Rascunho',
    PENDING: 'Pendente',
    DELETED: 'Excluida',
  };
  return map[status] ?? status;
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
