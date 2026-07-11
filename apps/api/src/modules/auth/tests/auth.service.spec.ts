import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';

const activeUser = {
  id: 'user-id',
  email: 'admin@inestphone.local',
  name: 'Admin',
  passwordHash: '$2b$hash',
  status: 'ACTIVE',
  role: {
    id: 'role-id',
    name: 'Administrador',
    rolePermissions: [
      {
        permission: {
          module: 'dashboard',
          action: 'read',
          scope: null,
        },
      },
    ],
  },
};

function createService(overrides?: { user?: unknown; passwordIsValid?: boolean }) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(overrides?.user ?? activeUser),
    },
  };
  const passwordService = {
    verifyPassword: vi.fn().mockResolvedValue(overrides?.passwordIsValid ?? true),
  };
  const tokenService = {
    generateTokens: vi.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      refreshTokenId: 'refresh-token-id',
      refreshExpiresAt: Date.now() + 1000,
    }),
    getAccessExpiresIn: vi.fn().mockReturnValue('15m'),
  };
  const sessionService = {
    register: vi.fn(),
    revoke: vi.fn(),
    isValid: vi.fn().mockReturnValue(true),
  };
  const auditLogger = {
    logAuthEvent: vi.fn().mockResolvedValue(undefined),
  };

  return {
    service: new AuthService(
      prisma as never,
      passwordService as never,
      tokenService as never,
      sessionService as never,
      auditLogger as never,
    ),
    prisma,
    passwordService,
    tokenService,
    sessionService,
  };
}

describe('AuthService', () => {
  it('authenticates an active user and registers refresh session', async () => {
    const { service, sessionService } = createService();

    const result = await service.login({
      email: 'admin@inestphone.local',
      password: 'ChangeMe@12345',
    });

    expect(result.user).toMatchObject({
      id: 'user-id',
      role: 'Administrador',
      permissions: ['dashboard:read'],
    });
    expect(result.tokens.accessToken).toBe('access-token');
    expect(sessionService.register).toHaveBeenCalledWith(
      'refresh-token-id',
      'user-id',
      expect.any(Number),
    );
  });

  it('rejects invalid passwords', async () => {
    const { service } = createService({ passwordIsValid: false });

    await expect(
      service.login({
        email: 'admin@inestphone.local',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('normalizes the email before querying Prisma', async () => {
    const { service, prisma } = createService();

    await service.login({
      email: 'ADMIN@INESTPHONE.LOCAL',
      password: 'ChangeMe@12345',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'admin@inestphone.local' },
      }),
    );
  });
});
