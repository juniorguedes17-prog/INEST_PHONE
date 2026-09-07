import { ServiceUnavailableException } from '@nestjs/common';
import type { UsaSourceProduct } from './usa-source-product.adapter';

export type UsaProviderStatus = 'OK' | 'EMPTY' | 'UNAVAILABLE' | 'RATE_LIMITED';
export interface UsaProviderReport {
  provider: string;
  status: UsaProviderStatus;
  returnedCount: number;
  diagnostics?: Record<string, unknown>;
}
export interface UsaSearchResult {
  products: UsaSourceProduct[];
  providers: UsaProviderReport[];
}
export interface UsaProviderSearchResult {
  products: UsaSourceProduct[];
  report: UsaProviderReport;
}
export class UsaProviderUnavailable extends ServiceUnavailableException {
  constructor(readonly report: UsaProviderReport) {
    super('Fonte USA indisponível no momento.');
  }
}
