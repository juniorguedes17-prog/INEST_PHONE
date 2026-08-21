export interface TradeInAmount {
  cents: number;
  error: string | null;
}

export function parseTradeInAmount(value: string): TradeInAmount {
  const normalized = value.trim();
  if (!normalized) return { cents: 0, error: null };
  if (normalized.includes('-')) return invalidTradeInAmount();

  const numeric = toNumericAmount(normalized);
  if (!Number.isFinite(numeric) || numeric < 0) return invalidTradeInAmount();

  const cents = Math.round(numeric * 100);
  return Number.isSafeInteger(cents) ? { cents, error: null } : invalidTradeInAmount();
}

export function getRemainingAmountCents(
  offerPriceCents: number,
  tradeInAmountCents: number,
): TradeInAmount {
  if (!Number.isSafeInteger(offerPriceCents) || offerPriceCents < 0) return invalidTradeInAmount();
  if (!Number.isSafeInteger(tradeInAmountCents) || tradeInAmountCents < 0) {
    return invalidTradeInAmount();
  }
  if (tradeInAmountCents > offerPriceCents) {
    return {
      cents: 0,
      error: 'O valor do aparelho de entrada não pode superar o valor da oferta.',
    };
  }

  return { cents: offerPriceCents - tradeInAmountCents, error: null };
}

export function formatTradeInAmountInput(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function toNumericAmount(value: string) {
  const withoutCurrency = value.replace(/R\$|\s/g, '');
  if (!/^[\d.,]+$/.test(withoutCurrency)) return Number.NaN;

  if (withoutCurrency.includes(',')) {
    return Number(withoutCurrency.replace(/\./g, '').replace(',', '.'));
  }

  const dotParts = withoutCurrency.split('.');
  if (dotParts.length > 2 || (dotParts.length === 2 && dotParts[1]!.length === 3)) {
    return Number(withoutCurrency.replace(/\./g, ''));
  }

  return Number(withoutCurrency);
}

function invalidTradeInAmount(): TradeInAmount {
  return { cents: 0, error: 'Informe um valor de entrada válido.' };
}
