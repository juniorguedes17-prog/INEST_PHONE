import type { InstallmentRate, InstallmentRates } from '@/features/settings/types/settings';

export type InstallmentProvider = 'infinityPay' | 'pagBank' | 'nubank';

export interface DebitSimulationOption {
  kind: 'debit';
  ratePercent: number;
  totalAmountCents: number;
  installmentAmountsCents: [number];
}

export interface InstallmentSimulationOption {
  kind: 'installments';
  installments: number;
  ratePercent: number;
  totalAmountCents: number;
  installmentAmountsCents: number[];
}

export interface ProviderSimulation {
  provider: InstallmentProvider;
  desiredAmountCents: number;
  debitOption?: DebitSimulationOption;
  options: InstallmentSimulationOption[];
}

export function simulateInstallments(
  desiredAmountCents: number,
  providerRates: InstallmentRates,
): ProviderSimulation[] {
  assertDesiredAmount(desiredAmountCents);

  return [
    {
      provider: 'infinityPay',
      desiredAmountCents,
      debitOption: debitOption(desiredAmountCents, providerRates.infinityPay.debitRatePercent),
      options: simulateProviderOptions(desiredAmountCents, providerRates.infinityPay.installments),
    },
    {
      provider: 'pagBank',
      desiredAmountCents,
      options: simulateProviderOptions(desiredAmountCents, providerRates.pagBank.installments),
    },
    {
      provider: 'nubank',
      desiredAmountCents,
      options: simulateProviderOptions(desiredAmountCents, providerRates.nubank.installments),
    },
  ];
}

function debitOption(desiredAmountCents: number, ratePercent: number): DebitSimulationOption {
  const totalAmountCents = calculateTotalAmountCents(desiredAmountCents, ratePercent);
  return {
    kind: 'debit',
    ratePercent,
    totalAmountCents,
    installmentAmountsCents: [totalAmountCents],
  };
}

function simulateProviderOptions(
  desiredAmountCents: number,
  rates: InstallmentRate[],
): InstallmentSimulationOption[] {
  return rates.map(({ installments, ratePercent }) => {
    assertInstallmentRate(installments, ratePercent);
    const totalAmountCents = calculateTotalAmountCents(desiredAmountCents, ratePercent);

    return {
      kind: 'installments',
      installments,
      ratePercent,
      totalAmountCents,
      installmentAmountsCents: splitInInstallments(totalAmountCents, installments),
    };
  });
}

function calculateTotalAmountCents(desiredAmountCents: number, ratePercent: number): number {
  assertRate(ratePercent);
  return Math.round(desiredAmountCents / (1 - ratePercent / 100));
}

function splitInInstallments(totalAmountCents: number, installments: number): number[] {
  const baseAmountCents = Math.floor(totalAmountCents / installments);
  const remainingCents = totalAmountCents - baseAmountCents * installments;

  return Array.from(
    { length: installments },
    (_, index) => baseAmountCents + (index === installments - 1 ? remainingCents : 0),
  );
}

function assertDesiredAmount(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('O valor desejado deve ser informado em centavos inteiros não negativos.');
  }
}

function assertInstallmentRate(installments: number, ratePercent: number) {
  if (!Number.isSafeInteger(installments) || installments < 1) {
    throw new RangeError('A quantidade de parcelas deve ser um inteiro positivo.');
  }

  assertRate(ratePercent);
}

function assertRate(ratePercent: number) {
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent >= 100) {
    throw new RangeError('A taxa deve ser um percentual finito entre 0 e 100.');
  }
}
