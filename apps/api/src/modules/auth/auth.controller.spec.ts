import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from './constants/auth.constants';
import { AuthController } from './auth.controller';

describe('AuthController logout', () => {
  it('remains public so expired sessions can revoke refresh cookies', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.logout)).toBe(true);
    expect(Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.logout)).toBeUndefined();
  });
});
