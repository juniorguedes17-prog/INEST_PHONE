import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuditLoggerService } from './audit-logger.service';

describe('AuditLoggerService', () => {
  it('does not wait for auth audit persistence', async () => {
    let resolveCreate!: () => void;
    const create = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolveCreate = resolve;
      }),
    );
    const service = new AuditLoggerService({ auditLog: { create } } as never);

    service.logAuthEvent('LOGIN', 'auth.login_success', 'user-id');

    expect(create).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(create).toHaveBeenCalledTimes(1);

    resolveCreate();
  });

  it('observes persistence failures without rejecting the caller', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = new AuditLoggerService({
      auditLog: { create: vi.fn().mockRejectedValue(new Error('database unavailable')) },
    } as never);

    expect(() => service.logAuthEvent('LOGOUT', 'auth.logout', 'user-id')).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'audit.auth_event_failed',
        error: 'database unavailable',
      }),
    );
    warn.mockRestore();
  });
});
