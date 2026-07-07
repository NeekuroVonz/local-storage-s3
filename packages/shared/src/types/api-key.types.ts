export type AuthType = 'jwt' | 'api_key';

export interface ApiKeyRecord {
  id: string;
  projectId: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  bucketNames: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ApiKeyCreated extends ApiKeyRecord {
  key: string;
}
