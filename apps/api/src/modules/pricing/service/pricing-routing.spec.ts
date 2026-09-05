import { describe, expect, it, vi } from 'vitest';
import { ProductNormalizationService } from '../../evolution-webhook/product-normalization.service';
import { SettingsService } from '../../settings/service/settings.service';
import { TemporaryImportPricingDto } from '../dto/pricing.dto';
import { ProductProfitProvider } from '../providers/product-profit.provider';
import { PricingRepository } from '../repository/pricing.repository';
import { ManufacturersService } from '../../manufacturers/service/manufacturers.service';
import { ManufacturersRepository } from '../../manufacturers/repository/manufacturers.repository';
import type { ManufacturerResolverAlias } from '../../manufacturers/manufacturer-resolver';
import {
  COMMERCIAL_ROUNDING_ENDING_ONE_KEY,
  COMMERCIAL_ROUNDING_ENDING_TWO_KEY,
} from '../utils/commercial-price-rounding';
import { getDefaultNonAppleElectronicsPolicy } from '../utils/non-apple-electronics.policy';
import { PricingService } from './pricing.service';

type Origin = 'CATALOG' | 'BR' | 'PY';
const origins: Origin[] = ['CATALOG', 'BR', 'PY'];

function setup(
  isAppleOriginal: boolean | null | undefined,
  cost = 700,
  profit: number | null = null,
  nonAppleElectronicsPolicy = getDefaultNonAppleElectronicsPolicy(),
) {
  const product = {
    id: 'catalog-product',
    profitProductId: 1,
    productDescription: 'iPhone 17 Pro Max 256GB',
    productType: 'IPHONE_SEALED',
    profitCondition: 'NOVO',
    isAppleOriginal,
    status: 'ACTIVE',
    category: { id: 'category', name: 'iPhone' },
    model: { id: 'model', name: 'iPhone 17 Pro Max' },
    storage: { id: 'storage', displayName: '256GB' },
  };
  const quote = {
    id: 'br-quote',
    productId: product.id,
    productName: product.productDescription,
    model: product.model.name,
    category: product.category.name,
    capacity: '256GB',
    condition: 'NOVO',
    price: cost,
    currentList: { supplierContact: { supplierName: 'BR supplier', address: 'SP' } },
  };
  const dto: TemporaryImportPricingDto = {
    sourceProductId: 'external-py-id',
    catalogProductId: product.id,
    productName: product.productDescription,
    category: 'iPhone',
    brand: 'Apple',
    model: product.model.name,
    condition: 'NOVO',
    capacity: '256GB',
    supplier: 'PY supplier',
    store: 'PY store',
    productUrl: 'https://example.com/item',
    priceUsd: 100,
    dollarQuote: 5,
    convertedPrice: 500,
    cdeExit: 20,
    redirectCost: 30,
    brazilDispatch: 40,
    invoiceTax: 60,
    correiosLabel: 50,
    totalCost: cost,
  };
  const configurations = [{ key: 'offer_increment', value: '75', type: 'currency' }];
  const repository = {
    findActiveCatalogProductById: vi.fn().mockResolvedValue(product),
    findActiveCatalogProduct: vi.fn().mockResolvedValue(product),
    findBrazilRadarQuote: vi.fn().mockResolvedValue(quote),
    listPricingConfigurations: vi.fn().mockResolvedValue(configurations),
    listQuotes: vi.fn().mockResolvedValue([
      {
        id: 'catalog-quote',
        productId: product.id,
        supplierId: 'supplier',
        costProduct: cost,
        quoteDate: new Date('2026-09-05T12:00:00Z'),
        product,
        supplier: { id: 'supplier', name: 'Supplier', status: 'ACTIVE' },
      },
    ]),
  };
  const records =
    profit === null
      ? []
      : [
          {
            productId: '1',
            condition: 'NOVO',
            productDescription: product.productDescription,
            normalizedDescription: 'iphone 17 pro max 256gb',
            netProfit: profit,
          },
        ];
  const provider = {
    getCatalog: vi.fn().mockResolvedValue({ records, fetchedAt: '2026-09-05T12:00:00Z' }),
  };
  const settings = {
    getSettings: vi.fn().mockResolvedValue({
      financial: { globalFixedCost: 200, defaultFreight: 50, defaultPaymentFee: 100 },
      pricing: { nonAppleElectronicsPolicy },
    }),
  };
  const normalization = {
    isPricingNormalizationEnabled: vi.fn().mockReturnValue(true),
    normalize: vi.fn(),
  };
  const manufacturers = {
    resolve: vi.fn().mockResolvedValue({ status: 'MISSING', normalizedEvidence: '' }),
  };
  const service = new PricingService(
    repository as unknown as PricingRepository,
    settings as unknown as SettingsService,
    provider as unknown as ProductProfitProvider,
    normalization as unknown as ProductNormalizationService,
    manufacturers as unknown as ManufacturersService,
  );
  async function calculate(origin: Origin) {
    if (origin === 'CATALOG') return (await service.list())[0]!;
    if (origin === 'BR') return service.calculateBrazilRadarQuote({ sourceQuoteId: quote.id });
    return service.calculateTemporaryImport(dto);
  }
  return {
    product,
    quote,
    dto,
    configurations,
    repository,
    provider,
    settings,
    normalization,
    manufacturers,
    service,
    calculate,
  };
}

