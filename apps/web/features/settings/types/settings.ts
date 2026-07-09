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

export interface OfferSettings {
  defaultWarranty: string;
  defaultDeadline: string;
  defaultOfferText: string;
  defaultFooter: string;
  whatsappMessage: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'pt-BR' | 'en-US' | 'es-PY';
  currencyFormat: string;
  dateFormat: string;
}

export interface SettingsPayload {
  general: GeneralSettings;
  financial: FinancialSettings;
  importation: ImportSettings;
  offers: OfferSettings;
  userPreferences: UserPreferences;
}
