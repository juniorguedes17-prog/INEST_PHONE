import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ImportSearchQueryDto } from '../dto/import-radar.dto';
import { AmazonUsProvider } from '../providers/amazon-us.provider';
import { AppleUsProvider } from '../providers/apple-us.provider';
import { UpcItemDbUsProvider } from '../providers/upcitemdb-us.provider';
import type { UsaSourceProduct } from '../usa-source-product.adapter';

interface UsaSourceProductProvider {
  readonly name: string;
  searchUsaSourceProducts(query: ImportSearchQueryDto): Promise<UsaSourceProduct[]>;
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
    const providers: readonly UsaSourceProductProvider[] = [
      this.appleUsProvider,
      this.amazonUsProvider,
      this.upcItemDbUsProvider,
    ];
    const results = await Promise.allSettled(
      providers.map((provider) =>
        Promise.resolve().then(() => provider.searchUsaSourceProducts(query)),
      ),
    );

    const products = results.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : [],
    );
    if (!products.length && results.every((result) => result.status === 'rejected')) {
      throw new ServiceUnavailableException('Nenhum provider USA esta disponivel no momento.');
    }

    // No dedupe is applied: source/provider/retailer provenance is material to
    // future USA eligibility and cost decisions, and fuzzy grouping is forbidden.
    return products;
  }
}
