import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ImportRadarService } from '../service/import-radar.service';
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
