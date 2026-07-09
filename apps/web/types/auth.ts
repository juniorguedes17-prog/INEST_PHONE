export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface LoginResponse {
  user: AuthenticatedUser;
  tokens: {
    accessToken: string;
    expiresIn: string;
  };
}
