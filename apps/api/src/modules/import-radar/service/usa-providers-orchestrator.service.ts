import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ImportSearchQueryDto } from '../dto/import-radar.dto';
import { AmazonUsProvider } from '../providers/amazon-us.provider';
import { AppleUsProvider } from '../providers/apple-us.provider';
import { UpcItemDbUsProvider } from '../providers/upcitemdb-us.provider';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import {
  UsaProviderUnavailable,
  type UsaSearchResult,
  type UsaProviderSearchResult,
} from '../usa-search-result';

interface UsaSourceProductProvider {
  readonly name: string;
  searchUsaSourceProducts(query: ImportSearchQueryDto): Promise<UsaSourceProduct[]>;
  searchUsaWithDiagnostics?(query: ImportSearchQueryDto): Promise<UsaProviderSearchResult>;
}

/**
 * Read-only USA discovery fan-out. Each provider owns its own source contract;
 * this service only joins independently successful results. It deliberately
 * does not infer retailer, run TAX/cost logic, or deduplicate offers.
 */
@Injectable()
export class UsaProvidersOrchestrator {
  constructor(
    private readonly appleUsProvider: AppleUsProvider,
    private readonly amazonUsProvider: AmazonUsProvider,
    private readonly upcItemDbUsProvider: UpcItemDbUsProvider,
  ) {}

  async search(query: ImportSearchQueryDto): Promise<UsaSourceProduct[]> {
    return (await this.searchWithDiagnostics(query)).products;
  }

  async searchWithDiagnostics(query: ImportSearchQueryDto): Promise<UsaSearchResult> {
    const providers: readonly UsaSourceProductProvider[] = [
      this.appleUsProvider,
      this.amazonUsProvider,
      this.upcItemDbUsProvider,
    ];
    const results = await Promise.allSettled(
      providers.map((provider) =>
        Promise.resolve().then(async () => {
          if (provider.searchUsaWithDiagnostics) return provider.searchUsaWithDiagnostics(query);
          const products = await provider.searchUsaSourceProducts(query);
          return {
            products,
            report: {
              provider: provider.name,
              status: products.length ? ('OK' as const) : ('EMPTY' as const),
              returnedCount: products.length,
              diagnostics: { scope: 'OFFICIAL_IPHONE_MAC_FAMILY_CARDS' },
            },
          };
        }),
      ),
    );

    const products = results.flatMap((result) =>
      result.status === 'fulfilled' ? result.value.products : [],
    );
    const reports = results.map((result, index) =>
      result.status === 'fulfilled'
        ? result.value.report
        : result.reason instanceof UsaProviderUnavailable
          ? result.reason.report
          : { provider: providers[index]!.name, status: 'UNAVAILABLE' as const, returnedCount: 0 },
    );
    if (
      !products.length &&
      reports.every((report) => report.status === 'UNAVAILABLE' || report.status === 'RATE_LIMITED')
    ) {
      throw new ServiceUnavailableException('Nenhum provider USA esta disponivel no momento.');
    }

    // No dedupe is applied: source/provider/retailer provenance is material to
    // future USA eligibility and cost decisions, and fuzzy grouping is forbidden.
    return { products, providers: reports };
  }
}
