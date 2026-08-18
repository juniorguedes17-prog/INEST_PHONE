import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../../auth/constants/auth.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ADMINISTRATOR_ROLE } from '../users.constants';
import { UsersController } from './users.controller';

describe('UsersController authorization', () => {
  it('requires JWT authentication and the Administrator role for every users endpoint', () => {
    expect(Reflect.getMetadata(ROLES_KEY, UsersController)).toEqual([ADMINISTRATOR_ROLE]);
    expect(Reflect.getMetadata(GUARDS_METADATA, UsersController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });
});
