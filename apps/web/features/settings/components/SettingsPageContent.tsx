'use client';

import { useEffect, useState } from 'react';
import {
  ActionButton,
  CurrencyInput,
  ErrorState,
  LoadingState,
  PageHeader,
  PercentageInput,
  SettingsCard,
  StatusBadge,
} from '@/components/shared';
import {
  applyThemePreference,
  normalizeThemePreference,
  THEME_CHANGE_EVENT,
} from '@/lib/theme-preference';
import type { ThemePreference } from '@/lib/theme-preference';
import { useSettings } from '../hooks/useSettings';
import { ImportRedirectRule, InstallmentRate, SettingsPayload } from '../types/settings';
import { OfferTemplatesSettingsCard } from './OfferTemplatesSettingsCard';
import { UsersAccessSettingsCard } from './UsersAccessSettingsCard';

type SettingsSection = 'general' | 'pricing' | 'importation' | 'offers';

const settingsSections: Array<{ id: SettingsSection; label: string }> = [
  { id: 'general', label: 'Geral' },
  { id: 'pricing', label: 'Precificação' },
  { id: 'importation', label: 'Importação' },
  { id: 'offers', label: 'Ofertas' },
];

const nonAppleProfitBandLabels = [
  'Custo até R$100',
  'Custo de R$100,01 a R$200',
  'Custo de R$200,01 a R$300',
  'Custo de R$300,01 a R$500',
  'Custo de R$500,01 a R$1.000',
  'Custo de R$1.000,01 a R$2.000',
  'Custo de R$2.000,01 a R$3.000',
  'Custo de R$3.000,01 a R$5.000',
  'Custo acima de R$5.000',
] as const;

const nonAppleFixedCostBandLabels = ['Custo até R$500', 'Custo acima de R$500'] as const;

