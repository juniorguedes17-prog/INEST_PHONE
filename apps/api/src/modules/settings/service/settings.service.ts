import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  COMMERCIAL_ROUNDING_ENDING_ONE_KEY,
  COMMERCIAL_ROUNDING_ENDING_TWO_KEY,
  hasValidCommercialPriceEndings,
  normalizeCommercialPriceEndings,
  PRICING_CONFIGURATION_SCOPE,
} from '../../pricing/utils/commercial-price-rounding';
import { UpdateSettingsDto } from '../dto/settings.dto';
import { SettingsRepository } from '../repository/settings.repository';
import { defaultSettings } from '../settings.defaults';
import { toNumber } from '../validators/settings.validators';

@Injectable()
export class SettingsService {
  constructor(@Inject(SettingsRepository) private readonly settingsRepository: SettingsRepository) {}

  async getSettings(): Promise<Required<UpdateSettingsDto>> {
    const [systemConfigurations, financialConfiguration, importConfiguration, pricingConfigurations] = await Promise.all([
      this.settingsRepository.findSystemConfigurations(),
      this.settingsRepository.findFinancialConfiguration(),
      this.settingsRepository.findImportConfiguration(),
      this.settingsRepository.findSystemConfigurations(PRICING_CONFIGURATION_SCOPE),
    ]);

    const system = Object.fromEntries(systemConfigurations.map((item) => [item.key, item.value]));

    return {
      general: {
        ...defaultSettings.general,
        companyName: system.companyName ?? defaultSettings.general.companyName,
        tradeName: system.tradeName ?? defaultSettings.general.tradeName,
        cnpj: system.cnpj ?? defaultSettings.general.cnpj,
        email: system.email ?? defaultSettings.general.email,
        mainWhatsapp: system.mainWhatsapp ?? defaultSettings.general.mainWhatsapp,
        city: system.city ?? defaultSettings.general.city,
        state: system.state ?? defaultSettings.general.state,
      },
      financial: financialConfiguration
        ? {
            globalFixedCost: toNumber(financialConfiguration.fixedCost),
            defaultFreight: toNumber(financialConfiguration.freight),
            defaultPaymentFee: toNumber(financialConfiguration.paymentFee),
            defaultMargin: toNumber(financialConfiguration.desiredNetProfit),
            defaultDiscount: toNumber(financialConfiguration.discount),
          }
        : defaultSettings.financial,
      pricing: this.getPricingSettings(pricingConfigurations),
      importation: importConfiguration
        ? {
            dollarQuote: toNumber(importConfiguration.dollarQuote),
            cdeExitPerBox: toNumber(importConfiguration.cdeExitPerBox),
            brazilDispatchPerBox: toNumber(importConfiguration.brazilDispatchPerBox),
            invoiceTaxPercent: toNumber(importConfiguration.invoiceTaxPercent),
            correiosLabel: toNumber(importConfiguration.correiosLabel),
            redirectRules:
              importConfiguration.redirectRules?.map((rule) => ({
                productType: rule.productType,
                matchTerms: Array.isArray(rule.matchTerms) ? (rule.matchTerms as string[]) : [],
                redirectCost: toNumber(rule.redirectCost),
                priority: rule.priority,
              })) ?? defaultSettings.importation.redirectRules,
          }
        : defaultSettings.importation,
      usaFinancial: {
        dollarQuote: toNumber(system.usaDollarQuote ?? defaultSettings.usaFinancial.dollarQuote),
        airFreight: toNumber(system.usaAirFreight ?? defaultSettings.usaFinancial.airFreight),
        freightDiscountPercent: toNumber(
          system.usaFreightDiscountPercent ?? defaultSettings.usaFinancial.freightDiscountPercent,
        ),
        administrativeFee: toNumber(
          system.usaAdministrativeFee ?? defaultSettings.usaFinancial.administrativeFee,
        ),
        customsBroker: toNumber(
          system.usaCustomsBroker ?? defaultSettings.usaFinancial.customsBroker,
        ),
        insurance: toNumber(system.usaInsurance ?? defaultSettings.usaFinancial.insurance),
        label: toNumber(system.usaLabel ?? defaultSettings.usaFinancial.label),
        invoiceTaxPercent: toNumber(
          system.usaInvoiceTaxPercent ?? defaultSettings.usaFinancial.invoiceTaxPercent,
        ),
        iof: toNumber(system.usaIof ?? defaultSettings.usaFinancial.iof),
        otherExpenses: toNumber(
          system.usaOtherExpenses ?? defaultSettings.usaFinancial.otherExpenses,
        ),
        lastUpdated: system.usaFinancialLastUpdated || undefined,
      },
      offers: {
        ...defaultSettings.offers,
        defaultWarranty: system.defaultWarranty ?? defaultSettings.offers.defaultWarranty,
        defaultDeadline: system.defaultDeadline ?? defaultSettings.offers.defaultDeadline,
        defaultOfferText: system.defaultOfferText ?? defaultSettings.offers.defaultOfferText,
        defaultFooter: system.defaultFooter ?? defaultSettings.offers.defaultFooter,
        whatsappMessage: system.whatsappMessage ?? defaultSettings.offers.whatsappMessage,
      },
      userPreferences: {
        ...defaultSettings.userPreferences,
        theme: this.parseTheme(system.theme),
        language: this.parseLanguage(system.language),
        currencyFormat: system.currencyFormat ?? defaultSettings.userPreferences.currencyFormat,
        dateFormat: system.dateFormat ?? defaultSettings.userPreferences.dateFormat,
      },
    };
  }

