'use client';

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
import { useSettings } from '../hooks/useSettings';
import { ImportRedirectRule, SettingsPayload } from '../types/settings';

export function SettingsPageContent() {
  const { settings, setSettings, loading, saving, error, success, save, resetDefaults } =
    useSettings();

  if (loading) {
    return (
      <div className="grid gap-6">
        <PageHeader
          eyebrow="Sistema"
          title="Configuracoes"
          description="Carregando parametros globais da aplicacao."
        />
        <LoadingState />
      </div>
    );
  }

  if (!settings) {
    return (
      <ErrorState
        title="Configuracoes indisponiveis"
        description={error ?? 'Nao foi possivel carregar os parametros do sistema.'}
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

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Sistema"
        title="Configuracoes"
        description="Fonte unica dos parametros gerais, financeiros, operacionais e comerciais da plataforma."
        actions={
          <>
            {success ? <StatusBadge tone="green">{success}</StatusBadge> : null}
            <ActionButton
              variant="secondary"
              onClick={() => void resetDefaults()}
              disabled={saving}
            >
              Restaurar padroes
            </ActionButton>
            <ActionButton onClick={() => void save(settings)} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alteracoes'}
            </ActionButton>
          </>
        }
      />

      {error ? <ErrorState title="Atencao" description={error} /> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <SettingsCard
          eyebrow="Dados gerais"
          title="Configuracoes gerais"
          description="Dados institucionais utilizados como referencia em toda a aplicacao."
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

        <SettingsCard
          eyebrow="Precificacao"
          title="Configuracao financeira"
          description="Parametros financeiros globais que serao consumidos pela precificacao."
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
              label="Frete Padrao"
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
              label="Taxa Padrao"
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
              label="Margem padrao"
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
              label="Desconto padrao"
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

      <SettingsCard
        eyebrow="Radar de Importacao"
        title="Custos operacionais de importacao"
        description="Parametros que serao utilizados pelo Radar de Importacao em etapa futura."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <CurrencyInput
            label="Cotacao do Dolar"
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
            label="Saida de CDE"
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
            <span>Acoes</span>
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
                  label="Termos separados por virgula"
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

      <div className="grid gap-6 xl:grid-cols-2">
        <SettingsCard
          eyebrow="Ofertas"
          title="Configuracoes de oferta"
          description="Textos padrao consumidos futuramente pelo Gerador de Ofertas."
        >
          <div className="grid gap-4">
            <TextInput
              label="Garantia padrao"
              value={settings.offers.defaultWarranty}
              onChange={(value) =>
                updateSettings((current) => ({
                  ...current,
                  offers: { ...current.offers, defaultWarranty: value },
                }))
              }
            />
            <TextInput
              label="Prazo padrao"
              value={settings.offers.defaultDeadline}
              onChange={(value) =>
                updateSettings((current) => ({
                  ...current,
                  offers: { ...current.offers, defaultDeadline: value },
                }))
              }
            />
            <TextArea
              label="Texto padrao da oferta"
              value={settings.offers.defaultOfferText}
              onChange={(value) =>
                updateSettings((current) => ({
                  ...current,
                  offers: { ...current.offers, defaultOfferText: value },
                }))
              }
            />
            <TextArea
              label="Rodape padrao"
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

        <SettingsCard
          eyebrow="Usuario"
          title="Preferencias"
          description="Preferencias preparadas para evolucao de tema, idioma e formatos."
        >
          <div className="grid gap-4">
            <SelectInput
              label="Tema"
              value={settings.userPreferences.theme}
              options={[
                ['light', 'Claro'],
                ['dark', 'Escuro'],
                ['system', 'Sistema'],
              ]}
              onChange={(value) =>
                updateSettings((current) => ({
                  ...current,
                  userPreferences: {
                    ...current.userPreferences,
                    theme: value as SettingsPayload['userPreferences']['theme'],
                  },
                }))
              }
            />
            <SelectInput
              label="Idioma"
              value={settings.userPreferences.language}
              options={[
                ['pt-BR', 'Portugues (Brasil)'],
                ['en-US', 'Ingles (EUA)'],
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
              label="Formato monetario"
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
  );
}

function toNumber(value: string) {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
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
