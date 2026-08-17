import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  COMMERCIAL_ROUNDING_ENDING_ONE_KEY,
  COMMERCIAL_ROUNDING_ENDING_TWO_KEY,
  PRICING_CONFIGURATION_SCOPE,
} from '../../pricing/utils/commercial-price-rounding';
import { SettingsRepository } from '../repository/settings.repository';
import { SettingsService } from './settings.service';

function createRepository(pricingConfigurations: Array<{ key: string; value: string }> = []) {
  return {
    findSystemConfigurations: vi.fn().mockImplementation((scope?: string) =>
      Promise.resolve(scope === PRICING_CONFIGURATION_SCOPE ? pricingConfigurations : []),
    ),
    findFinancialConfiguration: vi.fn().mockResolvedValue(null),
    findImportConfiguration: vi.fn().mockResolvedValue(null),
    upsertSystemConfiguration: vi.fn().mockResolvedValue({}),
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
        commercialRoundingEnding1: 70,
        commercialRoundingEnding2: 49,
      },
    });

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
          commercialRoundingEnding1: 49,
          commercialRoundingEnding2: 49,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.upsertSystemConfiguration).not.toHaveBeenCalled();
    expect(settings.pricing).toEqual({ commercialRoundingEnding1: 49, commercialRoundingEnding2: 70 });
  });
});
