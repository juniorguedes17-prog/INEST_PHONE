import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../../auth/constants/auth.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ADMINISTRATOR_ROLE } from '../../users/users.constants';
import { AdminDiagnosticsController } from './admin-diagnostics.controller';

describe('AdminDiagnosticsController authorization', () => {
  it('requires JWT authentication and the Administrator role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminDiagnosticsController)).toEqual([ADMINISTRATOR_ROLE]);
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminDiagnosticsController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });
});