export function SettingsPageContent() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const {
    settings,
    setSettings,
    loading,
    saving,
    error,
    success,
    reload,
    save,
    resetDefaults,
    resetNonAppleElectronicsDefaults,
  } = useSettings();

  useEffect(() => {
    if (settings) {
      applyThemePreference(settings.userPreferences.theme);
    }
  }, [settings?.userPreferences.theme]);

  useEffect(() => {
    function handleThemeChange(event: Event) {
      const theme = normalizeThemePreference((event as CustomEvent<ThemePreference>).detail);

      setSettings((current) =>
        current
          ? {
              ...current,
              userPreferences: { ...current.userPreferences, theme },
            }
          : current,
      );
    }

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  }, [setSettings]);

  if (loading) {
    return (
      <div className="grid gap-6">
        <PageHeader
          eyebrow="Sistema"
          title="Configurações"
          description="Carregando parâmetros globais da aplicação."
        />
        <LoadingState />
      </div>
    );
  }

  if (!settings) {
    return (
      <ErrorState
        title="Configurações indisponíveis"
        description={error ?? 'Não foi possível carregar os parâmetros do sistema.'}
      />
    );
  }

  function updateSettings(updater: (current: SettingsPayload) => SettingsPayload) {
    if (!settings) {
      return;
    }

    setSettings(updater(settings));
  }

  function updateRedirectRule(index: number, nextRule: ImportRedirectRule) {
    updateSettings((current) => ({
      ...current,
      importation: {
        ...current.importation,
        redirectRules: current.importation.redirectRules.map((rule, ruleIndex) =>
          ruleIndex === index ? nextRule : rule,
        ),
      },
    }));
  }

  function addRedirectRule() {
    updateSettings((current) => ({
      ...current,
      importation: {
        ...current.importation,
        redirectRules: [
          ...current.importation.redirectRules,
          {
            productType: 'Nova categoria',
            matchTerms: ['novo termo'],
            redirectCost: 0,
            priority: current.importation.redirectRules.length + 1,
          },
        ],
      },
    }));
  }

  function removeRedirectRule(index: number) {
    updateSettings((current) => ({
      ...current,
      importation: {
        ...current.importation,
        redirectRules: current.importation.redirectRules.filter(
          (_, ruleIndex) => ruleIndex !== index,
        ),
      },
    }));
  }

  function updateUsaFinancial(
    field: keyof Omit<SettingsPayload['usaFinancial'], 'lastUpdated'>,
    value: number,
  ) {
    updateSettings((current) => ({
      ...current,
      usaFinancial: {
        ...current.usaFinancial,
        [field]: value,
      },
    }));
  }

  function updateInstallmentRate(
    provider: 'infinityPay' | 'pagBank' | 'nubank',
    installments: number,
    ratePercent: number,
  ) {
    updateSettings((current) => ({
      ...current,
      installmentRates: {
        ...current.installmentRates,
        [provider]: {
          ...current.installmentRates[provider],
          installments: current.installmentRates[provider].installments.map((rate) =>
            rate.installments === installments ? { ...rate, ratePercent } : rate,
          ),
        },
      },
    }));
  }

  function updateInfinityPayDebitRate(debitRatePercent: number) {
    updateSettings((current) => ({
      ...current,
      installmentRates: {
        ...current.installmentRates,
        infinityPay: {
          ...current.installmentRates.infinityPay,
          debitRatePercent,
        },
      },
    }));
  }

  function updateNonAppleProfitBand(
    index: number,
    field: 'profitPercentOnCost' | 'fixedProfit' | 'minimumProfit',
    value: number,
  ) {
    updateSettings((current) => ({
      ...current,
      pricing: {
        ...current.pricing,
        nonAppleElectronicsPolicy: {
          ...current.pricing.nonAppleElectronicsPolicy,
          profitBands: current.pricing.nonAppleElectronicsPolicy.profitBands.map(
            (band, bandIndex) => (bandIndex === index ? { ...band, [field]: value } : band),
          ),
        },
      },
    }));
  }

  function updateNonAppleFixedCostBand(index: number, fixedCost: number) {
    updateSettings((current) => ({
      ...current,
      pricing: {
        ...current.pricing,
        nonAppleElectronicsPolicy: {
          ...current.pricing.nonAppleElectronicsPolicy,
          fixedCostBands: current.pricing.nonAppleElectronicsPolicy.fixedCostBands.map(
            (band, bandIndex) => (bandIndex === index ? { ...band, fixedCost } : band),
          ),
        },
      },
    }));
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Fonte única dos parâmetros gerais, financeiros, operacionais e comerciais da plataforma."
        actions={
          <>
            {success ? <StatusBadge tone="green">{success}</StatusBadge> : null}
            <ActionButton
              variant="secondary"
              onClick={() => void resetDefaults()}
              disabled={saving}
            >
              Restaurar padrões
            </ActionButton>
            <ActionButton onClick={() => void save(settings)} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </ActionButton>
          </>
        }
      />

      {error ? <ErrorState title="Atenção" description={error} /> : null}

      <div
        aria-label="Categorias de configurações"
        className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-stable"
        role="tablist"
      >
        <div className="inline-flex min-w-full gap-1 rounded-2xl border border-inest-line bg-inest-soft p-1 sm:min-w-0">
          {settingsSections.map((section) => {
            const isActive = activeSection === section.id;

            return (
              <button
                key={section.id}
                id={`settings-tab-${section.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveSection(section.id)}
                className={[
                  'min-h-11 shrink-0 rounded-xl px-4 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-inest-blue focus:ring-offset-2',
                  isActive
                    ? 'bg-gradient-to-br from-inest-blue to-inest-purple text-white shadow-soft'
                    : 'text-inest-muted hover:bg-white hover:text-inest-text',
                ].join(' ')}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className={activeSection === 'general' ? '' : 'hidden'}>
          <SettingsCard
            eyebrow="Dados gerais"
            title="Configurações gerais"
            description="Dados institucionais utilizados como referência em toda a aplicação."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Nome da empresa"
                value={settings.general.companyName}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    general: { ...current.general, companyName: value },
                  }))
                }
              />
              <TextInput
                label="Nome fantasia"
                value={settings.general.tradeName}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    general: { ...current.general, tradeName: value },
                  }))
                }
              />
              <TextInput
                label="CNPJ"
                value={settings.general.cnpj}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    general: { ...current.general, cnpj: value },
                  }))
                }
              />
              <TextInput
                label="E-mail"
                type="email"
                value={settings.general.email}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    general: { ...current.general, email: value },
                  }))
                }
              />
              <TextInput
                label="WhatsApp principal"
                value={settings.general.mainWhatsapp}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    general: { ...current.general, mainWhatsapp: value },
                  }))
                }
              />
              <div className="grid grid-cols-[1fr_96px] gap-3">
                <TextInput
                  label="Cidade"
                  value={settings.general.city}
                  onChange={(value) =>
                    updateSettings((current) => ({
                      ...current,
                      general: { ...current.general, city: value },
                    }))
                  }
                />
                <TextInput
                  label="Estado"
                  value={settings.general.state}
                  onChange={(value) =>
                    updateSettings((current) => ({
                      ...current,
                      general: { ...current.general, state: value },
                    }))
                  }
                />
              </div>
            </div>
          </SettingsCard>
        </div>

        <div className={activeSection === 'pricing' ? '' : 'hidden'}>
          <SettingsCard
            eyebrow="Precificação"
            title="Configuração financeira"
            description="Parâmetros financeiros globais que serão consumidos pela precificação."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <CurrencyInput
                label="Custo Fixo Global"
                value={settings.financial.globalFixedCost}
                onChange={(event) =>
                  updateSettings((current) => ({
                    ...current,
                    financial: {
                      ...current.financial,
                      globalFixedCost: toNumber(event.target.value),
                    },
                  }))
                }
              />
              <CurrencyInput
                label="Frete padrão"
                value={settings.financial.defaultFreight}
                onChange={(event) =>
                  updateSettings((current) => ({
                    ...current,
                    financial: {
                      ...current.financial,
                      defaultFreight: toNumber(event.target.value),
                    },
                  }))
                }
              />
              <CurrencyInput
                label="Taxa padrão"
                value={settings.financial.defaultPaymentFee}
                onChange={(event) =>
                  updateSettings((current) => ({
                    ...current,
                    financial: {
                      ...current.financial,
                      defaultPaymentFee: toNumber(event.target.value),
                    },
                  }))
                }
              />
              <CurrencyInput
                label="Margem padrão"
                value={settings.financial.defaultMargin}
                onChange={(event) =>
                  updateSettings((current) => ({
                    ...current,
                    financial: {
                      ...current.financial,
                      defaultMargin: toNumber(event.target.value),
                    },
                  }))
                }
              />
              <CurrencyInput
                label="Desconto padrão"
                value={settings.financial.defaultDiscount}
                onChange={(event) =>
                  updateSettings((current) => ({
                    ...current,
                    financial: {
                      ...current.financial,
                      defaultDiscount: toNumber(event.target.value),
                    },
                  }))
                }
              />
            </div>
          </SettingsCard>
        </div>

        <div className={activeSection === 'pricing' ? 'xl:col-span-2' : 'hidden'}>
          <SettingsCard
            eyebrow="Precificação"
            title="Precificação de Eletrônicos"
            description="Parâmetros comerciais aplicados somente ao motor Non-Apple. Os limites das faixas são fixos."
          >
            <div className="mb-6 flex justify-end">
              <ActionButton
                variant="secondary"
                onClick={() => void resetNonAppleElectronicsDefaults()}
                disabled={saving}
              >
                Restaurar padrões
              </ActionButton>
            </div>
            <div className="grid gap-4">
              {settings.pricing.nonAppleElectronicsPolicy.profitBands.map((band, index) => (
                <section
                  key={band.id}
                  className="rounded-xl border border-inest-line bg-inest-soft p-4"
                >
                  <p className="mb-4 text-sm font-black text-inest-text">
                    {nonAppleProfitBandLabels[index]}
                  </p>
                  <div className="grid gap-4 md:grid-cols-3">
                    {band.profitPercentOnCost !== null ? (
                      <PercentageInput
                        label="Lucro sobre custo"
                        type="number"
                        min="0"
                        step="0.01"
                        value={band.profitPercentOnCost}
                        onChange={(event) =>
                          updateNonAppleProfitBand(
                            index,
                            'profitPercentOnCost',
                            toNumber(event.target.value),
                          )
                        }
                      />
                    ) : null}
                    {band.fixedProfit !== null ? (
                      <CurrencyInput
                        label="Lucro fixo"
                        type="number"
                        min="0"
                        step="0.01"
                        value={band.fixedProfit}
                        onChange={(event) =>
                          updateNonAppleProfitBand(
                            index,
                            'fixedProfit',
                            toNumber(event.target.value),
                          )
                        }
                      />
                    ) : null}
                    {band.minimumProfit !== null ? (
                      <CurrencyInput
                        label="Piso de lucro"
                        type="number"
                        min="0"
                        step="0.01"
                        value={band.minimumProfit}
                        onChange={(event) =>
                          updateNonAppleProfitBand(
                            index,
                            'minimumProfit',
                            toNumber(event.target.value),
                          )
                        }
                      />
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
            <div className="mt-6 border-t border-inest-line pt-6">
              <p className="mb-4 text-sm font-black text-inest-text">Custo fixo Non-Apple</p>
              <div className="grid gap-4 md:grid-cols-2">
                {settings.pricing.nonAppleElectronicsPolicy.fixedCostBands.map((band, index) => (
                  <section
                    key={band.id}
                    className="rounded-xl border border-inest-line bg-inest-soft p-4"
                  >
                    <p className="mb-4 text-sm font-black text-inest-text">
                      {nonAppleFixedCostBandLabels[index]}
                    </p>
                    <CurrencyInput
                      label="Custo fixo"
                      type="number"
                      min="0"
                      step="0.01"
                      value={band.fixedCost}
                      onChange={(event) =>
                        updateNonAppleFixedCostBand(index, toNumber(event.target.value))
                      }
                    />
                  </section>
                ))}
              </div>
            </div>
          </SettingsCard>
        </div>

        <div className={activeSection === 'pricing' ? '' : 'hidden'}>
          <SettingsCard
            eyebrow="Precificação"
            title="Arredondamento de preço"
            description="Finais comerciais aplicados para cima ao preço de venda."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Final comercial 1"
                type="number"
                value={String(settings.pricing.commercialRoundingEnding1)}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    pricing: { ...current.pricing, commercialRoundingEnding1: toNumber(value) },
                  }))
                }
              />
              <TextInput
                label="Final comercial 2"
                type="number"
                value={String(settings.pricing.commercialRoundingEnding2)}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    pricing: { ...current.pricing, commercialRoundingEnding2: toNumber(value) },
                  }))
                }
              />
            </div>
          </SettingsCard>
        </div>

        <div className={activeSection === 'pricing' ? '' : 'hidden'}>
          <SettingsCard
            eyebrow="Precificação"
            title="Acréscimo padrão da oferta"
            description="Valor opcional adicionado ao preço ao gerar uma oferta."
          >
            <div className="max-w-sm">
              <CurrencyInput
                label="Acréscimo padrão"
                value={settings.pricing.offerIncrement}
                onChange={(event) =>
                  updateSettings((current) => ({
                    ...current,
                    pricing: { ...current.pricing, offerIncrement: toNumber(event.target.value) },
                  }))
                }
              />
            </div>
          </SettingsCard>
        </div>

        <div className={activeSection === 'pricing' ? 'xl:col-span-2' : 'hidden'}>
          <SettingsCard
            eyebrow="Precificação"
            title="Taxas de parcelamento"
            description="Taxas efetivas editáveis por adquirente e quantidade de parcelas."
          >
            <div className="grid gap-8 xl:grid-cols-3">
              <section className="min-w-0">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black text-inest-text">InfinityPay</h3>
                  <span className="text-xs font-bold text-inest-muted">Débito + 1x a 12x</span>
                </div>
                <RateInput
                  label="Débito"
                  value={settings.installmentRates.infinityPay.debitRatePercent}
                  onChange={updateInfinityPayDebitRate}
                />
                <div className="mt-4 border-t border-inest-line pt-4">
                  <InstallmentRateInputs
                    rates={settings.installmentRates.infinityPay.installments}
                    onChange={(installments, ratePercent) =>
                      updateInstallmentRate('infinityPay', installments, ratePercent)
                    }
                  />
                </div>
              </section>

              <section className="min-w-0 border-t border-inest-line pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black text-inest-text">PagBank</h3>
                  <span className="text-xs font-bold text-inest-muted">1x a 18x</span>
                </div>
                <InstallmentRateInputs
                  rates={settings.installmentRates.pagBank.installments}
                  onChange={(installments, ratePercent) =>
                    updateInstallmentRate('pagBank', installments, ratePercent)
                  }
                />
              </section>

              <section className="min-w-0 border-t border-inest-line pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black text-inest-text">Nubank</h3>
                  <span className="text-xs font-bold text-inest-muted">1x a 12x</span>
                </div>
                <InstallmentRateInputs
                  rates={settings.installmentRates.nubank.installments}
                  onChange={(installments, ratePercent) =>
                    updateInstallmentRate('nubank', installments, ratePercent)
                  }
                />
              </section>
            </div>
          </SettingsCard>
        </div>
      </div>

      <div className={activeSection === 'importation' ? '' : 'hidden'}>
        <SettingsCard
          eyebrow="Radar de Importação"
          title="Custos operacionais de importação"
          description="Parâmetros que serão utilizados pelo Radar de Importação em etapa futura."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <CurrencyInput
              label="Cotação do dólar"
              value={settings.importation.dollarQuote}
              onChange={(event) =>
                updateSettings((current) => ({
                  ...current,
                  importation: {
                    ...current.importation,
                    dollarQuote: toNumber(event.target.value),
                  },
                }))
              }
            />
            <CurrencyInput
              label="Saída de CDE"
              value={settings.importation.cdeExitPerBox}
              onChange={(event) =>
                updateSettings((current) => ({
                  ...current,
                  importation: {
                    ...current.importation,
                    cdeExitPerBox: toNumber(event.target.value),
                  },
                }))
              }
            />
            <CurrencyInput
              label="Despacho Brasil"
              value={settings.importation.brazilDispatchPerBox}
              onChange={(event) =>
                updateSettings((current) => ({
                  ...current,
                  importation: {
                    ...current.importation,
                    brazilDispatchPerBox: toNumber(event.target.value),
                  },
                }))
              }
            />
            <CurrencyInput
              label="Etiqueta Correios"
              value={settings.importation.correiosLabel}
              onChange={(event) =>
                updateSettings((current) => ({
                  ...current,
                  importation: {
                    ...current.importation,
                    correiosLabel: toNumber(event.target.value),
                  },
                }))
              }
            />
            <PercentageInput
              label="Nota Fiscal"
              value={settings.importation.invoiceTaxPercent}
              onChange={(event) =>
                updateSettings((current) => ({
                  ...current,
                  importation: {
                    ...current.importation,
                    invoiceTaxPercent: toNumber(event.target.value),
                  },
                }))
              }
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-inest-line">
            <div className="grid grid-cols-[1.4fr_1.2fr_160px_110px_96px] gap-3 bg-inest-soft px-4 py-3 text-sm font-black text-inest-muted">
              <span>Categoria</span>
              <span>Termos</span>
              <span>Custo</span>
              <span>Prioridade</span>
              <span>Ações</span>
            </div>
            <div className="divide-y divide-inest-line">
              {settings.importation.redirectRules.map((rule, index) => (
                <div
                  key={`${rule.productType}-${index}`}
                  className="grid grid-cols-1 gap-3 px-4 py-4 lg:grid-cols-[1.4fr_1.2fr_160px_110px_96px]"
                >
                  <TextInput
                    label="Categoria"
                    value={rule.productType}
                    onChange={(value) => updateRedirectRule(index, { ...rule, productType: value })}
                  />
                  <TextInput
                    label="Termos separados por vírgula"
                    value={rule.matchTerms.join(', ')}
                    onChange={(value) =>
                      updateRedirectRule(index, {
                        ...rule,
                        matchTerms: value
                          .split(',')
                          .map((term) => term.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                  <CurrencyInput
                    label="Custo"
                    value={rule.redirectCost}
                    onChange={(event) =>
                      updateRedirectRule(index, {
                        ...rule,
                        redirectCost: toNumber(event.target.value),
                      })
                    }
                  />
                  <TextInput
                    label="Prioridade"
                    type="number"
                    value={String(rule.priority)}
                    onChange={(value) =>
                      updateRedirectRule(index, {
                        ...rule,
                        priority: toNumber(value),
                      })
                    }
                  />
                  <div className="flex items-end">
                    <ActionButton variant="secondary" onClick={() => removeRedirectRule(index)}>
                      Remover
                    </ActionButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <ActionButton className="mt-5" variant="secondary" onClick={addRedirectRule}>
            Adicionar categoria
          </ActionButton>
        </SettingsCard>
      </div>

      <div className={activeSection === 'importation' ? '' : 'hidden'}>
        <SettingsCard
          eyebrow="Radar USA"
          title="Configuração Financeira USA"
          description="Parâmetros editáveis para a futura composição do custo de importação dos Estados Unidos."
        >
          <div className="mb-5 flex flex-col gap-3 border-b border-inest-line pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-inest-muted">Última atualização</p>
              <p className="mt-1 text-sm font-bold text-inest-text">
                {formatLastUpdated(settings.usaFinancial.lastUpdated)}
              </p>
            </div>
            <StatusBadge tone="blue">USD / Importação</StatusBadge>
          </div>

          <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <CurrencyInput
              label="Cotação do dólar"
              value={settings.usaFinancial.dollarQuote}
              onChange={(event) => updateUsaFinancial('dollarQuote', toNumber(event.target.value))}
            />
            <CurrencyInput
              label="Frete Aéreo"
              value={settings.usaFinancial.airFreight}
              onChange={(event) => updateUsaFinancial('airFreight', toNumber(event.target.value))}
            />
            <PercentageInput
              label="Desconto no frete"
              value={settings.usaFinancial.freightDiscountPercent}
              onChange={(event) =>
                updateUsaFinancial('freightDiscountPercent', toNumber(event.target.value))
              }
            />
            <CurrencyInput
              label="Taxa administrativa"
              value={settings.usaFinancial.administrativeFee}
              onChange={(event) =>
                updateUsaFinancial('administrativeFee', toNumber(event.target.value))
              }
            />
            <CurrencyInput
              label="Despachante"
              value={settings.usaFinancial.customsBroker}
              onChange={(event) =>
                updateUsaFinancial('customsBroker', toNumber(event.target.value))
              }
            />
            <CurrencyInput
              label="Seguro"
              value={settings.usaFinancial.insurance}
              onChange={(event) => updateUsaFinancial('insurance', toNumber(event.target.value))}
            />
            <CurrencyInput
              label="Etiqueta"
              value={settings.usaFinancial.label}
              onChange={(event) => updateUsaFinancial('label', toNumber(event.target.value))}
            />
            <PercentageInput
              label="Nota Fiscal"
              value={settings.usaFinancial.invoiceTaxPercent}
              onChange={(event) =>
                updateUsaFinancial('invoiceTaxPercent', toNumber(event.target.value))
              }
            />
            <CurrencyInput
              label="IOF"
              value={settings.usaFinancial.iof}
              onChange={(event) => updateUsaFinancial('iof', toNumber(event.target.value))}
            />
            <CurrencyInput
              label="Outras despesas"
              value={settings.usaFinancial.otherExpenses}
              onChange={(event) =>
                updateUsaFinancial('otherExpenses', toNumber(event.target.value))
              }
            />
          </div>

          <div className="mt-6 grid gap-2 border-t border-inest-line pt-4 sm:flex sm:justify-end">
            <ActionButton
              variant="secondary"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => void reload()}
              disabled={saving}
            >
              Restaurar valores salvos
            </ActionButton>
            <ActionButton
              className="min-h-11 w-full sm:w-auto"
              onClick={() => void save(settings)}
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar configuração USA'}
            </ActionButton>
          </div>
        </SettingsCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className={activeSection === 'offers' ? '' : 'hidden'}>
          <SettingsCard
            eyebrow="Ofertas"
            title="Configurações de oferta"
            description="Textos padrão consumidos futuramente pelo Gerador de Ofertas."
          >
            <div className="grid gap-4">
              <TextInput
                label="Garantia padrão"
                value={settings.offers.defaultWarranty}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    offers: { ...current.offers, defaultWarranty: value },
                  }))
                }
              />
              <TextInput
                label="Prazo padrão"
                value={settings.offers.defaultDeadline}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    offers: { ...current.offers, defaultDeadline: value },
                  }))
                }
              />
              <TextArea
                label="Texto padrão da oferta"
                value={settings.offers.defaultOfferText}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    offers: { ...current.offers, defaultOfferText: value },
                  }))
                }
              />
              <TextArea
                label="Rodapé padrão"
                value={settings.offers.defaultFooter}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    offers: { ...current.offers, defaultFooter: value },
                  }))
                }
              />
              <TextArea
                label="Mensagem do WhatsApp"
                value={settings.offers.whatsappMessage}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    offers: { ...current.offers, whatsappMessage: value },
                  }))
                }
              />
            </div>
          </SettingsCard>
        </div>

        <div className={activeSection === 'general' ? '' : 'hidden'}>
          <SettingsCard
            eyebrow="Usuário"
            title="Preferências"
            description="Preferências preparadas para evolução de tema, idioma e formatos."
          >
            <div className="grid gap-4">
              <SelectInput
                label="Tema"
                value={settings.userPreferences.theme}
                options={[
                  ['light', 'Claro'],
                  ['dark', 'Escuro'],
                ]}
                onChange={(value) => {
                  const theme = normalizeThemePreference(value);
                  applyThemePreference(theme);
                  updateSettings((current) => ({
                    ...current,
                    userPreferences: { ...current.userPreferences, theme },
                  }));
                }}
              />
              <SelectInput
                label="Idioma"
                value={settings.userPreferences.language}
                options={[
                  ['pt-BR', 'Português (Brasil)'],
                  ['en-US', 'Inglês (EUA)'],
                  ['es-PY', 'Espanhol (Paraguai)'],
                ]}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    userPreferences: {
                      ...current.userPreferences,
                      language: value as SettingsPayload['userPreferences']['language'],
                    },
                  }))
                }
              />
              <TextInput
                label="Formato monetário"
                value={settings.userPreferences.currencyFormat}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    userPreferences: { ...current.userPreferences, currencyFormat: value },
                  }))
                }
              />
              <TextInput
                label="Formato de data"
                value={settings.userPreferences.dateFormat}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    userPreferences: { ...current.userPreferences, dateFormat: value },
                  }))
                }
              />
            </div>
          </SettingsCard>
        </div>
      </div>

      <div className={activeSection === 'general' ? '' : 'hidden'}>
        <UsersAccessSettingsCard />
      </div>

      <div className={activeSection === 'offers' ? '' : 'hidden'}>
        <OfferTemplatesSettingsCard />
      </div>

      <div className={activeSection === 'offers' ? '' : 'hidden'}>
        <SettingsCard
          eyebrow="Ofertas"
          title="Mensagem de parcelamento"
          description="Template futuro para apresentar as opções de parcelamento ao cliente."
        >
          <TextArea
            label="Template da mensagem"
            value={settings.installmentMessageTemplate}
            onChange={(installmentMessageTemplate) =>
              updateSettings((current) => ({ ...current, installmentMessageTemplate }))
            }
          />
          <p className="mt-3 text-xs font-medium text-inest-muted">
            Placeholders permitidos: {'{{produto}}'}, {'{{cor}}'} e {'{{parcelas}}'}.
          </p>
        </SettingsCard>
      </div>
    </div>
  );
}

function toNumber(value: string) {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatLastUpdated(value?: string) {
  if (!value) {
    return 'Ainda não atualizada';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

interface TextInputProps {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}

function TextInput({ label, value, type = 'text', onChange }: TextInputProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-control"
      />
    </label>
  );
}

interface InstallmentRateInputsProps {
  rates: InstallmentRate[];
  onChange: (installments: number, ratePercent: number) => void;
}

function InstallmentRateInputs({ rates, onChange }: InstallmentRateInputsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {rates.map((rate) => (
        <RateInput
          key={rate.installments}
          label={`${rate.installments}x`}
          value={rate.ratePercent}
          onChange={(ratePercent) => onChange(rate.installments, ratePercent)}
        />
      ))}
    </div>
  );
}

interface RateInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function RateInput({ label, value, onChange }: RateInputProps) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <div className="relative">
        <input
          type="number"
          min="0"
          max="99.999999999"
          step="0.000001"
          value={String(value)}
          onChange={(event) => onChange(toNumber(event.target.value))}
          className="field-control pr-8"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-bold text-inest-muted">
          %
        </span>
      </div>
    </label>
  );
}

interface TextAreaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function TextArea({ label, value, onChange }: TextAreaProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full resize-y rounded-xl border border-inest-line bg-white px-4 py-3 outline-none focus:border-inest-blue"
      />
    </label>
  );
}

interface SelectInputProps {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}

function SelectInput({ label, value, options, onChange }: SelectInputProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-control"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}
