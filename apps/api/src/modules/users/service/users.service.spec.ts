import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  DuplicateManagedUserEmailError,
  LastActiveAdministratorError,
  UsersRepository,
} from '../repository/users.repository';
import { UsersService } from './users.service';

const actor: AuthenticatedUser = {
  id: 'actor-id',
  name: 'Paulo',
  email: 'paulo@inest.com',
  role: 'Administrador',
  permissions: [],
};

const activeUser = {
  id: 'new-user-id',
  name: 'Jessica',
  email: 'jessica@inest.com',
  status: 'ACTIVE' as const,
  createdAt: new Date('2026-08-18T12:00:00.000Z'),
  role: { name: 'Administrador' },
};

function createService(overrides?: Partial<Record<string, unknown>>) {
  const usersRepository = {
    listAdministrators: vi.fn().mockResolvedValue([activeUser]),
    createAdministrator: vi.fn().mockResolvedValue(activeUser),
    deactivateAdministrator: vi
      .fn()
      .mockResolvedValue({ ...activeUser, status: 'INACTIVE' as const }),
    activateAdministrator: vi.fn().mockResolvedValue(activeUser),
    ...overrides,
  };
  const passwordService = {
    hashPassword: vi.fn().mockResolvedValue('$2b$hashed-password'),
  };

  return {
    service: new UsersService(usersRepository as unknown as UsersRepository, passwordService as never),
    usersRepository,
    passwordService,
  };
}

describe('UsersService', () => {
  it('lists only safe fields and identifies the authenticated administrator', async () => {
    const { service } = createService({
      listAdministrators: vi.fn().mockResolvedValue([
        { ...activeUser, id: actor.id, passwordHash: 'must-not-leak' },
      ]),
    });

    const users = await service.list(actor.id);

    expect(users).toEqual([
      expect.objectContaining({
        id: actor.id,
        name: 'Jessica',
        role: 'Administrador',
        status: 'ACTIVE',
        isCurrentUser: true,
      }),
    ]);
    expect(users[0]).not.toHaveProperty('passwordHash');
  });

  it('hashes the password and normalizes identity fields before creating an administrator', async () => {
    const { service, usersRepository, passwordService } = createService();

    await service.createAdministrator(
      {
        name: '  Jessica  ',
        email: ' JESSICA@INEST.COM ',
        password: 'senha-segura',
      },
      actor,
    );

    expect(passwordService.hashPassword).toHaveBeenCalledWith('senha-segura');
    expect(usersRepository.createAdministrator).toHaveBeenCalledWith({
      name: 'Jessica',
      email: 'jessica@inest.com',
      passwordHash: '$2b$hashed-password',
      actorId: actor.id,
    });
  });

  it('returns a friendly error when the e-mail already exists', async () => {
    const { service } = createService({
      createAdministrator: vi.fn().mockRejectedValue(new DuplicateManagedUserEmailError()),
    });

    await expect(
      service.createAdministrator(
        { name: 'Jessica', email: 'jessica@inest.com', password: 'senha-segura' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects self-deactivation before reaching the repository', async () => {
    const { service, usersRepository } = createService();

    await expect(service.deactivateAdministrator(actor.id, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(usersRepository.deactivateAdministrator).not.toHaveBeenCalled();
  });

  it('protects the last active administrator', async () => {
    const { service } = createService({
      deactivateAdministrator: vi.fn().mockRejectedValue(new LastActiveAdministratorError()),
    });

    await expect(service.deactivateAdministrator(activeUser.id, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('deactivates another administrator without exposing sensitive data', async () => {
    const { service, usersRepository } = createService();

    const result = await service.deactivateAdministrator(activeUser.id, actor);

    expect(usersRepository.deactivateAdministrator).toHaveBeenCalledWith(activeUser.id, actor.id);
    expect(result).toMatchObject({ id: activeUser.id, status: 'INACTIVE' });
    expect(result).not.toHaveProperty('passwordHash');
  });
});
