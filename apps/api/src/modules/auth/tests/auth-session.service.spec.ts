import { describe, expect, it, vi } from 'vitest';
import { AuthSessionService } from '../services/auth-session.service';

interface StoredSession {
  tokenId: string;
  userId: string;
  expiresAt: Date;
}

function createPrismaStore() {
  const sessions = new Map<string, StoredSession>();
  const prisma = {
    refreshSession: {
      create: vi.fn(async ({ data }: { data: StoredSession }) => {
        sessions.set(data.tokenId, data);
        return data;
      }),
      findUnique: vi.fn(async ({ where }: { where: { tokenId: string } }) =>
        sessions.get(where.tokenId) ?? null,
      ),
      delete: vi.fn(async ({ where }: { where: { tokenId: string } }) => {
        sessions.delete(where.tokenId);
      }),
      deleteMany: vi.fn(async ({ where }: { where: { tokenId: string } }) => {
        const removed = sessions.delete(where.tokenId);
        return { count: removed ? 1 : 0 };
      }),
    },
  };

  return prisma;
}

describe('AuthSessionService', () => {
  it('persists a refresh-session identifier instead of process memory', async () => {
    const prisma = createPrismaStore();
    const service = new AuthSessionService(prisma as never);
    const expiresAt = Date.now() + 60_000;

    await service.register('refresh-token-id', 'user-id', expiresAt);

    expect(prisma.refreshSession.create).toHaveBeenCalledWith({
      data: {
        tokenId: 'refresh-token-id',
        userId: 'user-id',
        expiresAt: new Date(expiresAt),
      },
    });
  });

  it('accepts a valid persisted session after a new service instance', async () => {
    const prisma = createPrismaStore();
    const first = new AuthSessionService(prisma as never);
    const restarted = new AuthSessionService(prisma as never);

    await first.register('refresh-token-id', 'user-id', Date.now() + 60_000);

    await expect(restarted.isValid('refresh-token-id', 'user-id')).resolves.toBe(true);
  });

  it('rejects and removes an expired persisted session', async () => {
    const prisma = createPrismaStore();
    const service = new AuthSessionService(prisma as never);

    await service.register('expired-refresh-token-id', 'user-id', Date.now() - 1);

    await expect(service.isValid('expired-refresh-token-id', 'user-id')).resolves.toBe(false);
    expect(prisma.refreshSession.delete).toHaveBeenCalledWith({
      where: { tokenId: 'expired-refresh-token-id' },
    });
  });

  it('removes only the targeted session during logout', async () => {
    const prisma = createPrismaStore();
    const service = new AuthSessionService(prisma as never);
    await service.register('refresh-token-id', 'user-id', Date.now() + 60_000);
    await service.register('other-refresh-token-id', 'user-id', Date.now() + 60_000);

    await service.revoke('refresh-token-id');

    expect(prisma.refreshSession.deleteMany).toHaveBeenCalledWith({
      where: { tokenId: 'refresh-token-id' },
    });
    await expect(service.isValid('other-refresh-token-id', 'user-id')).resolves.toBe(true);
  });
});
