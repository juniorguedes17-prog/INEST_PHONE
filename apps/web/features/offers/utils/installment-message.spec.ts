import assert from 'node:assert/strict';
import test from 'node:test';
import type { InstallmentRates } from '@/features/settings/types/settings';
import { simulateInstallments } from './installment-simulation';
import { getInstallmentWhatsappUrl, renderInstallmentMessage } from './installment-message';

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

test('renders the configured template with the selected provider simulation', () => {
  const simulations = simulateInstallments(10001, rates);
  const infinityPay = simulations.find((item) => item.provider === 'infinityPay');
  const pagBank = simulations.find((item) => item.provider === 'pagBank');
  const nubank = simulations.find((item) => item.provider === 'nubank');
  assert.ok(infinityPay);
  assert.ok(pagBank);
  assert.ok(nubank);
  assert.equal(infinityPay.debitOption?.kind, 'debit');
  assert.equal(infinityPay.options.length, 12);
  assert.equal(pagBank.options.length, 18);
  assert.equal(nubank.options.length, 12);

  const message = renderInstallmentMessage('Produto: {{produto}}\nCor: {{cor}}\n{{parcelas}}', {
    productName: 'iPhone 17 Pro Max 256GB',
    color: 'Azul',
    simulation: infinityPay,
  });

  assert.match(message, /Produto: iPhone 17 Pro Max 256GB/);
  assert.match(message, /Cor: Azul/);
  assert.match(message, /Débito:/);
  assert.match(message, /12x:/);
});

test('encodes the installment message for WhatsApp sharing', () => {
  assert.equal(
    getInstallmentWhatsappUrl('iPhone 17 Pro Max\nAzul & Branco'),
    'https://wa.me/?text=iPhone%2017%20Pro%20Max%0AAzul%20%26%20Branco',
  );
});

test('keeps the final cent residual visible in the message', () => {
  const simulations = simulateInstallments(10001, {
    ...rates,
    infinityPay: { debitRatePercent: 0, installments: [{ installments: 3, ratePercent: 0 }] },
  });
  const infinityPay = simulations.find((item) => item.provider === 'infinityPay');
  assert.ok(infinityPay);

  const message = renderInstallmentMessage('{{parcelas}}', {
    productName: 'Produto',
    color: 'Azul',
    simulation: infinityPay,
  });

  assert.match(message, /3x: 2x de R\$\s?33,33 \+ última de R\$\s?33,35/);
});
