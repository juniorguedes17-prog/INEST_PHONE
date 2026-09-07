import type { UsaSourceProduct } from './usa-source-product.adapter';

/** Compact public product text only; never forward markup or executable content. */
export function compactSourceEvidence(value: string): string {
  return value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
}

export function sourceSemanticText(product: UsaSourceProduct): string {
  return [product.sourceName, compactSourceEvidence(product.sourceEvidence ?? '')]
    .filter(Boolean)
    .join(' ');
}
