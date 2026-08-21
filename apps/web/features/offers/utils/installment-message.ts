import {
  DebitSimulationOption,
  InstallmentSimulationOption,
  ProviderSimulation,
} from './installment-simulation';

export function renderInstallmentMessage(
  template: string,
  values: { productName: string; color: string; simulation: ProviderSimulation },
) {
  return template
    .replace(/\{\{produto\}\}/g, values.productName)
    .replace(/\{\{cor\}\}/g, values.color)
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
  const lines = simulation.debitOption ? [formatDebitOption(simulation.debitOption)] : [];
  return [...lines, ...simulation.options.map(formatInstallmentOption)].join('\n');
}
