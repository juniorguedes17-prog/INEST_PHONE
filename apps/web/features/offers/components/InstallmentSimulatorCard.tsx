'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ActionButton,
  CurrencyInput,
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
  formatTradeInAmountInput,
  getRemainingAmountCents,
  parseTradeInAmount,
} from '../utils/installment-trade-in';
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
  const [tradeInInput, setTradeInInput] = useState('0,00');
  const [feedback, setFeedback] = useState<string | null>(null);

  const products = useMemo(() => buildInstallmentAvailability(offers, drafts), [offers, drafts]);
  const selectedProduct = products.find((product) => product.key === productKey);
  const selectedColor = selectedProduct?.colors.find((color) => color.key === colorKey);
  const selectedEntry = selectedColor?.entry ?? null;
  const selectedPriceCents = selectedEntry ? Math.round(selectedEntry.offerPrice * 100) : null;
  const parsedTradeIn = useMemo(() => parseTradeInAmount(tradeInInput), [tradeInInput]);
  const remainingAmount = useMemo(
    () =>
      selectedPriceCents === null || parsedTradeIn.error
        ? null
        : getRemainingAmountCents(selectedPriceCents, parsedTradeIn.cents),
    [parsedTradeIn, selectedPriceCents],
  );
  const tradeInError = parsedTradeIn.error ?? remainingAmount?.error ?? null;
  const remainingAmountCents =
    remainingAmount && !remainingAmount.error ? remainingAmount.cents : null;

  const simulations = useMemo(() => {
    if (!settings || remainingAmountCents === null || remainingAmountCents === 0) return [];
    return simulateInstallments(remainingAmountCents, settings.installmentRates);
  }, [remainingAmountCents, settings]);
  const selectedSimulation = simulations.find((item) => item.provider === provider) ?? null;
  const message =
    settings && selectedEntry && selectedSimulation
      ? renderInstallmentMessage(settings.installmentMessageTemplate, {
          productName: selectedEntry.productName,
          color: selectedEntry.color || 'Sem cor informada',
          simulation: selectedSimulation,
          tradeIn:
            parsedTradeIn.cents > 0 && remainingAmountCents !== null
              ? {
                  offerPriceCents: selectedPriceCents!,
                  tradeInAmountCents: parsedTradeIn.cents,
                  remainingAmountCents,
                }
              : undefined,
        })
      : '';

  useEffect(() => {
    if (productKey && !selectedProduct) {
      setProductKey('');
      setColorKey('');
      setTradeInInput('0,00');
    }
  }, [productKey, selectedProduct]);

  useEffect(() => {
    if (colorKey && !selectedColor) {
      setColorKey('');
      setTradeInInput('0,00');
    }
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
          <div className="grid gap-3 md:grid-cols-4">
            <Select
              label="Produto"
              value={productKey}
              onChange={(event) => {
                setProductKey(event.target.value);
                setColorKey('');
                setTradeInInput('0,00');
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
                setTradeInInput('0,00');
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
            <CurrencyInput
              label="Aparelho de entrada"
              value={tradeInInput}
              disabled={!selectedEntry}
              aria-invalid={Boolean(tradeInError)}
              onChange={(event) => {
                setTradeInInput(event.target.value);
                setFeedback(null);
              }}
              onBlur={() => {
                if (!parsedTradeIn.error)
                  setTradeInInput(formatTradeInAmountInput(parsedTradeIn.cents));
              }}
            />
          </div>

          {tradeInError ? <p className="text-sm font-medium text-red-600">{tradeInError}</p> : null}

          {selectedColor?.isAmbiguous ? (
            <ErrorState
              title="Oferta atual não determinada"
              description="As ocorrências disponíveis não possuem timestamps comparáveis para definir a oferta mais recente."
            />
          ) : null}

          {selectedEntry && parsedTradeIn.cents > 0 && !tradeInError ? (
            <div className="grid gap-3 border-y border-inest-line py-4 sm:grid-cols-3">
              <AmountSummary label="Valor da oferta" value={selectedPriceCents!} />
              <AmountSummary label="Aparelho de entrada" value={parsedTradeIn.cents} />
              <AmountSummary emphasized label="Saldo a parcelar" value={remainingAmountCents!} />
            </div>
          ) : null}

          {selectedEntry && remainingAmountCents === 0 && !tradeInError ? (
            <EmptyState
              title="Sem saldo a parcelar"
              description="O valor do aparelho de entrada cobre integralmente o valor da oferta."
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

function AmountSummary({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
}) {
  return (
    <div className={emphasized ? 'rounded-lg bg-inest-soft p-3' : 'p-3'}>
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-inest-muted">{label}</p>
      <p
        className={
          emphasized
            ? 'mt-1 text-lg font-bold text-inest-text'
            : 'mt-1 font-semibold text-inest-text'
        }
      >
        {formatCurrencyCents(value)}
      </p>
    </div>
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
