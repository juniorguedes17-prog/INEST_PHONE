import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ImportRadarService } from '../service/import-radar.service';
import { ImportRadarController } from './import-radar.controller';

function contextFor(permissions: string[]): ExecutionContext {
  return {
    getHandler: () => ImportRadarController.prototype.confirmManufacturer,
    getClass: () => ImportRadarController,
    switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) }),
  } as unknown as ExecutionContext;
}

describe('ImportRadarController manufacturer confirmation permissions', () => {
  it('requires settings:configure', () => {
    const controller = new ImportRadarController({} as ImportRadarService);
    const guard = new PermissionsGuard(new Reflector());

    expect(controller).toBeDefined();
    expect(guard.canActivate(contextFor(['settings:configure']))).toBe(true);
    expect(guard.canActivate(contextFor([]))).toBe(false);
  });
});
