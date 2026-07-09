import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { SettingsService } from '../../settings/service/settings.service';
import {
  CalculateImportCostDto,
  ImportSearchQueryDto,
  UpdateDollarQuoteDto,
} from '../dto/import-radar.dto';
import { ImportProvider } from '../interfaces/import-provider.interface';
import { ImportRadarRepository } from '../repository/import-radar.repository';
import { identifyRedirectRule, toNumber } from '../validators/import-radar.validators';
import { ComprasParaguaiProvider } from '../providers/compras-paraguai.provider';
import { MockImportProvider } from '../providers/mock-import.provider';

@Injectable()
export class ImportRadarService {
  constructor(
    @Inject(SettingsService) private readonly settingsService: SettingsService,
    @Inject(ImportRadarRepository) private readonly repository: ImportRadarRepository,
    @Inject(MockImportProvider) private readonly mockProvider: MockImportProvider,
    @Inject(ComprasParaguaiProvider) private readonly comprasParaguaiProvider: ComprasParaguaiProvider,
  ) {}

  async search(query: ImportSearchQueryDto, user: AuthenticatedUser) {
    const settings = await this.settingsService.getSettings();
    const provider = this.getProvider(query.provider);
    const products = await provider.search(query);
    const results = products.map((product) => ({
      ...product,
      provider: provider.name,
      priceBrl: product.priceUsd * settings.importation.dollarQuote,
      dollarQuote: settings.importation.dollarQuote,
    }));

    await this.repository.createAuditLog({
      userId: user.id,
      operationType: 'IMPORT',
      context: {
        event: 'import_radar.search',
        provider: provider.name,
        search: query.search,
        resultCount: results.length,
        dollarQuote: settings.importation.dollarQuote,
      },
    });

    return {
      provider: provider.name,
      dollarQuote: settings.importation.dollarQuote,
      results,
    };
  }

  async findProduct(id: string, query: ImportSearchQueryDto) {
    const provider = this.getProvider(query.provider);
    const products = await provider.search(query);
    const product = products.find((item) => item.id === id);
    if (!product) {
      throw new NotFoundException('Produto de importacao nao encontrado.');
    }
    return product;
  }

  async calculate(dto: CalculateImportCostDto, user: AuthenticatedUser) {
    const settings = await this.settingsService.getSettings();
    const importSettings = settings.importation;
    const convertedPrice = dto.priceUsd * importSettings.dollarQuote;
    const redirectRule = identifyRedirectRule(dto, importSettings);
    const redirectCost = toNumber(redirectRule?.redirectCost);
    const invoiceTax = convertedPrice * (toNumber(importSettings.invoiceTaxPercent) / 100);
    const total =
      convertedPrice +
      toNumber(importSettings.cdeExitPerBox) +
      redirectCost +
      toNumber(importSettings.brazilDispatchPerBox) +
      invoiceTax +
      toNumber(importSettings.correiosLabel);

    const result = {
      product: dto,
      matchedProductType: redirectRule?.productType ?? 'Nao identificado',
      dollarQuote: importSettings.dollarQuote,
      breakdown: {
        convertedPrice,
        cdeExit: toNumber(importSettings.cdeExitPerBox),
        redirectCost,
        brazilDispatch: toNumber(importSettings.brazilDispatchPerBox),
        invoiceTax,
        correiosLabel: toNumber(importSettings.correiosLabel),
      },
      total,
    };

    await this.repository.createAuditLog({
      userId: user.id,
      operationType: 'CREATE',
      entityId: dto.id,
      newValue: result,
      context: {
        event: 'import_radar.calculated',
        matchedProductType: result.matchedProductType,
        dollarQuote: importSettings.dollarQuote,
      },
    });

    return result;
  }

  history() {
    return this.repository.listHistory();
  }

  async updateDollarQuote(dto: UpdateDollarQuoteDto, user: AuthenticatedUser) {
    const current = await this.settingsService.getSettings();
    const updated = await this.settingsService.updateSettings(
      {
        importation: {
          ...current.importation,
          dollarQuote: dto.dollarQuote,
        },
      },
      user,
    );

    await this.repository.createAuditLog({
      userId: user.id,
      operationType: 'UPDATE',
      oldValue: { dollarQuote: current.importation.dollarQuote },
      newValue: { dollarQuote: dto.dollarQuote },
      context: { event: 'import_radar.dollar_quote.updated' },
    });

    return updated.importation;
  }

  private getProvider(provider?: string): ImportProvider {
    if (provider === this.comprasParaguaiProvider.name) {
      return this.comprasParaguaiProvider;
    }
    return this.mockProvider;
  }
}
