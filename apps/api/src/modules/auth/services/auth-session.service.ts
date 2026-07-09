import { Injectable } from '@nestjs/common';

interface RefreshSession {
  userId: string;
  expiresAt: number;
}

@Injectable()
export class AuthSessionService {
  private readonly refreshSessions = new Map<string, RefreshSession>();

  register(refreshTokenId: string, userId: string, expiresAt: number) {
    this.refreshSessions.set(refreshTokenId, { userId, expiresAt });
  }

  isValid(refreshTokenId: string, userId: string): boolean {
    const session = this.refreshSessions.get(refreshTokenId);

    if (!session) {
      return false;
    }

    if (session.expiresAt <= Date.now()) {
      this.refreshSessions.delete(refreshTokenId);
      return false;
    }

    return session.userId === userId;
  }

  revoke(refreshTokenId: string) {
    this.refreshSessions.delete(refreshTokenId);
  }
}
