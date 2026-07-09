import { Injectable } from '@nestjs/common';
import { ImportSearchQueryDto } from '../dto/import-radar.dto';
import { ImportProvider, ImportProviderProduct } from '../interfaces/import-provider.interface';

const mockProducts: ImportProviderProduct[] = [
  {
    id: 'mock-iphone-16-pro-max',
    name: 'iPhone 16 Pro Max 256GB Natural',
    store: 'Compras Paraguai Mock',
    category: 'iPhone',
    priceUsd: 1099,
    productUrl: 'https://www.comprasparaguai.com.br',
  },
  {
    id: 'mock-macbook-air-m3',
    name: 'MacBook Air M3 13 256GB',
    store: 'Compras Paraguai Mock',
    category: 'MacBook',
    priceUsd: 1190,
    productUrl: 'https://www.comprasparaguai.com.br',
  },
  {
    id: 'mock-ipad-air',
    name: 'iPad Air 11 128GB Wi-Fi',
    store: 'Compras Paraguai Mock',
    category: 'iPad',
    priceUsd: 690,
    productUrl: 'https://www.comprasparaguai.com.br',
  },
  {
    id: 'mock-apple-watch-s9',
    name: 'Apple Watch Series 9 45mm',
    store: 'Compras Paraguai Mock',
    category: 'Apple Watch',
    priceUsd: 379,
    productUrl: 'https://www.comprasparaguai.com.br',
  },
  {
    id: 'mock-perfume',
    name: 'Perfume Importado Bleu 100ml',
    store: 'Compras Paraguai Mock',
    category: 'Perfume',
    priceUsd: 89,
    productUrl: 'https://www.comprasparaguai.com.br',
  },
  {
    id: 'mock-smart-watch',
    name: 'Smart Watch Ultra GPS',
    store: 'Compras Paraguai Mock',
    category: 'Smart Watch',
    priceUsd: 75,
    productUrl: 'https://www.comprasparaguai.com.br',
  },
];

@Injectable()
export class MockImportProvider implements ImportProvider {
  readonly name = 'mock';

  async search(query: ImportSearchQueryDto): Promise<ImportProviderProduct[]> {
    const search = normalize(query.search ?? '');
    const category = normalize(query.category ?? '');

    return mockProducts.filter((product) => {
      const haystack = normalize(`${product.name} ${product.category} ${product.store}`);
      if (search && !haystack.includes(search)) {
        return false;
      }
      if (category && normalize(product.category) !== category) {
        return false;
      }
      return true;
    });
  }
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
