import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { PricingService } from '../service/pricing.service';
import { PricingWorkSnapshotService } from '../service/pricing-work-snapshot.service';
import { PricingController } from './pricing.controller';

function contextFor(permissions: string[]): ExecutionContext {
  return {
    getHandler: () => PricingController.prototype.confirmBrazilRadarManufacturer,
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
});
