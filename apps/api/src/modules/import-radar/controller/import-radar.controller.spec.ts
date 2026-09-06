import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ImportRadarService } from '../service/import-radar.service';
import { UsaProvidersOrchestrator } from '../service/usa-providers-orchestrator.service';
import { ImportRadarController } from './import-radar.controller';

function contextFor(
  permissions: string[],
  handler:
    | 'confirmManufacturer'
    | 'registerShippingWeight'
    | 'resolveShippingWeight' = 'confirmManufacturer',
): ExecutionContext {
  return {
    getHandler: () => ImportRadarController.prototype[handler],
    getClass: () => ImportRadarController,
    switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) }),
  } as unknown as ExecutionContext;
}

describe('ImportRadarController manufacturer confirmation permissions', () => {
  it('requires settings:configure', () => {
    const controller = new ImportRadarController({} as ImportRadarService, {} as never);
    const guard = new PermissionsGuard(new Reflector());

    expect(controller).toBeDefined();
    expect(guard.canActivate(contextFor(['settings:configure']))).toBe(true);
    expect(guard.canActivate(contextFor([]))).toBe(false);
  });

  it('exposes the USA discovery route through the existing orchestrator', async () => {
    const products = [
      {
        source: 'US',
        providerName: 'apple_us',
        sourceProductId: 'apple-us:iphone',
        sourceName: 'iPhone',
        displayName: 'iPhone',
        sourceUrl: 'https://example.test/iphone',
        supplier: 'Apple Store USA',
        sourceManufacturer: 'Apple',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
        retailer: 'Apple Store USA',
        category: 'iPhone',
        priceUsd: 999,
      },
    ];
    const orchestrator = { search: async () => products };
    const controller = new ImportRadarController(
      {} as ImportRadarService,
      {} as never,
      undefined,
      undefined,
      undefined,
      orchestrator as unknown as UsaProvidersOrchestrator,
    );

    await expect(controller.searchUsa({ search: 'iPhone' })).resolves.toEqual(products);
  });

  it('requires products:edit to register an operational shipping weight', () => {
    const guard = new PermissionsGuard(new Reflector());

    expect(guard.canActivate(contextFor(['products:edit'], 'registerShippingWeight'))).toBe(true);
    expect(guard.canActivate(contextFor([], 'registerShippingWeight'))).toBe(false);
  });

  it('keeps shipping-weight resolution authenticated by the controller without edit permission', () => {
    const guard = new PermissionsGuard(new Reflector());

    expect(guard.canActivate(contextFor([], 'resolveShippingWeight'))).toBe(true);
  });
});
