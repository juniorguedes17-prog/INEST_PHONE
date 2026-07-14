import { ImportSearchQueryDto } from '../dto/import-radar.dto';

export interface ImportProviderProduct {
  id: string;
  name: string;
  store: string;
  category: string;
  priceUsd: number;
  productUrl: string;
  imageUrl?: string;
  brand?: string;
  model?: string;
  capacity?: string;
  color?: string;
  city?: string;
  priceBrlSource?: number;
  availability?: string;
  storeUrl?: string;
  consultedAt?: string;
  origin?: 'PY' | 'US' | 'MOCK';
  externalId?: string;
  minimumPriceUsd?: number;
  averagePriceUsd?: number;
  maximumPriceUsd?: number;
  storeCount?: number;
  offerCount?: number;
}

export interface ImportProvider {
  readonly name: string;
  search(query: ImportSearchQueryDto): Promise<ImportProviderProduct[]>;
}
