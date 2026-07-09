import { Inject, Injectable } from '@nestjs/common';
import { ImportSearchQueryDto } from '../dto/import-radar.dto';
import { ImportProvider, ImportProviderProduct } from '../interfaces/import-provider.interface';
import { MockImportProvider } from './mock-import.provider';

@Injectable()
export class ComprasParaguaiProvider implements ImportProvider {
  readonly name = 'compras_paraguai';

  constructor(@Inject(MockImportProvider) private readonly mockProvider: MockImportProvider) {}

  search(query: ImportSearchQueryDto): Promise<ImportProviderProduct[]> {
    return this.mockProvider.search(query);
  }
}
