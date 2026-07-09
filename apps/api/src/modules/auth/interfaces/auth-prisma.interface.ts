export interface AuthPermissionRecord {
  module: string;
  action: string;
  scope?: string | null;
}

export interface AuthRoleRecord {
  id: string;
  name: string;
  rolePermissions?: Array<{
    permission: AuthPermissionRecord;
  }>;
}

export interface AuthUserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  status: string;
  role: AuthRoleRecord;
}

export interface AuthPrismaClient {
  user: {
    findUnique(args: {
      where: { email?: string; id?: string };
      include?: unknown;
    }): Promise<AuthUserRecord | null>;
  };
  auditLog?: {
    create(args: {
      data: {
        userId?: string | null;
        operationType: 'LOGIN' | 'LOGOUT' | 'ERROR';
        entity: string;
        entityId?: string | null;
        context?: Record<string, unknown>;
        ipAddress?: string | null;
        userAgent?: string | null;
      };
    }): Promise<unknown>;
  };
}
