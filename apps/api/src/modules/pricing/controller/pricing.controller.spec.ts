import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { PricingService } from '../service/pricing.service';
import { PricingWorkSnapshotService } from '../service/pricing-work-snapshot.service';
import { ConfirmTemporaryImportConditionDto } from '../dto/pricing.dto';
import { PricingController } from './pricing.controller';

function contextFor(
  permissions: string[],
  handler: unknown = PricingController.prototype.confirmBrazilRadarManufacturer,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => PricingController,
    switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) }),
  } as unknown as ExecutionContext;
}

describe('PricingController manufacturer confirmation permissions', () => {
  it('requires settings:configure', () => {
    const controller = new PricingController(
      {} as PricingService,
      {} as PricingWorkSnapshotService,
    );
    const guard = new PermissionsGuard(new Reflector());

    expect(controller).toBeDefined();
    expect(guard.canActivate(contextFor(['settings:configure']))).toBe(true);
    expect(guard.canActivate(contextFor([]))).toBe(false);
  });

  it('keeps condition confirmation behind settings:configure', () => {
    const guard = new PermissionsGuard(new Reflector());
    const handler = PricingController.prototype.confirmTemporaryImportCondition;

    expect(guard.canActivate(contextFor(['settings:configure'], handler))).toBe(true);
    expect(guard.canActivate(contextFor([], handler))).toBe(false);
  });

  it('delegates condition confirmation to the canonical recalculation service', async () => {
    const pricingService = {
      confirmTemporaryImportCondition: vi.fn().mockResolvedValue({ calculationStatus: 'ready' }),
    };
    const controller = new PricingController(
      pricingService as unknown as PricingService,
      {} as PricingWorkSnapshotService,
    );
    const dto = {
      sourceProductId: 'py-1',
      productName: 'Apple Mac Mini M2 8GB 512GB',
      category: 'Mac Mini',
      supplier: 'Loja PY',
      store: 'Loja PY',
      productUrl: 'https://example.test/mac-mini',
      priceUsd: 600,
      totalCost: 3418.93,
      condition: 'NOVO' as const,
    };

    await expect(controller.confirmTemporaryImportCondition(dto)).resolves.toEqual({
      calculationStatus: 'ready',
    });
    expect(pricingService.confirmTemporaryImportCondition).toHaveBeenCalledWith(dto);
  });

  it.each([undefined, 'USADO'])(
    'rejects an absent or unsupported condition: %s',
    async (condition) => {
      const dto = Object.assign(new ConfirmTemporaryImportConditionDto(), {
        sourceProductId: 'py-1',
        productName: 'Apple Mac Mini M2 8GB 512GB',
        category: 'Mac Mini',
        priceUsd: 600,
        totalCost: 3418.93,
        condition,
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'condition')).toBe(true);
    },
  );
});
