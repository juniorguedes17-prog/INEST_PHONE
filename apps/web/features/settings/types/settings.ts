export interface GeneralSettings {
  companyName: string;
  tradeName: string;
  cnpj: string;
  email: string;
  mainWhatsapp: string;
  city: string;
  state: string;
}

export interface FinancialSettings {
  globalFixedCost: number;
  defaultFreight: number;
  defaultPaymentFee: number;
  defaultMargin: number;
  defaultDiscount: number;
}

export interface PricingSettings {
  offerIncrement: number;
  commercialRoundingEnding1: number;
  commercialRoundingEnding2: number;
  nonAppleElectronicsPolicy: NonAppleElectronicsPolicy;
}

export interface NonAppleElectronicsProfitBand {
  id: string;
  profitPercentOnCost: number | null;
  fixedProfit: number | null;
  minimumProfit: number | null;
}

export interface NonAppleElectronicsFixedCostBand {
  id: string;
  fixedCost: number;
}

export interface NonAppleElectronicsPolicy {
  version: '1.0.0';
  profitBands: NonAppleElectronicsProfitBand[];
  fixedCostBands: NonAppleElectronicsFixedCostBand[];
}

export interface ImportRedirectRule {
  productType: string;
  matchTerms: string[];
  redirectCost: number;
  priority: number;
}

export interface ImportSettings {
  dollarQuote: number;
  cdeExitPerBox: number;
  brazilDispatchPerBox: number;
  correiosLabel: number;
  invoiceTaxPercent: number;
  redirectRules: ImportRedirectRule[];
}

export interface UsaFinancialSettings {
  dollarQuote: number;
  airFreight: number;
  freightDiscountPercent: number;
  administrativeFee: number;
  customsBroker: number;
  insurance: number;
  label: number;
  invoiceTaxPercent: number;
  iof: number;
  otherExpenses: number;
  lastUpdated?: string;
}

export interface OfferSettings {
  defaultWarranty: string;
  defaultDeadline: string;
  defaultOfferText: string;
  defaultFooter: string;
  whatsappMessage: string;
}

export interface InstallmentRate {
  installments: number;
  ratePercent: number;
}

export interface InstallmentRates {
  infinityPay: {
    debitRatePercent: number;
    installments: InstallmentRate[];
  };
  pagBank: {
    installments: InstallmentRate[];
  };
  nubank: {
    installments: InstallmentRate[];
  };
}

export interface UserPreferences {
  theme: ThemePreference;
  language: 'pt-BR' | 'en-US' | 'es-PY';
  currencyFormat: string;
  dateFormat: string;
}

export interface SettingsPayload {
  general: GeneralSettings;
  financial: FinancialSettings;
  pricing: PricingSettings;
  importation: ImportSettings;
  usaFinancial: UsaFinancialSettings;
  offers: OfferSettings;
  installmentRates: InstallmentRates;
  installmentMessageTemplate: string;
  userPreferences: UserPreferences;
}
import type { ThemePreference } from '@/lib/theme-preference';
