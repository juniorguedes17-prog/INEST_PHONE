import { ImportSearchQueryDto } from '../dto/import-radar.dto';
import type { ImportProductCondition } from '../condition-normalizer';
import type { SourceManufacturerProvenance } from '../financial-classification';
import type { ImportProviderOrigin } from './source-commercial-identity.interface';

export interface ImportProviderProduct {
  id: string;
  name: string;
  store: string;
  /**
   * The retailer where the item is purchased, when the provider can expose it
   * as a structured source field. It remains distinct from the provider and
   * from the source manufacturer.
   */
  retailer?: string | null;
  category: string;
  priceUsd: number;
  productUrl: string;
  imageUrl?: string;
  brand?: string;
  sourceManufacturer?: string | null;
  sourceManufacturerProvenance?: SourceManufacturerProvenance;
  model?: string;
  capacity?: string;
  color?: string;
  city?: string;
  priceBrlSource?: number;
  availability?: string;
  storeUrl?: string;
  consultedAt?: string;
  origin?: ImportProviderOrigin;
  externalId?: string;
  minimumPriceUsd?: number;
  averagePriceUsd?: number;
  maximumPriceUsd?: number;
  storeCount?: number;
  offerCount?: number;
  condition?: ImportProductCondition;
}

export interface ImportProvider {
  readonly name: string;
  search(query: ImportSearchQueryDto): Promise<ImportProviderProduct[]>;
}