class MemoryManufacturersRepository {
  readonly identities: Array<{
    id: string;
    manufacturerKey: string;
    canonicalName: string;
    status: 'ACTIVE' | 'INACTIVE';
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  readonly aliases: ManufacturerResolverAlias[] = [];
  readonly audits: unknown[] = [];

  async listActiveAliases() {
    return this.aliases.filter((entry) => entry.manufacturer.status === 'ACTIVE');
  }

  async findIdentityByKey(manufacturerKey: string) {
    return this.identities.find((entry) => entry.manufacturerKey === manufacturerKey) ?? null;
  }

  async createIdentity(input: { manufacturerKey: string; canonicalName: string }) {
    if (await this.findIdentityByKey(input.manufacturerKey)) throw { code: 'P2002' };
    const identity = {
      id: `manufacturer-${this.identities.length + 1}`,
      ...input,
      status: 'ACTIVE' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.identities.push(identity);
    return identity;
  }

  async setIdentityStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    const identity = this.identities.find((entry) => entry.id === id);
    if (!identity) throw new Error('manufacturer not found');
    identity.status = status;
    identity.updatedAt = new Date();
    for (const alias of this.aliases) {
      if (alias.manufacturer.id === id) alias.manufacturer.status = status;
    }
    return identity;
  }

  async findAliasByNormalizedAlias(normalizedAlias: string) {
    return this.aliases.find((entry) => entry.normalizedAlias === normalizedAlias) ?? null;
  }

  async createAlias(input: { manufacturerId: string; alias: string; normalizedAlias: string }) {
    if (await this.findAliasByNormalizedAlias(input.normalizedAlias)) throw { code: 'P2002' };
    const manufacturer = this.identities.find((entry) => entry.id === input.manufacturerId);
    if (!manufacturer) throw new Error('manufacturer not found');
    const alias: ManufacturerResolverAlias = {
      id: `alias-${this.aliases.length + 1}`,
      alias: input.alias,
      normalizedAlias: input.normalizedAlias,
      manufacturer,
    };
    this.aliases.push(alias);
    return alias;
  }

  async createAuditLog(data: unknown) {
    this.audits.push(data);
  }
}

describe('Pricing canonical originality routing', () => {
  describe.each(origins)('%s', (origin) => {
    it.each([true, null, undefined])(
      'preserves legacy financial results for %s',
      async (classification) => {
        const fixture = setup(classification, 700, 500);
        const result = await fixture.calculate(origin);
        expect(result).toMatchObject({
          desiredNetProfit: 500,
          salePrice: 1570,
          offerPrice: 1645,
          margin: 500 / 1570,
          calculationStatus: 'ready',
          calculationError: null,
        });
        expect(result).not.toHaveProperty('engineMetadata');
        if ('pricingCosts' in result)
          expect(result.pricingCosts).toEqual({
            fixedCost: 200,
            freight: 50,
            paymentFee: 100,
            offerIncrement: 75,
          });
        else expect(result).toMatchObject({ fixedCost: 200, freight: 50, paymentFee: 100 });
        expect(fixture.normalization.normalize).not.toHaveBeenCalled();
      },
    );

    it.each([true, null, undefined])(
      'preserves missing_profit and manual registration for %s',
      async (classification) => {
        const fixture = setup(classification);
        const result = await fixture.calculate(origin);
        expect(result).toMatchObject({
          desiredNetProfit: null,
          salePrice: null,
          offerPrice: null,
          calculationStatus: 'missing_profit',
        });
        expect(result.calculationError).toBeTruthy();
        expect(result).not.toHaveProperty('engineMetadata');
        if ('catalogProductId' in result) expect(result.catalogProductId).toBe(fixture.product.id);
        if ('recalculationRequest' in result) expect(result.recalculationRequest).toBe(fixture.dto);
        expect(fixture.normalization.normalize).not.toHaveBeenCalled();
      },
    );

    it.each([
      [700, 300, 1150, 1349, 1424],
      [1500, 250, 1900, 2070, 2145],
      [6000, 480, 6630, 6849, 6924],
    ])('routes false without manual profit at cost %s', async (cost, profit, raw, sale, offer) => {
      const fixture = setup(false, cost);
      const result = await fixture.calculate(origin);
      expect(result).toMatchObject({
        desiredNetProfit: profit,
        salePrice: sale,
        offerPrice: offer,
        calculationStatus: 'ready',
        calculationError: null,
        engineMetadata: {
          engine: 'NON_APPLE_ELECTRONICS',
          ruleVersion: '1.0.0',
          acquisitionCost: cost,
          fixedCost: 150,
          targetProfit: profit,
          rawBasePrice: raw,
          protectedBasePrice: raw,
          continuityAdjustment: 0,
          basePrice: raw + 150,
          roundedPrice: sale,
          offerPrice: offer,
          applicableCharges: { defaultFreight: 50, defaultPaymentFee: 100 },
          offerIncrement: 75,
        },
      });
      if ('googleSheetsReady' in result) expect(result.googleSheetsReady).toBe(true);
      else expect(result.offerDraft?.payload.productId).toBe(fixture.product.id);
      expect(fixture.normalization.normalize).not.toHaveBeenCalled();
    });

    it('ignores manual profit as authority for false', async () => {
      const result = await setup(false, 700, 9999).calculate(origin);
      expect(result.desiredNetProfit).toBe(300);
      expect(result.salePrice).toBe(1349);
    });

    it('keeps continuity adjustment separate from policy target profit', async () => {
      const result = await setup(false, 1000.01).calculate(origin);
      expect(result).toMatchObject({
        desiredNetProfit: 250,
        engineMetadata: {
          rawBasePrice: 1400.01,
          continuityAdjustment: 49.99,
          protectedBasePrice: 1450,
          targetProfit: 250,
          targetProfitRateOnCost: 0.15,
          targetProfitFloor: 250,
          band: { lowerBoundExclusive: 1000, upperBoundInclusive: 2000 },
        },
      });
    });

    it('reuses configured commercial endings and offer increment', async () => {
      const fixture = setup(false);
      fixture.configurations.push(
        { key: COMMERCIAL_ROUNDING_ENDING_ONE_KEY, value: '49', type: 'number' },
        { key: COMMERCIAL_ROUNDING_ENDING_TWO_KEY, value: '70', type: 'number' },
      );
      expect(await fixture.calculate(origin)).toMatchObject({ salePrice: 1349, offerPrice: 1424 });
      fixture.configurations[1]!.value = '90';
      expect(await fixture.calculate(origin)).toMatchObject({ salePrice: 1370, offerPrice: 1445 });
    });
  });

  it('uses final PY acquisition cost once and leaves all import components untouched', async () => {
    const fixture = setup(false);
    const before = structuredClone(fixture.dto);
    const result = await fixture.service.calculateTemporaryImport(fixture.dto);
    expect(result.importCosts).toEqual({
      dollarQuote: 5,
      convertedPrice: 500,
      cdeExit: 20,
      redirectCost: 30,
      brazilDispatch: 40,
      invoiceTax: 60,
      correiosLabel: 50,
      totalCost: 700,
    });
    expect(result.engineMetadata?.acquisitionCost).toBe(700);
    expect(result.engineMetadata?.basePrice).toBe(1300);
    expect(fixture.dto).toEqual(before);
    expect(result.profit).toMatchObject({ source: 'non_apple_electronics_policy', recordId: null });
  });

  it('prices an explicit-source Non-Apple import without Product.id or catalogProductId', async () => {
    const fixture = setup(true, 700);
    fixture.dto = {
      ...fixture.dto,
      catalogProductId: undefined,
      productName: 'Camera Digital Canon EOS Rebel T7 24.1MP',
      displayName: 'Canon EOS Rebel T7 24.1MP',
      category: 'Outros',
      brand: undefined,
      model: undefined,
      capacity: undefined,
      color: undefined,
      sourceManufacturer: 'Canon',
      sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      condition: undefined,
    };
    fixture.repository.findActiveCatalogProductById.mockResolvedValue(null);
    fixture.manufacturers.resolve.mockResolvedValue({
      status: 'FOUND',
      manufacturerId: 'manufacturer-canon',
      manufacturerKey: 'canon',
      canonicalName: 'Canon',
      provenance: 'EXPLICIT_SOURCE_VALIDATED',
      normalizedEvidence: 'canon',
      matchedAlias: 'Canon',
      normalizedAlias: 'canon',
    });

    const result = await fixture.service.calculateTemporaryImport(fixture.dto);

    expect(result).toMatchObject({
      financialClassification: 'NON_APPLE',
      catalogProductId: null,
      calculationStatus: 'ready',
      desiredNetProfit: 300,
      offerDraft: { payload: { productId: null, sourceQuoteId: 'temporary-py-external-py-id' } },
    });
  });

  it('keeps BR manufacturer resolution as a fallback and routes a confirmed alias through P4', async () => {
    const fixture = setup(null, 1690);
    fixture.quote.productId = '';
    fixture.quote.productName = 'Garmin Vivoactive 6';
    fixture.quote.model = 'Vivoactive 6';
    fixture.quote.category = 'Smartwatch';
    fixture.quote.condition = 'CPO';
    fixture.repository.findActiveCatalogProduct.mockResolvedValue(null);
    fixture.manufacturers.resolve.mockResolvedValueOnce({
      status: 'MISSING',
      normalizedEvidence: 'garmin vivoactive 6',
    });

    await expect(fixture.calculate('BR')).resolves.toMatchObject({
      financialClassification: 'UNRESOLVED',
      financialClassificationReason: 'manufacturer_missing',
      pricingEligibility: { status: 'NEEDS_INPUT', inputType: 'MANUFACTURER' },
    });

    fixture.manufacturers.resolve.mockResolvedValueOnce({
      status: 'FOUND',
      manufacturerId: 'manufacturer-garmin',
      manufacturerKey: 'garmin',
      canonicalName: 'Garmin',
      provenance: 'DETERMINISTIC_ALIAS',
      normalizedEvidence: 'garmin vivoactive 6',
      matchedAlias: 'Garmin',
      normalizedAlias: 'garmin',
    });
    await expect(fixture.calculate('BR')).resolves.toMatchObject({
      financialClassification: 'NON_APPLE',
      manufacturerKey: 'garmin',
      calculationStatus: 'ready',
      engineMetadata: { engine: 'NON_APPLE_ELECTRONICS' },
    });
  });

  it('prices a BR manufacturer end to end after an inline confirmation and reuses it', async () => {
    const fixture = setup(null, 1690);
    fixture.quote.productId = '';
    fixture.quote.productName = 'Garmin Vivoactive 6';
    fixture.quote.model = 'Vivoactive 6';
    fixture.quote.category = 'Smartwatch';
    fixture.quote.condition = 'CPO';
    fixture.repository.findActiveCatalogProduct.mockResolvedValue(null);

    const manufacturerRepository = new MemoryManufacturersRepository();
    const manufacturers = new ManufacturersService(
      manufacturerRepository as unknown as ManufacturersRepository,
    );
    const service = new PricingService(
      fixture.repository as unknown as PricingRepository,
      fixture.settings as unknown as SettingsService,
      fixture.provider as unknown as ProductProfitProvider,
      fixture.normalization as unknown as ProductNormalizationService,
      manufacturers,
    );

    await expect(
      service.calculateBrazilRadarQuote({ sourceQuoteId: fixture.quote.id }),
    ).resolves.toMatchObject({
      financialClassification: 'UNRESOLVED',
      financialClassificationReason: 'manufacturer_missing',
      pricingEligibility: { status: 'NEEDS_INPUT', inputType: 'MANUFACTURER' },
      salePrice: null,
      offerDraft: null,
    });

    const afterConfirmation = await service.confirmBrazilRadarManufacturer(
      { sourceQuoteId: fixture.quote.id, canonicalName: 'Garmin', alias: 'Garmin' },
      { id: 'settings-user' } as never,
    );

    expect(manufacturerRepository.identities).toHaveLength(1);
    expect(manufacturerRepository.identities[0]).toMatchObject({
      manufacturerKey: 'garmin',
      canonicalName: 'Garmin',
      status: 'ACTIVE',
    });
    expect(manufacturerRepository.aliases).toHaveLength(1);
    expect(manufacturerRepository.audits).toHaveLength(1);
    expect(afterConfirmation).toMatchObject({
      financialClassification: 'NON_APPLE',
      financialClassificationReason: 'manufacturer_registry',
      manufacturerKey: 'garmin',
      pricingEligibility: { status: 'ELIGIBLE' },
      calculationStatus: 'ready',
      desiredNetProfit: expect.any(Number),
      salePrice: expect.any(Number),
      offerPrice: expect.any(Number),
      profit: { source: 'non_apple_electronics_policy', recordId: null },
      engineMetadata: {
        engine: 'NON_APPLE_ELECTRONICS',
        acquisitionCost: 1690,
        targetProfit: expect.any(Number),
        continuityAdjustment: expect.any(Number),
        roundedPrice: expect.any(Number),
      },
      offerDraft: { payload: { sourceQuoteId: fixture.quote.id } },
    });

    const secondOccurrence = await service.calculateBrazilRadarQuote({
      sourceQuoteId: fixture.quote.id,
    });
    expect(secondOccurrence).toMatchObject({
      financialClassification: 'NON_APPLE',
      manufacturerKey: 'garmin',
      pricingEligibility: { status: 'ELIGIBLE' },
      calculationStatus: 'ready',
    });
    expect(manufacturerRepository.identities).toHaveLength(1);
    expect(manufacturerRepository.aliases).toHaveLength(1);
    expect(manufacturerRepository.audits).toHaveLength(1);
  });

  it('uses structured Apple financial identity without Product.id', async () => {
    const fixture = setup(true, 700, 500);
    fixture.dto = { ...fixture.dto, catalogProductId: undefined };
    fixture.repository.findActiveCatalogProductById.mockResolvedValue(null);

    const result = await fixture.service.calculateTemporaryImport(fixture.dto);

    expect(result).toMatchObject({
      financialClassification: 'APPLE',
      catalogProductId: null,
      calculationStatus: 'ready',
      desiredNetProfit: 500,
      offerDraft: { payload: { productId: null } },
    });
  });

  it('routes BR legacy lookup only after an active canonical product was located', async () => {
    const fixture = setup(false);
    fixture.quote.productId = '';
    const result = await fixture.calculate('BR');
    expect(result).toMatchObject({
      calculationStatus: 'ready',
      engineMetadata: { engine: 'NON_APPLE_ELECTRONICS' },
    });
    expect(fixture.repository.findActiveCatalogProduct).toHaveBeenCalledOnce();
  });

  it('keeps BR condition incompatibility blocked, including non-Apple', async () => {
    const fixture = setup(false);
    fixture.quote.condition = 'CPO';
    const result = await fixture.calculate('BR');
    expect(result).toMatchObject({ calculationStatus: 'missing_profit', salePrice: null });
    expect(result.calculationError).toContain('diverge');
    expect(result).not.toHaveProperty('engineMetadata');
  });

  it('does not route an unavailable/inactive canonical Product', async () => {
    const fixture = setup(false);
    fixture.repository.findActiveCatalogProductById.mockResolvedValue(null);
    await expect(fixture.calculate('PY')).rejects.toThrow('Produto canonico ativo nao encontrado');
    const result = await fixture.calculate('BR');
    expect(result.salePrice).toBeNull();
    expect(result).not.toHaveProperty('engineMetadata');
  });

  it('does not route inactive catalog quotes', async () => {
    const fixture = setup(false);
    fixture.product.status = 'INACTIVE';
    expect(await fixture.service.list()).toEqual([]);
  });

  it.each([0, -1, NaN, Infinity])('rejects invalid non-Apple acquisition cost %s', async (cost) => {
    const fixture = setup(false, cost);
    await expect(fixture.calculate('PY')).rejects.toThrow();
  });

  it.each(['IPAD', 'MACBOOK', 'APPLE_WATCH', 'AIRPODS', 'ACCESSORY'])(
    'never infers classification from %s or provider brand',
    async (productType) => {
      const fixture = setup(null);
      fixture.product.productType = productType;
      fixture.dto.brand = 'Non-Apple provider brand';
      for (const origin of origins) {
        const result = await fixture.calculate(origin);
        expect(result.calculationStatus).toBe('missing_profit');
        expect(result).not.toHaveProperty('engineMetadata');
      }
    },
  );

  it('applies a persisted policy only to false', async () => {
    const policy = getDefaultNonAppleElectronicsPolicy();
    policy.profitBands[0]!.profitPercentOnCost = 150;
    policy.fixedCostBands[1]!.fixedCost = 999;

    const nonApple = await setup(false, 50, null, policy).calculate('CATALOG');
    expect(nonApple).toMatchObject({
      desiredNetProfit: 75,
      engineMetadata: { fixedCost: 0, rawBasePrice: 125 },
    });

    for (const classification of [true, null, undefined]) {
      const apple = await setup(classification, 700, 500, policy).calculate('CATALOG');
      expect(apple).toMatchObject({
        desiredNetProfit: 500,
        salePrice: 1570,
        offerPrice: 1645,
        calculationStatus: 'ready',
      });
      expect(apple).not.toHaveProperty('engineMetadata');
    }
  });
});
