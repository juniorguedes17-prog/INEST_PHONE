import type { ImportSettingsDto } from '../settings/dto/settings.dto';
import type { ImportProductDto } from './dto/import-radar.dto';
import {
  identifyRedirectRule,
  roundMoneyToCents,
  toNumber,
} from './validators/import-radar.validators';

/**
 * Existing Radar PY operational charges, projected without the product value.
 * The caller owns the conversion authority for the product price.
 */
export function calculateImportOperationalCosts(
  product: Pick<ImportProductDto, 'name' | 'category'>,
  convertedProductPriceRaw: number,
  settings: ImportSettingsDto,
) {
  const redirectRule = identifyRedirectRule(product, settings);
  const cdeExit = roundMoneyToCents(toNumber(settings.cdeExitPerBox));
  const redirectCost = roundMoneyToCents(toNumber(redirectRule?.redirectCost));
  const brazilDispatch = roundMoneyToCents(toNumber(settings.brazilDispatchPerBox));
  const invoiceTax = roundMoneyToCents(
    convertedProductPriceRaw * (toNumber(settings.invoiceTaxPercent) / 100),
  );
  const correiosLabel = roundMoneyToCents(toNumber(settings.correiosLabel));
  const operationalSubtotal = roundMoneyToCents(
    cdeExit + redirectCost + brazilDispatch + invoiceTax + correiosLabel,
  );

  return {
    matchedProductType: redirectRule?.productType ?? 'Nao identificado',
    cdeExit,
    redirectCost,
    brazilDispatch,
    invoiceTax,
    correiosLabel,
    operationalSubtotal,
  };
}
