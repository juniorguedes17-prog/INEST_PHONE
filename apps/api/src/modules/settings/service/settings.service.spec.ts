import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  COMMERCIAL_ROUNDING_ENDING_ONE_KEY,
  COMMERCIAL_ROUNDING_ENDING_TWO_KEY,
  PRICING_CONFIGURATION_SCOPE,
} from '../../pricing/utils/commercial-price-rounding';
import { OFFER_INCREMENT_KEY } from '../../pricing/utils/offer-increment';
import {
  getDefaultNonAppleElectronicsPolicy,
  NON_APPLE_ELECTRONICS_POLICY_KEY,
} from '../../pricing/utils/non-apple-electronics.policy';
import { SettingsRepository } from '../repository/settings.repository';
import { defaultSettings } from '../settings.defaults';
import { SettingsService } from './settings.service';

function createRepository(
  pricingConfigurations: Array<{ key: string; value: string }> = [],
  globalConfigurations: Array<{ key: string; value: string }> = [],
) {
  return {
    findSystemConfigurations: vi
      .fn()
      .mockImplementation((scope?: string) =>
        Promise.resolve(
          scope === PRICING_CONFIGURATION_SCOPE ? pricingConfigurations : globalConfigurations,
        ),
      ),
    findFinancialConfiguration: vi.fn().mockResolvedValue(null),
    findImportConfiguration: vi.fn().mockResolvedValue(null),
    upsertSystemConfiguration: vi
      .fn()
      .mockImplementation((key: string, value: string, _type?: string, scope?: string) => {
        const configurations =
          scope === PRICING_CONFIGURATION_SCOPE ? pricingConfigurations : globalConfigurations;
        const existing = configurations.find((item) => item.key === key);
        if (existing) existing.value = value;
        else configurations.push({ key, value });
        return Promise.resolve({});
      }),
    deleteSystemConfigurations: vi.fn().mockResolvedValue({}),
    deleteSystemConfiguration: vi.fn().mockImplementation((key: string, scope: string) => {
      if (scope === PRICING_CONFIGURATION_SCOPE) {
        const index = pricingConfigurations.findIndex((item) => item.key === key);
        if (index >= 0) pricingConfigurations.splice(index, 1);
      }
      return Promise.resolve({});
    }),
    upsertFinancialConfiguration: vi.fn().mockResolvedValue({}),
    upsertImportConfiguration: vi.fn().mockResolvedValue({}),
    createAuditLog: vi.fn().mockResolvedValue({}),
  };
}

