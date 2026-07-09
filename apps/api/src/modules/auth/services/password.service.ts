import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { pbkdf2Sync, timingSafeEqual } from 'crypto';

@Injectable()
export class PasswordService {
  private readonly saltRounds = 12;

  hashPassword(password: string): Promise<string> {
    return hash(password, this.saltRounds);
  }

  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    if (
      storedHash.startsWith('$2a$') ||
      storedHash.startsWith('$2b$') ||
      storedHash.startsWith('$2y$')
    ) {
      return compare(password, storedHash);
    }

    if (storedHash.startsWith('pbkdf2_sha512$')) {
      return this.verifyLegacyPbkdf2(password, storedHash);
    }

    return false;
  }

  private verifyLegacyPbkdf2(password: string, storedHash: string): boolean {
    const [, iterationsText, salt, originalHash] = storedHash.split('$');
    const iterations = Number(iterationsText);

    if (!iterations || !salt || !originalHash) {
      return false;
    }

    const calculatedHash = pbkdf2Sync(password, salt, iterations, 64, 'sha512');
    const originalBuffer = Buffer.from(originalHash, 'hex');

    if (calculatedHash.length !== originalBuffer.length) {
      return false;
    }

    return timingSafeEqual(calculatedHash, originalBuffer);
  }
}
