import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import { AuthTokenService } from '../services/auth-token.service';

describe('AuthTokenService', () => {
  const jwtService = new JwtService();
  const configService = new ConfigService({
    auth: {
      jwtSecret: 'test-access-secret',
      jwtRefreshSecret: 'test-refresh-secret',
      jwtExpiresIn: '15m',
      jwtRefreshExpiresIn: '7d',
    },
  });
  const service = new AuthTokenService(jwtService, configService);

  it('generates signed access and refresh tokens', async () => {
    const result = await service.generateTokens({
      id: 'user-id',
      name: 'Admin',
      email: 'admin@inestphone.local',
      role: 'Administrador',
      permissions: ['auth:read'],
    });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.refreshTokenId).toBeTruthy();
    await expect(service.verifyRefreshToken(result.refreshToken)).resolves.toMatchObject({
      sub: 'user-id',
      type: 'refresh',
      jti: result.refreshTokenId,
    });
  });
});
