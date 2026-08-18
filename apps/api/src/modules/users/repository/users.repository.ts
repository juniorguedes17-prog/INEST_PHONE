import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ADMINISTRATOR_ROLE } from '../users.constants';

const managedUserSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  createdAt: true,
  role: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.UserSelect;

export type ManagedUserRecord = Prisma.UserGetPayload<{ select: typeof managedUserSelect }>;

export class ManagedUserNotFoundError extends Error {}
export class DuplicateManagedUserEmailError extends Error {}
export class LastActiveAdministratorError extends Error {}
export class UserAlreadyInactiveError extends Error {}

@Injectable()
export class UsersRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listAdministrators(): Promise<ManagedUserRecord[]> {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        role: { name: ADMINISTRATOR_ROLE },
      },
      select: managedUserSelect,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createAdministrator(input: {
    name: string;
    email: string;
    passwordHash: string;
    actorId: string;
  }): Promise<ManagedUserRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const role = await transaction.role.findFirst({
        where: {
          name: ADMINISTRATOR_ROLE,
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!role) {
        throw new ManagedUserNotFoundError();
      }

      const existingUser = await transaction.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });

      if (existingUser) {
        throw new DuplicateManagedUserEmailError();
      }

      const user = await transaction.user.create({
        data: {
          roleId: role.id,
          name: input.name,
          email: input.email,
          passwordHash: input.passwordHash,
          status: 'ACTIVE',
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        select: managedUserSelect,
      });

      await transaction.auditLog.create({
        data: {
          userId: input.actorId,
          operationType: 'CREATE',
          entity: 'users',
          entityId: user.id,
          newValue: this.toAuditValue(user),
          context: { event: 'users.administrator_created' },
        },
      });

      return user;
    });
  }

  async updateAdministrator(input: {
    id: string;
    name?: string;
    email?: string;
    passwordHash?: string;
    actorId: string;
  }): Promise<ManagedUserRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const currentUser = await transaction.user.findFirst({
        where: {
          id: input.id,
          deletedAt: null,
          role: { name: ADMINISTRATOR_ROLE },
        },
        select: managedUserSelect,
      });

      if (!currentUser) {
        throw new ManagedUserNotFoundError();
      }

      const email = input.email ?? currentUser.email;
      if (email !== currentUser.email) {
        const existingUser = await transaction.user.findUnique({
          where: { email },
          select: { id: true },
        });

        if (existingUser && existingUser.id !== input.id) {
          throw new DuplicateManagedUserEmailError();
        }
      }

      const user = await transaction.user.update({
        where: { id: input.id },
        data: {
          name: input.name ?? currentUser.name,
          email,
          ...(input.passwordHash ? { passwordHash: input.passwordHash } : {}),
          updatedBy: input.actorId,
        },
        select: managedUserSelect,
      });

      if (input.passwordHash) {
        await transaction.refreshSession.deleteMany({ where: { userId: input.id } });
      }

      await transaction.auditLog.create({
        data: {
          userId: input.actorId,
          operationType: 'UPDATE',
          entity: 'users',
          entityId: user.id,
          oldValue: this.toAuditValue(currentUser),
          newValue: this.toAuditValue(user),
          context: { event: 'users.administrator_updated', passwordChanged: Boolean(input.passwordHash) },
        },
      });

      return user;
    });
  }

  async deactivateAdministrator(id: string, actorId: string): Promise<ManagedUserRecord> {
    return this.runSerializable(async (transaction) => {
      const currentUser = await transaction.user.findFirst({
        where: {
          id,
          deletedAt: null,
          role: { name: ADMINISTRATOR_ROLE },
        },
        select: managedUserSelect,
      });

      if (!currentUser) {
        throw new ManagedUserNotFoundError();
      }

      if (currentUser.status !== 'ACTIVE') {
        throw new UserAlreadyInactiveError();
      }

      const activeAdministratorCount = await transaction.user.count({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          role: { name: ADMINISTRATOR_ROLE },
        },
      });

      if (activeAdministratorCount <= 1) {
        throw new LastActiveAdministratorError();
      }

      const user = await transaction.user.update({
        where: { id },
        data: {
          status: 'INACTIVE',
          updatedBy: actorId,
        },
        select: managedUserSelect,
      });

      await transaction.refreshSession.deleteMany({ where: { userId: id } });
      await transaction.auditLog.create({
        data: {
          userId: actorId,
          operationType: 'UPDATE',
          entity: 'users',
          entityId: user.id,
          oldValue: this.toAuditValue(currentUser),
          newValue: this.toAuditValue(user),
          context: { event: 'users.administrator_deactivated' },
        },
      });

      return user;
    });
  }

  async activateAdministrator(id: string, actorId: string): Promise<ManagedUserRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const currentUser = await transaction.user.findFirst({
        where: {
          id,
          deletedAt: null,
          role: { name: ADMINISTRATOR_ROLE },
        },
        select: managedUserSelect,
      });

      if (!currentUser) {
        throw new ManagedUserNotFoundError();
      }

      const user = await transaction.user.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          updatedBy: actorId,
        },
        select: managedUserSelect,
      });

      await transaction.auditLog.create({
        data: {
          userId: actorId,
          operationType: 'UPDATE',
          entity: 'users',
          entityId: user.id,
          oldValue: this.toAuditValue(currentUser),
          newValue: this.toAuditValue(user),
          context: { event: 'users.administrator_activated' },
        },
      });

      return user;
    });
  }

  private async runSerializable<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (this.isSerializationConflict(error) && attempt < 2) {
          continue;
        }

        throw error;
      }
    }

    throw new Error('Nao foi possivel atualizar o acesso do usuario.');
  }

  private isSerializationConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }

  private toAuditValue(user: ManagedUserRecord) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
