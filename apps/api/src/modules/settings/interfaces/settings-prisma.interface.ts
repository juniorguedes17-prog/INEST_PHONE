export interface SystemConfigurationRecord {
  key: string;
  value: string;
  type: string;
  scope?: string | null;
}

export interface FinancialConfigurationRecord {
  id: string;
  name: string;
  scope: string;
  fixedCost: number | string;
  freight: number | string;
  paymentFee: number | string;
  desiredNetProfit: number | string;
  discount: number | string;
}

export interface ImportFinancialConfigurationRecord {
  id: string;
  name: string;
  dollarQuote: number | string;
  cdeExitPerBox: number | string;
  brazilDispatchPerBox: number | string;
  invoiceTaxPercent: number | string;
  correiosLabel: number | string;
  redirectRules?: ImportRedirectRuleRecord[];
}

export interface ImportRedirectRuleRecord {
  id: string;
  productType: string;
  matchTerms?: unknown;
  redirectCost: number | string;
  priority: number;
}

export interface SettingsPrismaClient {
  systemConfiguration: {
    findMany(args?: unknown): Promise<SystemConfigurationRecord[]>;
    upsert(args: unknown): Promise<SystemConfigurationRecord>;
    deleteMany(args?: unknown): Promise<unknown>;
  };
  financialConfiguration: {
    findFirst(args?: unknown): Promise<FinancialConfigurationRecord | null>;
    upsert(args: unknown): Promise<FinancialConfigurationRecord>;
  };
  importFinancialConfiguration: {
    findFirst(args?: unknown): Promise<ImportFinancialConfigurationRecord | null>;
    upsert(args: unknown): Promise<ImportFinancialConfigurationRecord>;
  };
  importRedirectRule: {
    deleteMany(args?: unknown): Promise<unknown>;
    createMany(args: unknown): Promise<unknown>;
  };
  auditLog?: {
    create(args: unknown): Promise<unknown>;
  };
}
