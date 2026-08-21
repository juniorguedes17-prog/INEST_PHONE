import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatTradeInAmountInput,
  getRemainingAmountCents,
  parseTradeInAmount,
} from './installment-trade-in';
import type { InstallmentRates } from '@/features/settings/types/settings';
import { simulateInstallments } from './installment-simulation';

const rates: InstallmentRates = {
  infinityPay: {
    debitRatePercent: 1.37,
    installments: Array.from({ length: 12 }, (_, index) => ({
      installments: index + 1,
      ratePercent: 3,
    })),
  },
  pagBank: {
    installments: Array.from({ length: 18 }, (_, index) => ({
      installments: index + 1,
      ratePercent: 4,
    })),
  },
  nubank: {
    installments: Array.from({ length: 12 }, (_, index) => ({
      installments: index + 1,
      ratePercent: 5,
    })),
  },
};

test('keeps the full offer amount when there is no trade-in', () => {
  const tradeIn = parseTradeInAmount('0,00');
  const remaining = getRemainingAmountCents(534900, tradeIn.cents);

  assert.equal(tradeIn.error, null);
  assert.equal(remaining.error, null);
  assert.equal(remaining.cents, 534900);
  assert.deepEqual(
    simulateInstallments(534900, rates),
    simulateInstallments(remaining.cents, rates),
  );
});

test('derives the balance in cents from a valid trade-in amount', () => {
  const tradeIn = parseTradeInAmount('2.000,00');
  const remaining = getRemainingAmountCents(534900, tradeIn.cents);

  assert.equal(tradeIn.cents, 200000);
  assert.equal(remaining.cents, 334900);
  assert.equal(formatTradeInAmountInput(remaining.cents), '3.349,00');
});

test('allows a full trade-in without creating a negative balance', () => {
  const remaining = getRemainingAmountCents(534900, 534900);

  assert.equal(remaining.error, null);
  assert.equal(remaining.cents, 0);
});

test('rejects invalid and greater-than-offer trade-in values', () => {
  assert.notEqual(parseTradeInAmount('-10').error, null);
  assert.notEqual(parseTradeInAmount('infinito').error, null);
  assert.notEqual(parseTradeInAmount('entrada').error, null);
  assert.notEqual(getRemainingAmountCents(534900, 535000).error, null);
});