describe('SettingsService commercial price endings', () => {
  it('reads pricing endings from the pricing SystemConfiguration scope', async () => {
    const repository = createRepository([
      { key: COMMERCIAL_ROUNDING_ENDING_ONE_KEY, value: '70' },
      { key: COMMERCIAL_ROUNDING_ENDING_TWO_KEY, value: '49' },
    ]);
    const service = new SettingsService(repository as unknown as SettingsRepository);

    await expect(service.getSettings()).resolves.toMatchObject({
      pricing: {
        offerIncrement: 100,
        commercialRoundingEnding1: 49,
        commercialRoundingEnding2: 70,
      },
    });
  });

  it('uses safe defaults when stored pricing endings are invalid', async () => {
    const repository = createRepository([
      { key: COMMERCIAL_ROUNDING_ENDING_ONE_KEY, value: '49' },
      { key: COMMERCIAL_ROUNDING_ENDING_TWO_KEY, value: '49' },
    ]);
    const service = new SettingsService(repository as unknown as SettingsRepository);

    await expect(service.getSettings()).resolves.toMatchObject({
      pricing: {
        offerIncrement: 100,
        commercialRoundingEnding1: 49,
        commercialRoundingEnding2: 70,
      },
    });
  });

  it('persists each commercial ending in the pricing scope', async () => {
    const repository = createRepository();
    const service = new SettingsService(repository as unknown as SettingsRepository);

    await service.updateSettings({
      pricing: {
        offerIncrement: 100.5,
        commercialRoundingEnding1: 70,
        commercialRoundingEnding2: 49,
      },
    });

    expect(repository.upsertSystemConfiguration).toHaveBeenCalledWith(
      OFFER_INCREMENT_KEY,
      '100.5',
      'moeda',
      PRICING_CONFIGURATION_SCOPE,
    );
    expect(repository.upsertSystemConfiguration).toHaveBeenCalledWith(
      COMMERCIAL_ROUNDING_ENDING_ONE_KEY,
      '70',
      'numero',
      PRICING_CONFIGURATION_SCOPE,
    );
    expect(repository.upsertSystemConfiguration).toHaveBeenCalledWith(
      COMMERCIAL_ROUNDING_ENDING_TWO_KEY,
      '49',
      'numero',
      PRICING_CONFIGURATION_SCOPE,
    );
  });

  it('rejects equal commercial endings before writing settings', async () => {
    const repository = createRepository();
    const service = new SettingsService(repository as unknown as SettingsRepository);
    const settings = await service.getSettings();

    await expect(
      service.updateSettings({
        pricing: {
          offerIncrement: 100,
          commercialRoundingEnding1: 49,
          commercialRoundingEnding2: 49,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.upsertSystemConfiguration).not.toHaveBeenCalled();
    expect(settings.pricing).toMatchObject({
      offerIncrement: 100,
      commercialRoundingEnding1: 49,
      commercialRoundingEnding2: 70,
    });
  });

  it('falls back to R$100 for an invalid stored offer increment', async () => {
    const repository = createRepository([{ key: OFFER_INCREMENT_KEY, value: '-1' }]);
    const service = new SettingsService(repository as unknown as SettingsRepository);

    await expect(service.getSettings()).resolves.toMatchObject({
      pricing: { offerIncrement: 100 },
    });
  });

  it.each([-1, 100.555])(
    'rejects invalid offer increment %s before writing settings',
    async (offerIncrement) => {
      const repository = createRepository();
      const service = new SettingsService(repository as unknown as SettingsRepository);

      await expect(
        service.updateSettings({
          pricing: {
            offerIncrement,
            commercialRoundingEnding1: 49,
            commercialRoundingEnding2: 70,
          },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.upsertSystemConfiguration).not.toHaveBeenCalled();
    },
  );

  it('returns installment defaults when no global configuration exists', async () => {
    const repository = createRepository();
    const service = new SettingsService(repository as unknown as SettingsRepository);
    const settings = await service.getSettings();

    expect(settings.installmentRates.infinityPay.debitRatePercent).toBe(1.37);
    expect(settings.installmentRates.infinityPay.installments).toHaveLength(12);
    expect(settings.installmentRates.infinityPay.installments[0]).toEqual({
      installments: 1,
      ratePercent: 3.15,
    });
    expect(settings.installmentRates.pagBank.installments).toHaveLength(18);
    expect(settings.installmentRates.nubank.installments.at(-1)).toEqual({
      installments: 12,
      ratePercent: 12.38,
    });
    expect(settings.installmentMessageTemplate).toBe(
      '📱 *{{produto}}*\nCor: {{cor}}\n\n💳 *Condições de Pagamento*\n\n{{parcelas}}\n\nQual dessas opções fica melhor para você?',
    );
  });

  it('persists valid installment rates and the message template through SystemConfiguration', async () => {
    const repository = createRepository();
    const service = new SettingsService(repository as unknown as SettingsRepository);
    const rates = structuredClone(defaultSettings.installmentRates);
    rates.infinityPay.debitRatePercent = 1.5;
    rates.pagBank.installments[0]!.ratePercent = 3.1;

    await service.updateSettings({
      installmentRates: rates,
      installmentMessageTemplate: '{{produto}}\n{{parcelas}}',
    });

    expect(repository.upsertSystemConfiguration).toHaveBeenCalledWith(
      'installmentRates',
      JSON.stringify(rates),
      'json',
    );
    expect(repository.upsertSystemConfiguration).toHaveBeenCalledWith(
      'installmentMessageTemplate',
      '{{produto}}\n{{parcelas}}',
      'texto_longo',
    );
  });

  it('preserves a valid customized installment template already stored by the user', async () => {
    const repository = createRepository(
      [],
      [
        {
          key: 'installmentMessageTemplate',
          value: 'Condição especial para {{produto}}\n{{parcelas}}',
        },
      ],
    );
    const service = new SettingsService(repository as unknown as SettingsRepository);

    await expect(service.getSettings()).resolves.toMatchObject({
      installmentMessageTemplate: 'Condição especial para {{produto}}\n{{parcelas}}',
    });
  });

  it.each([
    [
      'InfinityPay',
      (rates: typeof defaultSettings.installmentRates) =>
        (rates.infinityPay.debitRatePercent = 1.5),
    ],
    [
      'PagBank',
      (rates: typeof defaultSettings.installmentRates) =>
        (rates.pagBank.installments[0]!.ratePercent = 3.1),
    ],
    [
      'Nubank',
      (rates: typeof defaultSettings.installmentRates) =>
        (rates.nubank.installments[0]!.ratePercent = 3.2),
    ],
  ])('accepts a valid PATCH for %s rates', async (_provider, mutate) => {
    const repository = createRepository();
    const service = new SettingsService(repository as unknown as SettingsRepository);
    const rates = structuredClone(defaultSettings.installmentRates);
    mutate(rates);

    await service.updateSettings({ installmentRates: rates });

    expect(repository.upsertSystemConfiguration).toHaveBeenCalledWith(
      'installmentRates',
      JSON.stringify(rates),
      'json',
    );
  });

  it.each([
    [
      'negative rate',
      (rates: typeof defaultSettings.installmentRates) =>
        (rates.nubank.installments[0]!.ratePercent = -1),
    ],
    [
      'rate equal to 100',
      (rates: typeof defaultSettings.installmentRates) =>
        (rates.nubank.installments[0]!.ratePercent = 100),
    ],
    [
      'non-finite rate',
      (rates: typeof defaultSettings.installmentRates) =>
        (rates.nubank.installments[0]!.ratePercent = Number.NaN),
    ],
    [
      'duplicated installment',
      (rates: typeof defaultSettings.installmentRates) =>
        (rates.pagBank.installments[1]!.installments = 1),
    ],
    [
      'installment out of range',
      (rates: typeof defaultSettings.installmentRates) =>
        (rates.infinityPay.installments[0]!.installments = 13),
    ],
    [
      'incomplete provider structure',
      (rates: typeof defaultSettings.installmentRates) => rates.pagBank.installments.pop(),
    ],
  ])('rejects %s before writing installment settings', async (_label, mutate) => {
    const repository = createRepository();
    const service = new SettingsService(repository as unknown as SettingsRepository);
    const rates = structuredClone(defaultSettings.installmentRates);
    mutate(rates);

    await expect(service.updateSettings({ installmentRates: rates })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.upsertSystemConfiguration).not.toHaveBeenCalled();
  });

  it('rejects an unknown installment message placeholder before writing settings', async () => {
    const repository = createRepository();
    const service = new SettingsService(repository as unknown as SettingsRepository);

    await expect(
      service.updateSettings({ installmentMessageTemplate: '{{produto}} {{cliente}}' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.upsertSystemConfiguration).not.toHaveBeenCalled();
  });

  it('includes installment defaults in the existing reset flow', async () => {
    const repository = createRepository();
    const service = new SettingsService(repository as unknown as SettingsRepository);

    await service.resetDefaults();

    expect(repository.upsertSystemConfiguration).toHaveBeenCalledWith(
      'installmentRates',
      JSON.stringify(defaultSettings.installmentRates),
      'json',
    );
    expect(repository.upsertSystemConfiguration).toHaveBeenCalledWith(
      'installmentMessageTemplate',
      defaultSettings.installmentMessageTemplate,
      'texto_longo',
    );
  });
});

describe('SettingsService non-Apple electronics policy', () => {
  it('returns the versioned default when no override exists', async () => {
    const repository = createRepository();
    const service = new SettingsService(repository as unknown as SettingsRepository);

    await expect(service.getSettings()).resolves.toMatchObject({
      pricing: { nonAppleElectronicsPolicy: getDefaultNonAppleElectronicsPolicy() },
    });
  });

  it('uses a complete persisted policy and falls back for malformed JSON', async () => {
    const customPolicy = getDefaultNonAppleElectronicsPolicy();
    customPolicy.profitBands[0]!.profitPercentOnCost = 135;
    const repository = createRepository([
      { key: NON_APPLE_ELECTRONICS_POLICY_KEY, value: JSON.stringify(customPolicy) },
    ]);
    const service = new SettingsService(repository as unknown as SettingsRepository);

    await expect(service.getSettings()).resolves.toMatchObject({
      pricing: { nonAppleElectronicsPolicy: customPolicy },
    });

    repository.findSystemConfigurations.mockImplementation((scope?: string) =>
      Promise.resolve(
        scope === PRICING_CONFIGURATION_SCOPE
          ? [{ key: NON_APPLE_ELECTRONICS_POLICY_KEY, value: '{' }]
          : [],
      ),
    );
    await expect(service.getSettings()).resolves.toMatchObject({
      pricing: { nonAppleElectronicsPolicy: getDefaultNonAppleElectronicsPolicy() },
    });
  });

  it.each([
    [
      'partial document',
      (policy: ReturnType<typeof getDefaultNonAppleElectronicsPolicy>) => policy.profitBands.pop(),
    ],
    [
      'unsupported version',
      (policy: ReturnType<typeof getDefaultNonAppleElectronicsPolicy>) => {
        policy.version = '9.9.9' as '1.0.0';
      },
    ],
    [
      'negative percentage',
      (policy: ReturnType<typeof getDefaultNonAppleElectronicsPolicy>) => {
        policy.profitBands[0]!.profitPercentOnCost = -1;
      },
    ],
    [
      'negative floor',
      (policy: ReturnType<typeof getDefaultNonAppleElectronicsPolicy>) => {
        policy.profitBands[5]!.minimumProfit = -1;
      },
    ],
    [
      'negative fixed cost',
      (policy: ReturnType<typeof getDefaultNonAppleElectronicsPolicy>) => {
        policy.fixedCostBands[1]!.fixedCost = -1;
      },
    ],
    [
      'non-finite value',
      (policy: ReturnType<typeof getDefaultNonAppleElectronicsPolicy>) => {
        policy.profitBands[0]!.profitPercentOnCost = Number.NaN;
      },
    ],
    [
      'duplicate id',
      (policy: ReturnType<typeof getDefaultNonAppleElectronicsPolicy>) => {
        policy.profitBands[1]!.id = policy.profitBands[0]!.id;
      },
    ],
    [
      'reordered id',
      (policy: ReturnType<typeof getDefaultNonAppleElectronicsPolicy>) => {
        policy.profitBands.reverse();
      },
    ],
  ])('rejects %s before writing', async (_label, mutate) => {
    const repository = createRepository();
    const service = new SettingsService(repository as unknown as SettingsRepository);
    const policy = getDefaultNonAppleElectronicsPolicy();
    mutate(policy);

    await expect(
      service.updateSettings({
        pricing: {
          offerIncrement: 100,
          commercialRoundingEnding1: 49,
          commercialRoundingEnding2: 70,
          nonAppleElectronicsPolicy: policy,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.upsertSystemConfiguration).not.toHaveBeenCalled();
  });

  it('writes a valid complete policy with one JSON upsert and audits old/new values', async () => {
    const repository = createRepository();
    const service = new SettingsService(repository as unknown as SettingsRepository);
    const policy = getDefaultNonAppleElectronicsPolicy();
    policy.profitBands[0]!.profitPercentOnCost = 130;

    await service.updateSettings(
      {
        pricing: {
          offerIncrement: 100,
          commercialRoundingEnding1: 49,
          commercialRoundingEnding2: 70,
          nonAppleElectronicsPolicy: policy,
        },
      },
      { id: 'user-1' } as never,
    );

    expect(repository.upsertSystemConfiguration).toHaveBeenCalledWith(
      NON_APPLE_ELECTRONICS_POLICY_KEY,
      JSON.stringify(policy),
      'json',
      PRICING_CONFIGURATION_SCOPE,
    );
    expect(
      repository.upsertSystemConfiguration.mock.calls.filter(
        (call: unknown[]) => call[0] === NON_APPLE_ELECTRONICS_POLICY_KEY,
      ),
    ).toHaveLength(1);
    expect(repository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        oldValue: expect.any(Object),
        newValue: expect.any(Object),
        context: expect.objectContaining({ key: NON_APPLE_ELECTRONICS_POLICY_KEY }),
      }),
    );
  });

  it('removes only the policy override and returns the versioned default on reset', async () => {
    const policy = getDefaultNonAppleElectronicsPolicy();
    policy.fixedCostBands[1]!.fixedCost = 200;
    const repository = createRepository([
      { key: NON_APPLE_ELECTRONICS_POLICY_KEY, value: JSON.stringify(policy) },
      { key: OFFER_INCREMENT_KEY, value: '75' },
    ]);
    const service = new SettingsService(repository as unknown as SettingsRepository);

    const result = await service.resetDefaults(
      { id: 'user-1' } as never,
      'non_apple_electronics_policy',
    );

    expect(repository.deleteSystemConfiguration).toHaveBeenCalledWith(
      NON_APPLE_ELECTRONICS_POLICY_KEY,
      PRICING_CONFIGURATION_SCOPE,
    );
    expect(repository.deleteSystemConfigurations).not.toHaveBeenCalled();
    expect(result.pricing).toMatchObject({
      offerIncrement: 75,
      nonAppleElectronicsPolicy: getDefaultNonAppleElectronicsPolicy(),
    });
    expect(repository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        oldValue: policy,
        newValue: getDefaultNonAppleElectronicsPolicy(),
      }),
    );
  });
});
