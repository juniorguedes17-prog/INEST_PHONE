import { ImportSearchQueryDto } from '../dto/import-radar.dto';

export interface ImportProviderProduct {
  id: string;
  name: string;
  store: string;
  category: string;
  priceUsd: number;
  productUrl: string;
  imageUrl?: string;
}

export interface ImportProvider {
  readonly name: string;
  search(query: ImportSearchQueryDto): Promise<ImportProviderProduct[]>;
}
