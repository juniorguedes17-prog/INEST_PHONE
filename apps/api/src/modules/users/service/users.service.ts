import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { PasswordService } from '../../auth/services/password.service';
import { MINIMUM_PASSWORD_LENGTH } from '../../auth/constants/auth.constants';
import { CreateAdministratorDto, UpdateAdministratorDto } from '../dto/users.dto';
import {
  DuplicateManagedUserEmailError,
  LastActiveAdministratorError,
  ManagedUserNotFoundError,
  ManagedUserRecord,
  UserAlreadyInactiveError,
  UsersRepository,
} from '../repository/users.repository';

@Injectable()
export class UsersService {
  constructor(
    @Inject(UsersRepository) private readonly usersRepository: UsersRepository,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
  ) {}

  async list(currentUserId: string) {
    const users = await this.usersRepository.listAdministrators();
    return users.map((user) => this.toResponse(user, currentUserId));
  }

  async createAdministrator(dto: CreateAdministratorDto, actor: AuthenticatedUser) {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();

    if (!name) {
      throw new BadRequestException('Informe o nome do usuario.');
    }

    if (!email) {
      throw new BadRequestException('Informe o e-mail do usuario.');
    }

    this.assertPasswordLength(dto.password);

    const passwordHash = await this.passwordService.hashPassword(dto.password);

    try {
      const user = await this.usersRepository.createAdministrator({
        name,
        email,
        passwordHash,
        actorId: actor.id,
      });
      return this.toResponse(user, actor.id);
    } catch (error) {
      if (error instanceof DuplicateManagedUserEmailError || this.isUniqueEmailError(error)) {
        throw new ConflictException('Ja existe um usuario com este e-mail.');
      }

      if (error instanceof ManagedUserNotFoundError) {
        throw new NotFoundException('Perfil Administrador indisponivel.');
      }

      throw error;
    }
  }

  async updateAdministrator(id: string, dto: UpdateAdministratorDto, actor: AuthenticatedUser) {
    const name = dto.name === undefined ? undefined : dto.name.trim();
    const email = dto.email === undefined ? undefined : dto.email.trim().toLowerCase();

    if (name !== undefined && !name) {
      throw new BadRequestException('Informe o nome do usuario.');
    }

    if (email !== undefined && !email) {
      throw new BadRequestException('Informe o e-mail do usuario.');
    }

    if (dto.password) {
      this.assertPasswordLength(dto.password);
    }

    const passwordHash = dto.password ? await this.passwordService.hashPassword(dto.password) : undefined;

    try {
      const user = await this.usersRepository.updateAdministrator({
        id,
        name,
        email,
        passwordHash,
        actorId: actor.id,
      });
      return this.toResponse(user, actor.id);
    } catch (error) {
      if (error instanceof DuplicateManagedUserEmailError || this.isUniqueEmailError(error)) {
        throw new ConflictException('Ja existe um usuario com este e-mail.');
      }

      if (error instanceof ManagedUserNotFoundError) {
        throw new NotFoundException('Usuario administrador nao encontrado.');
      }

      throw error;
    }
  }

  async deactivateAdministrator(id: string, actor: AuthenticatedUser) {
    if (id === actor.id) {
      throw new BadRequestException('Voce nao pode desativar a propria conta.');
    }

    try {
      const user = await this.usersRepository.deactivateAdministrator(id, actor.id);
      return this.toResponse(user, actor.id);
    } catch (error) {
      if (error instanceof ManagedUserNotFoundError) {
        throw new NotFoundException('Usuario administrador nao encontrado.');
      }

      if (error instanceof LastActiveAdministratorError) {
        throw new ConflictException('Nao e permitido desativar o ultimo administrador ativo.');
      }

      if (error instanceof UserAlreadyInactiveError) {
        throw new BadRequestException('O acesso deste usuario ja esta desativado.');
      }

      throw error;
    }
  }

  async activateAdministrator(id: string, actor: AuthenticatedUser) {
    try {
      const user = await this.usersRepository.activateAdministrator(id, actor.id);
      return this.toResponse(user, actor.id);
    } catch (error) {
      if (error instanceof ManagedUserNotFoundError) {
        throw new NotFoundException('Usuario administrador nao encontrado.');
      }

      throw error;
    }
  }

  private toResponse(user: ManagedUserRecord, currentUserId: string) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      status: user.status,
      createdAt: user.createdAt,
      isCurrentUser: user.id === currentUserId,
    };
  }

  private isUniqueEmailError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }

  private assertPasswordLength(password: string) {
    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `A senha deve possuir pelo menos ${MINIMUM_PASSWORD_LENGTH} caracteres.`,
      );
    }
  }
}
