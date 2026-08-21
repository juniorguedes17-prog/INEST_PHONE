'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
  SettingsCard,
  Tabs,
} from '@/components/shared';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { OfferDraft } from '@/features/pricing/types/pricing';
import { OfferItem } from '../types/offers';
import {
  InstallmentProvider,
  ProviderSimulation,
  simulateInstallments,
} from '../utils/installment-simulation';
import { buildInstallmentAvailability } from '../utils/installment-availability';
import {
  formatCurrencyCents,
  formatDebitOption,
  formatInstallmentOption,
  getInstallmentWhatsappUrl,
  renderInstallmentMessage,
} from '../utils/installment-message';

interface InstallmentSimulatorCardProps {
  offers: OfferItem[];
  drafts: OfferDraft[];
  loading: boolean;
  error: string | null;
}

const providerTabs = [
  { value: 'infinityPay', label: 'InfinityPay' },
  { value: 'pagBank', label: 'PagBank' },
  { value: 'nubank', label: 'Nubank' },
];

export function InstallmentSimulatorCard({
  offers,
  drafts,
  loading: offersLoading,
  error: offersError,
}: InstallmentSimulatorCardProps) {
  const { settings, loading: settingsLoading, error: settingsError } = useSettings();
  const [productKey, setProductKey] = useState('');
  const [colorKey, setColorKey] = useState('');
  const [provider, setProvider] = useState<InstallmentProvider>('infinityPay');
  const [feedback, setFeedback] = useState<string | null>(null);

  const products = useMemo(() => buildInstallmentAvailability(offers, drafts), [offers, drafts]);
  const selectedProduct = products.find((product) => product.key === productKey);
  const selectedColor = selectedProduct?.colors.find((color) => color.key === colorKey);
  const selectedEntry = selectedColor?.entry ?? null;
  const selectedPriceCents = selectedEntry ? Math.round(selectedEntry.offerPrice * 100) : null;

  const simulations = useMemo(() => {
    if (!settings || selectedPriceCents === null) return [];
    return simulateInstallments(selectedPriceCents, settings.installmentRates);
  }, [selectedPriceCents, settings]);
  const selectedSimulation = simulations.find((item) => item.provider === provider) ?? null;
  const message =
    settings && selectedEntry && selectedSimulation
      ? renderInstallmentMessage(settings.installmentMessageTemplate, {
          productName: selectedEntry.productName,
          color: selectedEntry.color || 'Sem cor informada',
          simulation: selectedSimulation,
        })
      : '';

  useEffect(() => {
    if (productKey && !selectedProduct) {
      setProductKey('');
      setColorKey('');
    }
  }, [productKey, selectedProduct]);

  useEffect(() => {
    if (colorKey && !selectedColor) setColorKey('');
  }, [colorKey, selectedColor]);

  async function copyMessage() {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setFeedback('Texto copiado.');
  }

  function shareMessage() {
    if (!message) return;
    window.open(getInstallmentWhatsappUrl(message), '_blank');
    setFeedback('Mensagem pronta para compartilhamento.');
  }

  return (
    <SettingsCard
      eyebrow="Ofertas"
      title="Simulador de parcelamento"
      description="Simule sobre o valor de oferta disponível, sem alterar a oferta comercial."
    >
      {offersLoading || settingsLoading ? <LoadingState /> : null}
      {offersError ? <ErrorState title="Simulador indisponível" description={offersError} /> : null}
      {settingsError ? (
        <ErrorState title="Configurações indisponíveis" description={settingsError} />
      ) : null}
      {!offersLoading && !settingsLoading && !offersError && !settingsError && !products.length ? (
        <EmptyState
          title="Nenhuma oferta disponível para simular."
          description="As ofertas persistidas e os rascunhos atuais da Precificação aparecerão aqui."
        />
      ) : null}
      {!offersLoading && !settingsLoading && !offersError && !settingsError && products.length ? (
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Select
              label="Produto"
              value={productKey}
              onChange={(event) => {
                setProductKey(event.target.value);
                setColorKey('');
                setFeedback(null);
              }}
            >
              <option value="">Selecione um produto</option>
              {products.map((product) => (
                <option key={product.key} value={product.key}>
                  {product.name}
                </option>
              ))}
            </Select>
            <Select
              label="Cor"
              value={colorKey}
              disabled={!selectedProduct}
              onChange={(event) => {
                setColorKey(event.target.value);
                setFeedback(null);
              }}
            >
              <option value="">Selecione uma cor</option>
              {selectedProduct?.colors.map((color) => (
                <option key={color.key} value={color.key}>
                  {color.label}
                </option>
              ))}
            </Select>
            <div className="grid gap-1.5">
              <span className="field-label">Valor da oferta</span>
              <div className="field-control flex items-center bg-inest-soft font-semibold text-inest-text">
                {selectedEntry
                  ? formatCurrencyCents(Math.round(selectedEntry.offerPrice * 100))
                  : 'Selecione produto e cor'}
              </div>
            </div>
          </div>

          {selectedColor?.isAmbiguous ? (
            <ErrorState
              title="Oferta atual não determinada"
              description="As ocorrências disponíveis não possuem timestamps comparáveis para definir a oferta mais recente."
            />
          ) : null}

          {selectedEntry && selectedSimulation ? (
            <div className="grid gap-4">
              <Tabs
                label="Adquirente"
                items={providerTabs}
                value={provider}
                onChange={(value) => {
                  setProvider(value as InstallmentProvider);
                  setFeedback(null);
                }}
              />
              <InstallmentOptions simulation={selectedSimulation} />
              <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-inest-line bg-inest-soft p-3 text-sm leading-6 text-inest-text">
                {message}
              </pre>
              <div className="grid gap-2 sm:grid-cols-2">
                <ActionButton variant="secondary" onClick={() => void copyMessage()}>
                  Copiar texto
                </ActionButton>
                <ActionButton variant="success" onClick={shareMessage}>
                  Compartilhar
                </ActionButton>
              </div>
              {feedback ? <p className="text-sm font-medium text-inest-green">{feedback}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </SettingsCard>
  );
}

function InstallmentOptions({ simulation }: { simulation: ProviderSimulation }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-inest-line">
      <div className="min-w-[420px] divide-y divide-inest-line text-sm">
        <div className="grid grid-cols-[minmax(120px,1fr)_minmax(160px,1.2fr)_minmax(120px,1fr)] gap-3 bg-inest-soft px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-inest-muted">
          <span>Forma</span>
          <span>Parcela</span>
          <span>Total</span>
        </div>
        {simulation.debitOption ? (
          <OptionRow
            label="Débito"
            installment={formatDebitOption(simulation.debitOption)}
            total={formatCurrencyCents(simulation.debitOption.totalAmountCents)}
          />
        ) : null}
        {simulation.options.map((option) => (
          <OptionRow
            key={option.installments}
            label={`${option.installments}x`}
            installment={formatInstallmentOption(option)}
            total={formatCurrencyCents(option.totalAmountCents)}
          />
        ))}
      </div>
    </div>
  );
}

function OptionRow({
  label,
  installment,
  total,
}: {
  label: string;
  installment: string;
  total: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(120px,1fr)_minmax(160px,1.2fr)_minmax(120px,1fr)] gap-3 px-4 py-3 text-inest-text">
      <span className="font-semibold">{label}</span>
      <span>{installment}</span>
      <span className="font-semibold">{total}</span>
    </div>
  );
}
