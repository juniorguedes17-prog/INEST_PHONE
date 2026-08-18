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
    updateAdministrator: vi.fn().mockResolvedValue(activeUser),
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

  it('rejects administrator creation passwords shorter than eight characters', async () => {
    const { service, passwordService, usersRepository } = createService();

    for (const password of ['123456', '1234567']) {
      await expect(
        service.createAdministrator(
          { name: 'Jessica', email: 'jessica@inest.com', password },
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    }

    expect(passwordService.hashPassword).not.toHaveBeenCalled();
    expect(usersRepository.createAdministrator).not.toHaveBeenCalled();
  });

  it('accepts administrator creation passwords with eight or more characters', async () => {
    const { service, passwordService } = createService();

    await service.createAdministrator(
      { name: 'Jessica', email: 'jessica@inest.com', password: '12345678' },
      actor,
    );
    await service.createAdministrator(
      { name: 'Jessica', email: 'jessica2@inest.com', password: '123456789' },
      actor,
    );

    expect(passwordService.hashPassword).toHaveBeenCalledWith('12345678');
    expect(passwordService.hashPassword).toHaveBeenCalledWith('123456789');
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

  it('updates name and e-mail without replacing the current password', async () => {
    const { service, usersRepository, passwordService } = createService({
      updateAdministrator: vi.fn().mockResolvedValue({
        ...activeUser,
        name: 'Jessica Ribeiro',
        email: 'jessica.ribeiro@inest.com',
      }),
    });

    const result = await service.updateAdministrator(
      activeUser.id,
      { name: ' Jessica Ribeiro ', email: ' JESSICA.RIBEIRO@INEST.COM ' },
      actor,
    );

    expect(passwordService.hashPassword).not.toHaveBeenCalled();
    expect(usersRepository.updateAdministrator).toHaveBeenCalledWith({
      id: activeUser.id,
      name: 'Jessica Ribeiro',
      email: 'jessica.ribeiro@inest.com',
      passwordHash: undefined,
      actorId: actor.id,
    });
    expect(result).toMatchObject({ name: 'Jessica Ribeiro', email: 'jessica.ribeiro@inest.com' });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('keeps the current password when the edit password is empty', async () => {
    const { service, usersRepository, passwordService } = createService();

    await service.updateAdministrator(
      activeUser.id,
      { name: 'Jessica', email: 'jessica@inest.com', password: '' },
      actor,
    );

    expect(passwordService.hashPassword).not.toHaveBeenCalled();
    expect(usersRepository.updateAdministrator).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: undefined }),
    );
  });

  it('rejects edited passwords shorter than eight characters', async () => {
    const { service, passwordService, usersRepository } = createService();

    for (const password of ['123456', '1234567']) {
      await expect(
        service.updateAdministrator(
          activeUser.id,
          { name: 'Jessica', email: 'jessica@inest.com', password },
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    }

    expect(passwordService.hashPassword).not.toHaveBeenCalled();
    expect(usersRepository.updateAdministrator).not.toHaveBeenCalled();
  });

  it('hashes an edited password and returns only safe fields', async () => {
    const { service, usersRepository, passwordService } = createService();

    const result = await service.updateAdministrator(
      activeUser.id,
      { name: 'Jessica', email: 'jessica@inest.com', password: '12345678' },
      actor,
    );

    expect(passwordService.hashPassword).toHaveBeenCalledWith('12345678');
    expect(usersRepository.updateAdministrator).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: '$2b$hashed-password' }),
    );
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('returns a friendly error when an edited e-mail already exists', async () => {
    const { service } = createService({
      updateAdministrator: vi.fn().mockRejectedValue(new DuplicateManagedUserEmailError()),
    });

    await expect(
      service.updateAdministrator(
        activeUser.id,
        { name: 'Jessica', email: 'ja-existe@inest.com' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
