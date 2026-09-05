import { ImportSettingsDto } from '../../settings/dto/settings.dto';
import { ImportProductDto } from '../dto/import-radar.dto';

export function identifyRedirectRule(product: ImportProductDto, settings: ImportSettingsDto) {
  const content = normalize(`${product.name} ${product.category}`);

  return [...settings.redirectRules]
    .sort((a, b) => a.priority - b.priority)
    .find((rule) => rule.matchTerms.some((term) => content.includes(normalize(term))));
}

export function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

export function roundMoneyToCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError('Invalid monetary amount');
  }

  const cents = Math.round((value + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError('Monetary amount exceeds safe precision');
  }

  return cents / 100;
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
