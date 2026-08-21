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

export const INSTALLMENT_RATES_CONFIGURATION_KEY = 'installmentRates';
export const INSTALLMENT_MESSAGE_TEMPLATE_CONFIGURATION_KEY = 'installmentMessageTemplate';
export const DEFAULT_INSTALLMENT_MESSAGE_TEMPLATE = '{{produto}}\n\n{{cor}}\n\n{{parcelas}}';

const PAGBANK_CALIBRATION_DESIRED_AMOUNT = 3049;
const PAGBANK_CALIBRATION_TOTALS = [
  3144.93, 3188, 3211.51, 3235.36, 3258.88, 3283.09, 3308.74, 3332.97, 3357.19, 3381.77, 3406.32,
  3431.24, 3456.14, 3480.6, 3505.82, 3530.99, 3556.51, 3582,
];

export const DEFAULT_INSTALLMENT_RATES: InstallmentRates = {
  infinityPay: {
    debitRatePercent: 1.37,
    installments: ratesFromPercentages([
      3.15, 5.39, 6.12, 6.85, 7.57, 8.28, 8.99, 9.69, 10.38, 11.06, 11.74, 12.4,
    ]),
  },
  pagBank: {
    installments: PAGBANK_CALIBRATION_TOTALS.map((total, index) => ({
      installments: index + 1,
      ratePercent: (1 - PAGBANK_CALIBRATION_DESIRED_AMOUNT / total) * 100,
    })),
  },
  nubank: {
    installments: ratesFromPercentages([
      3.09, 5.79, 6.09, 7.99, 8.09, 8.19, 9.49, 9.68, 10.37, 11.05, 12.27, 12.38,
    ]),
  },
};

export function isValidInstallmentRates(value: unknown): value is InstallmentRates {
  if (!value || typeof value !== 'object') return false;

  const rates = value as Partial<InstallmentRates>;
  return (
    isValidProvider(rates.infinityPay, 12, true) &&
    isValidProvider(rates.pagBank, 18) &&
    isValidProvider(rates.nubank, 12)
  );
}

export function parseInstallmentRates(value?: string): InstallmentRates {
  if (!value) return cloneDefaultInstallmentRates();

  try {
    const parsed = JSON.parse(value) as unknown;
    return isValidInstallmentRates(parsed) ? parsed : cloneDefaultInstallmentRates();
  } catch {
    return cloneDefaultInstallmentRates();
  }
}

export function hasValidInstallmentMessageTemplate(template: string): boolean {
  if (typeof template !== 'string') return false;

  const placeholders = [...template.matchAll(/{{\s*([^{}]+)\s*}}/g)];
  const validNames = new Set(['produto', 'cor', 'parcelas']);
  const remainder = template.replace(/{{\s*[^{}]+\s*}}/g, '');
  const containsMalformedPlaceholder = remainder.includes('{{') || remainder.includes('}}');

  return (
    !containsMalformedPlaceholder && placeholders.every((match) => validNames.has(match[1]!.trim()))
  );
}

function ratesFromPercentages(percentages: number[]): InstallmentRate[] {
  return percentages.map((ratePercent, index) => ({ installments: index + 1, ratePercent }));
}

function isValidProvider(
  value: InstallmentRates['infinityPay'] | InstallmentRates['pagBank'] | undefined,
  maxInstallments: number,
  requiresDebit = false,
): boolean {
  if (!value || !Array.isArray(value.installments)) return false;
  if (requiresDebit && (!('debitRatePercent' in value) || !isValidRate(value.debitRatePercent))) {
    return false;
  }

  if (value.installments.length !== maxInstallments) return false;
  const installments = new Set<number>();
  for (const rate of value.installments) {
    if (
      !rate ||
      typeof rate !== 'object' ||
      !Number.isInteger(rate.installments) ||
      !isValidRate(rate.ratePercent)
    ) {
      return false;
    }
    if (rate.installments < 1 || rate.installments > maxInstallments) return false;
    installments.add(rate.installments);
  }

  return installments.size === maxInstallments;
}

function isValidRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 100;
}

function cloneDefaultInstallmentRates(): InstallmentRates {
  return JSON.parse(JSON.stringify(DEFAULT_INSTALLMENT_RATES)) as InstallmentRates;
}
