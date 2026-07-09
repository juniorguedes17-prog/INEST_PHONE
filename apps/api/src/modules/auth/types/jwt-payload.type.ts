export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  type: 'access' | 'refresh';
  jti?: string;
  exp?: number;
}