  async updateSettings(settings: UpdateSettingsDto, user?: AuthenticatedUser) {
    const oldValue = await this.getSettings();
    const nextSettings = {
      general: settings.general ?? oldValue.general,
      financial: settings.financial ?? oldValue.financial,
      pricing: settings.pricing ?? oldValue.pricing,
      importation: settings.importation ?? oldValue.importation,
      usaFinancial: settings.usaFinancial
        ? { ...settings.usaFinancial, lastUpdated: new Date().toISOString() }
        : oldValue.usaFinancial,
      offers: settings.offers ?? oldValue.offers,
      userPreferences: settings.userPreferences ?? oldValue.userPreferences,
    };

    this.assertValidPricingSettings(nextSettings.pricing);
    await this.persistSystemSettings(nextSettings);
    await this.persistPricingSettings(nextSettings.pricing);
    await this.settingsRepository.upsertFinancialConfiguration(nextSettings.financial, user?.id);
    await this.settingsRepository.upsertImportConfiguration(nextSettings.importation);

    const newValue = await this.getSettings();
    await this.settingsRepository.createAuditLog({
      userId: user?.id,
      oldValue,
      newValue,
      context: {
        event: 'settings.updated',
      },
    });

    return newValue;
  }

  async resetDefaults(user?: AuthenticatedUser) {
    const oldValue = await this.getSettings();

    await this.settingsRepository.deleteSystemConfigurations();
    await this.persistSystemSettings(defaultSettings);
    await this.persistPricingSettings(defaultSettings.pricing);
    await this.settingsRepository.upsertFinancialConfiguration(defaultSettings.financial, user?.id);
    await this.settingsRepository.upsertImportConfiguration(defaultSettings.importation);

    await this.settingsRepository.createAuditLog({
      userId: user?.id,
      oldValue,
      newValue: defaultSettings,
      context: {
        event: 'settings.reset_defaults',
      },
    });

    return this.getSettings();
  }

