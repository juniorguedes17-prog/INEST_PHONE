import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLoggerService } from '../../../common/logger/audit-logger.service';
import { LoginDto } from '../dto/login.dto';
import { AuthPrismaClient, AuthUserRecord } from '../interfaces/auth-prisma.interface';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { JwtPayload } from '../types/jwt-payload.type';
import { AuthSessionService } from './auth-session.service';
import { AuthTokenService } from './auth-token.service';
import { PasswordService } from './password.service';

interface RequestContext extends Record<string, unknown> {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prismaService: PrismaService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(AuthTokenService) private readonly tokenService: AuthTokenService,
    @Inject(AuthSessionService) private readonly sessionService: AuthSessionService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService,
  ) {}

  async login(loginDto: LoginDto, context?: RequestContext) {
    const user = await this.findUserByEmail(loginDto.email);

    if (!user) {
      await this.auditLogger.logAuthEvent('ERROR', 'auth.login_failed', null, {
        email: loginDto.email,
        ...context,
      });
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    if (user.status !== 'ACTIVE') {
      await this.auditLogger.logAuthEvent('ERROR', 'auth.user_inactive', user.id, context);
      throw new UnauthorizedException('Usuario sem acesso ativo.');
    }

    const passwordIsValid = await this.passwordService.verifyPassword(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordIsValid) {
      await this.auditLogger.logAuthEvent('ERROR', 'auth.login_failed', user.id, context);
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const authenticatedUser = this.toAuthenticatedUser(user);
    const tokens = await this.tokenService.generateTokens(authenticatedUser);
    this.sessionService.register(
      tokens.refreshTokenId,
      authenticatedUser.id,
      tokens.refreshExpiresAt,
    );

    await this.auditLogger.logAuthEvent('LOGIN', 'auth.login_success', user.id, context);

    return {
      user: authenticatedUser,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: this.tokenService.getAccessExpiresIn(),
      },
    };
  }

  async refresh(refreshToken: string, context?: RequestContext) {
    const payload = await this.validateRefreshToken(refreshToken);
    const user = await this.findUserById(payload.sub);

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Sessao invalida.');
    }

    const authenticatedUser = this.toAuthenticatedUser(user);
    const tokens = await this.tokenService.generateTokens(authenticatedUser);

    if (payload.jti) {
      this.sessionService.revoke(payload.jti);
    }

    this.sessionService.register(
      tokens.refreshTokenId,
      authenticatedUser.id,
      tokens.refreshExpiresAt,
    );

    await this.auditLogger.logAuthEvent('LOGIN', 'auth.refresh_success', user.id, context);

    return {
      user: authenticatedUser,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: this.tokenService.getAccessExpiresIn(),
      },
    };
  }

  async logout(refreshToken?: string, userId?: string, context?: RequestContext) {
    if (refreshToken) {
      try {
        const payload = await this.tokenService.verifyRefreshToken(refreshToken);

        if (payload.jti) {
          this.sessionService.revoke(payload.jti);
        }
      } catch {
        // Logout deve permanecer idempotente mesmo quando o token ja expirou.
      }
    }

    await this.auditLogger.logAuthEvent('LOGOUT', 'auth.logout', userId ?? null, context);

    return {
      success: true,
      message: 'Sessao encerrada com sucesso.',
    };
  }

  async getSession(user: AuthenticatedUser, tokenExpiresAt?: number) {
    return {
      user,
      token: {
        expiresAt: tokenExpiresAt,
        remainingSeconds: tokenExpiresAt
          ? Math.max(tokenExpiresAt - Math.floor(Date.now() / 1000), 0)
          : null,
      },
    };
  }

  async validateAccessPayload(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token invalido.');
    }

    const user = await this.findUserById(payload.sub);

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Sessao invalida.');
    }

    return {
      ...this.toAuthenticatedUser(user),
      tokenExpiresAt: payload.exp,
    };
  }

  private async validateRefreshToken(refreshToken: string): Promise<JwtPayload> {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);

    if (payload.type !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('Refresh token invalido.');
    }

    if (!this.sessionService.isValid(payload.jti, payload.sub)) {
      throw new UnauthorizedException('Sessao expirada ou encerrada.');
    }

    return payload;
  }

  private findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: this.userInclude,
    });
  }

  private findUserById(id: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: this.userInclude,
    });
  }

  private toAuthenticatedUser(user: AuthUserRecord): AuthenticatedUser {
    const permissions =
      user.role.rolePermissions?.map(
        ({ permission }) => `${permission.module}:${permission.action}`,
      ) ?? [];

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      permissions,
    };
  }

  private get prisma(): AuthPrismaClient {
    return this.prismaService as unknown as AuthPrismaClient;
  }

  private get userInclude() {
    return {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    };
  }
}
