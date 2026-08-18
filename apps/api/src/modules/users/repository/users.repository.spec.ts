import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { LastActiveAdministratorError, UsersRepository } from './users.repository';

const activeUser = {
  id: 'target-user-id',
  name: 'Jessica',
  email: 'jessica@inest.com',
  status: 'ACTIVE',
  createdAt: new Date('2026-08-18T12:00:00.000Z'),
  role: { name: 'Administrador' },
};

function createRepository(activeAdministratorCount = 2) {
  const transaction = {
    user: {
      findFirst: vi.fn().mockResolvedValue(activeUser),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(activeAdministratorCount),
      update: vi.fn().mockResolvedValue({ ...activeUser, status: 'INACTIVE' }),
    },
    refreshSession: {
      deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue([activeUser]),
    },
    $transaction: vi.fn(async (operation: (value: typeof transaction) => unknown) => operation(transaction)),
  };

  return { repository: new UsersRepository(prisma as never), prisma, transaction };
}

describe('UsersRepository', () => {
  it('selects only safe administrator fields for the list', async () => {
    const { repository, prisma } = createRepository();

    await repository.listAdministrators();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: { name: 'Administrador' } }),
        select: expect.not.objectContaining({ passwordHash: true }),
      }),
    );
  });

  it('deactivates inside a serializable transaction, revokes refresh sessions and writes an audit entry', async () => {
    const { repository, prisma, transaction } = createRepository(2);

    await repository.deactivateAdministrator(activeUser.id, 'actor-id');

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
    );
    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: activeUser.id },
        data: expect.objectContaining({ status: 'INACTIVE', updatedBy: 'actor-id' }),
      }),
    );
    expect(transaction.refreshSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: activeUser.id },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'actor-id',
          entity: 'users',
          context: { event: 'users.administrator_deactivated' },
        }),
      }),
    );
  });

  it('never deactivates the last active administrator', async () => {
    const { repository, transaction } = createRepository(1);

    await expect(repository.deactivateAdministrator(activeUser.id, 'actor-id')).rejects.toBeInstanceOf(
      LastActiveAdministratorError,
    );
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.refreshSession.deleteMany).not.toHaveBeenCalled();
  });

  it('updates administrator data and revokes refresh sessions only after a password change', async () => {
    const { repository, transaction } = createRepository();

    await repository.updateAdministrator({
      id: activeUser.id,
      name: 'Jessica Ribeiro',
      email: 'jessica.ribeiro@inest.com',
      passwordHash: '$2b$new-password',
      actorId: 'actor-id',
    });

    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: activeUser.id },
        data: expect.objectContaining({
          name: 'Jessica Ribeiro',
          email: 'jessica.ribeiro@inest.com',
          passwordHash: '$2b$new-password',
          updatedBy: 'actor-id',
        }),
      }),
    );
    expect(transaction.refreshSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: activeUser.id },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          context: { event: 'users.administrator_updated', passwordChanged: true },
        }),
      }),
    );
  });

  it('does not revoke refresh sessions for a name or e-mail-only update', async () => {
    const { repository, transaction } = createRepository();

    await repository.updateAdministrator({
      id: activeUser.id,
      name: 'Jessica Ribeiro',
      actorId: 'actor-id',
    });

    expect(transaction.refreshSession.deleteMany).not.toHaveBeenCalled();
  });
});
