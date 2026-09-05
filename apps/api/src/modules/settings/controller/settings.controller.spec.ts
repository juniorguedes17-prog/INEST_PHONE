import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { SettingsService } from '../service/settings.service';
import { SettingsController } from './settings.controller';

function contextFor(
  permissions: string[],
  handler: (...args: never[]) => unknown = SettingsController.prototype.updateSettings,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => SettingsController,
    switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) }),
  } as unknown as ExecutionContext;
}

describe('SettingsController permissions', () => {
  it('requires settings:configure for Settings mutations', () => {
    const controller = new SettingsController({} as SettingsService);
    const guard = new PermissionsGuard(new Reflector());

    expect(controller).toBeDefined();
    expect(guard.canActivate(contextFor(['settings:configure']))).toBe(true);
    expect(guard.canActivate(contextFor([]))).toBe(false);
    expect(
      guard.canActivate(
        contextFor(['settings:configure'], SettingsController.prototype.resetDefaults),
      ),
    ).toBe(true);
    expect(guard.canActivate(contextFor([], SettingsController.prototype.resetDefaults))).toBe(
      false,
    );
  });
});
