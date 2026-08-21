import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  COMMERCIAL_ROUNDING_ENDING_ONE_KEY,
  COMMERCIAL_ROUNDING_ENDING_TWO_KEY,
  PRICING_CONFIGURATION_SCOPE,
} from '../../pricing/utils/commercial-price-rounding';
import { OFFER_INCREMENT_KEY } from '../../pricing/utils/offer-increment';
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
    upsertSystemConfiguration: vi.fn().mockResolvedValue({}),
    deleteSystemConfigurations: vi.fn().mockResolvedValue({}),
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
    expect(settings.pricing).toEqual({
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
