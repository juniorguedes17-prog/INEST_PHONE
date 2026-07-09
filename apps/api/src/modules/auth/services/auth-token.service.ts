import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { JwtPayload } from '../types/jwt-payload.type';

interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
  refreshExpiresAt: number;
}

@Injectable()
export class AuthTokenService {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async generateTokens(user: AuthenticatedUser): Promise<AuthTokenPair> {
    const refreshTokenId = randomUUID();
    const refreshExpiresAt = Date.now() + this.parseDuration(this.getRefreshExpiresIn());

    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      ...accessPayload,
      type: 'refresh',
      jti: refreshTokenId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.get<string>('auth.jwtSecret'),
        expiresIn: this.getAccessExpiresIn(),
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.get<string>('auth.jwtRefreshSecret'),
        expiresIn: this.getRefreshExpiresIn(),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      refreshTokenId,
      refreshExpiresAt,
    };
  }

  verifyRefreshToken(refreshToken: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
      secret: this.configService.get<string>('auth.jwtRefreshSecret'),
    });
  }

  getAccessExpiresIn(): string {
    return this.configService.get<string>('auth.jwtExpiresIn', '15m');
  }

  getRefreshExpiresIn(): string {
    return this.configService.get<string>('auth.jwtRefreshExpiresIn', '7d');
  }

  private parseDuration(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);

    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    const value = Number(match[1]);
    const unit = match[2];

    if (!unit || !multipliers[unit]) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    return value * multipliers[unit];
  }
}
