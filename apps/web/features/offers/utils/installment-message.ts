import {
  DebitSimulationOption,
  InstallmentSimulationOption,
  ProviderSimulation,
} from './installment-simulation';
import { formatColorLabel } from './color-label';

export function renderInstallmentMessage(
  template: string,
  values: {
    productName: string;
    color: string;
    simulation: ProviderSimulation;
    tradeIn?: {
      offerPriceCents: number;
      tradeInAmountCents: number;
      remainingAmountCents: number;
    };
  },
) {
  const tradeInBlock = values.tradeIn ? formatTradeInBlock(values.tradeIn) : '';
  const hasColorPlaceholder = /\{\{cor\}\}/.test(template);
  const withTradeIn = hasColorPlaceholder
    ? template.replace(
        /\{\{cor\}\}/g,
        `${formatColorLabel(values.color) || 'Sem cor informada'}${tradeInBlock}`,
      )
    : `${template}${tradeInBlock}`;

  return withTradeIn
    .replace(/\{\{produto\}\}/g, values.productName)
    .replace(/\{\{parcelas\}\}/g, formatInstallmentLines(values.simulation))
    .trim();
}

export function formatCurrencyCents(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
}

export function getInstallmentWhatsappUrl(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function formatInstallmentOption(option: InstallmentSimulationOption) {
  const firstAmount = option.installmentAmountsCents[0];
  const lastAmount = option.installmentAmountsCents.at(-1);
  if (firstAmount === undefined || lastAmount === undefined) return `${option.installments}x`;

  if (firstAmount === lastAmount) {
    return `${option.installments}x de ${formatCurrencyCents(firstAmount)}`;
  }

  return `${option.installments}x: ${option.installments - 1}x de ${formatCurrencyCents(firstAmount)} + última de ${formatCurrencyCents(lastAmount)}`;
}

export function formatDebitOption(option: DebitSimulationOption) {
  return `Débito: ${formatCurrencyCents(option.totalAmountCents)}`;
}

function formatInstallmentLines(simulation: ProviderSimulation) {
  const debit = simulation.debitOption
    ? [`• *Débito:* ${formatCurrencyCents(simulation.debitOption.totalAmountCents)}`, '']
    : [];
  const installments = simulation.options.map(
    (option) =>
      `• *${option.installments}x* de ${formatCurrencyCents(option.installmentAmountsCents[0]!)}`,
  );

  return [...debit, '*Parcelado no Cartão:*', ...installments].join('\n');
}

function formatTradeInBlock(
  values: NonNullable<Parameters<typeof renderInstallmentMessage>[1]['tradeIn']>,
) {
  return `\n\n💰 *Valor do aparelho:* ${formatCurrencyCents(values.offerPriceCents)}\n🔄 *Seu aparelho na troca:* ${formatCurrencyCents(values.tradeInAmountCents)}\n*Saldo a pagar:* ${formatCurrencyCents(values.remainingAmountCents)}`;
}
