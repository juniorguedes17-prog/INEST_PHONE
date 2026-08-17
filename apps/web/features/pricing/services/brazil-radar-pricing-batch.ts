import { BrazilRadarQuotePricing } from '../types/pricing';

export interface BrazilRadarQuoteForBatch {
  id: string;
  source?: 'CATALOG' | 'BRAZIL_RADAR';
  sourceQuoteId?: string;
}

export interface BrazilRadarPricingBatchResult {
  items: BrazilRadarQuotePricing[];
  successfulQuoteIds: string[];
  failedQuoteIds: string[];
  errors: string[];
}

export async function prepareBrazilRadarPricingBatch(
  quotes: BrazilRadarQuoteForBatch[],
  calculate: (sourceQuoteId: string) => Promise<BrazilRadarQuotePricing>,
): Promise<BrazilRadarPricingBatchResult> {
  const items: BrazilRadarQuotePricing[] = [];
  const successfulQuoteIds: string[] = [];
  const failedQuoteIds: string[] = [];
  const errors: string[] = [];
  const processedSourceQuoteIds = new Set<string>();

  for (const quote of quotes) {
    if (quote.source !== 'BRAZIL_RADAR' || !quote.sourceQuoteId) {
      failedQuoteIds.push(quote.id);
      errors.push('Cotacao do Radar Brasil sem identificador de origem.');
      continue;
    }

    if (processedSourceQuoteIds.has(quote.sourceQuoteId)) {
      successfulQuoteIds.push(quote.id);
      continue;
    }

    processedSourceQuoteIds.add(quote.sourceQuoteId);
    try {
      items.push(await calculate(quote.sourceQuoteId));
      successfulQuoteIds.push(quote.id);
    } catch (error) {
      failedQuoteIds.push(quote.id);
      errors.push(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel enviar uma cotacao para Precificacao.',
      );
    }
  }

  return { items, successfulQuoteIds, failedQuoteIds, errors };
}
