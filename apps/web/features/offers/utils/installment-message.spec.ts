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

test('renders the configured template with commercial payment formatting', () => {
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

  const message = renderInstallmentMessage(
    '📱 *{{produto}}*\nCor: {{cor}}\n\n💳 *Condições de Pagamento*\n\n{{parcelas}}\n\nQual dessas opções fica melhor para você?',
    {
      productName: 'iPhone 17 Pro Max 256GB',
      color: 'azul',
      simulation: infinityPay,
    },
  );

  assert.match(message, /📱 \*iPhone 17 Pro Max 256GB\*/);
  assert.match(message, /Cor: 🔵 Azul/);
  assert.match(message, /💳 \*Condições de Pagamento\*/);
  assert.match(message, /• \*Débito:\* R\$/);
  assert.match(message, /• \*12x\* de R\$/);
  assert.match(message, /Qual dessas opções fica melhor para você\?/);
  assert.doesNotMatch(message, /Seu aparelho na troca|Saldo a pagar/);
});

test('encodes the installment message for WhatsApp sharing', () => {
  assert.equal(
    getInstallmentWhatsappUrl('iPhone 17 Pro Max\nAzul & Branco'),
    'https://wa.me/?text=iPhone%2017%20Pro%20Max%0AAzul%20%26%20Branco',
  );
});

test('keeps the cent residual internal while presenting the commercial base installment', () => {
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

  assert.match(message, /• \*3x\* de R\$\s?33,33/);
  assert.doesNotMatch(message, /última de|2x de R\$\s?33,33 \+/);
});

test('adds the trade-in summary without changing the configured template text', () => {
  const simulations = simulateInstallments(334900, rates);
  const infinityPay = simulations.find((item) => item.provider === 'infinityPay');
  assert.ok(infinityPay);

  const message = renderInstallmentMessage('{{produto}}\nCor: {{cor}}\n{{parcelas}}', {
    productName: 'iPhone 16 128GB',
    color: 'branco',
    simulation: infinityPay,
    tradeIn: {
      offerPriceCents: 534900,
      tradeInAmountCents: 200000,
      remainingAmountCents: 334900,
    },
  });

  assert.match(message, /iPhone 16 128GB\nCor: ⚪️ Branco/);
  assert.match(message, /Valor do aparelho:\* R\$\s?5\.349,00/);
  assert.match(message, /Seu aparelho na troca:\* R\$\s?2\.000,00/);
  assert.match(message, /Saldo a pagar:\* R\$\s?3\.349,00/);
  assert.match(message, /• \*1x\* de R\$/);
});
