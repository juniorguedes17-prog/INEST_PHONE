import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AuthSessionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async register(refreshTokenId: string, userId: string, expiresAt: number) {
    await this.prisma.refreshSession.create({
      data: {
        tokenId: refreshTokenId,
        userId,
        expiresAt: new Date(expiresAt),
      },
    });
  }

  async isValid(refreshTokenId: string, userId: string): Promise<boolean> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenId: refreshTokenId },
    });

    if (!session || session.userId !== userId) {
      return false;
    }

    if (session.expiresAt <= new Date()) {
      await this.prisma.refreshSession.delete({ where: { tokenId: refreshTokenId } });
      return false;
    }

    return true;
  }

  async revoke(refreshTokenId: string) {
    await this.prisma.refreshSession.deleteMany({ where: { tokenId: refreshTokenId } });
  }
}
