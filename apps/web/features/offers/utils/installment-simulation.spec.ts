import assert from 'node:assert/strict';
import test from 'node:test';
import type { InstallmentRates } from '@/features/settings/types/settings';
import { simulateInstallments } from './installment-simulation';

const PAGBANK_CALIBRATION_TOTALS = [
  314493, 318800, 321151, 323536, 325888, 328309, 330874, 333297, 335719, 338177, 340632, 343124,
  345614, 348060, 350582, 353099, 355651, 358200,
];

const desiredAmountCents = 304900;

const rates: InstallmentRates = {
  infinityPay: {
    debitRatePercent: 1.37,
    installments: [{ installments: 1, ratePercent: 5.49 }],
  },
  pagBank: {
    installments: PAGBANK_CALIBRATION_TOTALS.map((totalAmountCents, index) => ({
      installments: index + 1,
      ratePercent: (1 - desiredAmountCents / totalAmountCents) * 100,
    })),
  },
  nubank: {
    installments: [{ installments: 1, ratePercent: 3.09 }],
  },
};

test('applies the gross-up formula with final rounding in cents', () => {
  const infinityPay = simulateInstallments(1000, rates)[0]!;
  const option = infinityPay.options[0]!;

  assert.equal(option.totalAmountCents, 1058);
  assert.deepEqual(option.installmentAmountsCents, [1058]);
});

test('keeps the last installment responsible for the cent remainder', () => {
  const infinityPay = simulateInstallments(10001, {
    ...rates,
    infinityPay: { debitRatePercent: 0, installments: [{ installments: 3, ratePercent: 0 }] },
  })[0]!;
  const option = infinityPay.options[0]!;

  assert.equal(option.totalAmountCents, 10001);
  assert.deepEqual(option.installmentAmountsCents, [3333, 3333, 3335]);
  assert.equal(
    option.installmentAmountsCents.reduce((sum, amount) => sum + amount, 0),
    10001,
  );
});

test('reproduces all PagBank calibration totals within one cent', () => {
  const pagBank = simulateInstallments(desiredAmountCents, rates).find(
    (provider) => provider.provider === 'pagBank',
  )!;

  for (const [index, observedTotal] of PAGBANK_CALIBRATION_TOTALS.entries()) {
    const option = pagBank.options[index]!;
    assert.equal(option.installments, index + 1);
    assert.ok(Math.abs(option.totalAmountCents - observedTotal) <= 1);
    assert.equal(
      option.installmentAmountsCents.reduce((sum, amount) => sum + amount, 0),
      option.totalAmountCents,
    );
  }
});

test('keeps InfinityPay debit separate from installments', () => {
  const infinityPay = simulateInstallments(desiredAmountCents, rates)[0]!;

  assert.equal(infinityPay.debitOption?.kind, 'debit');
  assert.equal(infinityPay.debitOption?.installmentAmountsCents.length, 1);
  assert.equal(
    infinityPay.options.every((option) => option.kind === 'installments'),
    true,
  );
});
