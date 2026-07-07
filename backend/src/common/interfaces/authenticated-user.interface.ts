export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  authType?: AuthType;
  projectId?: string;
  apiKeyId?: string;
  bucketAllowlist?: string[];
}

export type AuthType = 'jwt' | 'api_key';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  permissions: string[];
  sessionId?: string;
}