  private async persistSystemSettings(settings: Required<UpdateSettingsDto>) {
    const entries: Array<[string, string, string]> = [
      ['companyName', settings.general.companyName, 'texto'],
      ['tradeName', settings.general.tradeName, 'texto'],
      ['cnpj', settings.general.cnpj, 'texto'],
      ['email', settings.general.email, 'email'],
      ['mainWhatsapp', settings.general.mainWhatsapp, 'texto'],
      ['city', settings.general.city, 'texto'],
      ['state', settings.general.state, 'texto'],
      ['defaultWarranty', settings.offers.defaultWarranty, 'texto'],
      ['defaultDeadline', settings.offers.defaultDeadline, 'texto'],
      ['defaultOfferText', settings.offers.defaultOfferText, 'texto_longo'],
      ['defaultFooter', settings.offers.defaultFooter, 'texto_longo'],
      ['whatsappMessage', settings.offers.whatsappMessage, 'texto_longo'],
      ['theme', settings.userPreferences.theme, 'texto'],
      ['language', settings.userPreferences.language, 'texto'],
      ['currencyFormat', settings.userPreferences.currencyFormat, 'texto'],
      ['dateFormat', settings.userPreferences.dateFormat, 'texto'],
      ['usaDollarQuote', String(settings.usaFinancial.dollarQuote), 'moeda'],
      ['usaAirFreight', String(settings.usaFinancial.airFreight), 'moeda'],
      [
        'usaFreightDiscountPercent',
        String(settings.usaFinancial.freightDiscountPercent),
        'percentual',
      ],
      ['usaAdministrativeFee', String(settings.usaFinancial.administrativeFee), 'moeda'],
      ['usaCustomsBroker', String(settings.usaFinancial.customsBroker), 'moeda'],
      ['usaInsurance', String(settings.usaFinancial.insurance), 'moeda'],
      ['usaLabel', String(settings.usaFinancial.label), 'moeda'],
      ['usaInvoiceTaxPercent', String(settings.usaFinancial.invoiceTaxPercent), 'percentual'],
      ['usaIof', String(settings.usaFinancial.iof), 'moeda'],
      ['usaOtherExpenses', String(settings.usaFinancial.otherExpenses), 'moeda'],
      ['usaFinancialLastUpdated', settings.usaFinancial.lastUpdated ?? '', 'data_hora'],
    ];

    await Promise.all(
      entries.map(([key, value, type]) =>
        this.settingsRepository.upsertSystemConfiguration(key, value, type),
      ),
    );
  }

  private getPricingSettings(pricingConfigurations: Array<{ key: string; value: string }>) {
    const endings = normalizeCommercialPriceEndings([
      pricingConfigurations.find((item) => item.key === COMMERCIAL_ROUNDING_ENDING_ONE_KEY)?.value,
      pricingConfigurations.find((item) => item.key === COMMERCIAL_ROUNDING_ENDING_TWO_KEY)?.value,
    ]);

    return {
      commercialRoundingEnding1: endings[0]!,
      commercialRoundingEnding2: endings[1]!,
    };
  }

  private async persistPricingSettings(settings: Required<UpdateSettingsDto>['pricing']) {
    const endings = this.assertValidPricingSettings(settings);

    await Promise.all([
      this.settingsRepository.upsertSystemConfiguration(
        COMMERCIAL_ROUNDING_ENDING_ONE_KEY,
        String(endings[0]!),
        'numero',
        PRICING_CONFIGURATION_SCOPE,
      ),
      this.settingsRepository.upsertSystemConfiguration(
        COMMERCIAL_ROUNDING_ENDING_TWO_KEY,
        String(endings[1]!),
        'numero',
        PRICING_CONFIGURATION_SCOPE,
      ),
    ]);
  }

  private assertValidPricingSettings(settings: Required<UpdateSettingsDto>['pricing']) {
    const endings = [settings.commercialRoundingEnding1, settings.commercialRoundingEnding2];
    if (!hasValidCommercialPriceEndings(endings)) {
      throw new BadRequestException(
        'Os finais comerciais devem ser inteiros diferentes entre 0 e 99.',
      );
    }

    return endings;
  }

  private parseTheme(value?: string) {
    if (value === 'light' || value === 'dark' || value === 'system') {
      return value;
    }

    return defaultSettings.userPreferences.theme;
  }

  private parseLanguage(value?: string) {
    if (value === 'pt-BR' || value === 'en-US' || value === 'es-PY') {
      return value;
    }

    return defaultSettings.userPreferences.language;
  }
}
