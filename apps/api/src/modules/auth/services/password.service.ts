import { Injectable } from '@nestjs/common';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

@Injectable()
export class PasswordService {
  private readonly iterations = 120000;

  hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(password, salt, this.iterations, 64, 'sha512').toString('hex');

    return Promise.resolve(`pbkdf2_sha512$${this.iterations}$${salt}$${hash}`);
  }

  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
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
