import { describe, expect, it } from 'vitest';
import { pbkdf2Sync, randomBytes } from 'crypto';
import { PasswordService } from '../services/password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('validates generated passwords', async () => {
    const hash = await service.hashPassword('ChangeMe@12345');

    await expect(service.verifyPassword('ChangeMe@12345', hash)).resolves.toBe(true);
    await expect(service.verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('validates legacy pbkdf2 seed passwords', async () => {
    const salt = randomBytes(16).toString('hex');
    const hash = pbkdf2Sync('ChangeMe@12345', salt, 120000, 64, 'sha512').toString('hex');
    const storedHash = `pbkdf2_sha512$120000$${salt}$${hash}`;

    await expect(service.verifyPassword('ChangeMe@12345', storedHash)).resolves.toBe(true);
    await expect(service.verifyPassword('wrong-password', storedHash)).resolves.toBe(false);
  });
});
