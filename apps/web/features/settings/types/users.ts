export type AccessUserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export interface AccessUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: AccessUserStatus;
  createdAt: string;
  isCurrentUser: boolean;
}

export interface CreateAdministratorInput {
  name: string;
  email: string;
  password: string;
}

export interface UpdateAdministratorInput {
  name: string;
  email: string;
  password?: string;
}
