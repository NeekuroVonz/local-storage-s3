import { createHash, randomBytes } from 'crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import type { CreateApiKeyInput } from '@storage/shared';

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function generateApiKey(environment: 'live' | 'test'): { fullKey: string; prefix: string } {
  const random = randomBytes(24).toString('base64url');
  const fullKey = `sk_${environment}_${random}`;
  const prefix = `${fullKey.slice(0, 16)}...`;
  return { fullKey, prefix };
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, input: CreateApiKeyInput, createdById: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { buckets: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (input.bucketNames.length > 0) {
      const projectBucketSet = new Set(project.buckets.map((b) => b.bucketName));
      const invalid = input.bucketNames.filter((name) => !projectBucketSet.has(name));
      if (invalid.length > 0) {
        throw new ForbiddenException(
          `Buckets not in project: ${invalid.join(', ')}`,
        );
      }
    }

    const { fullKey, prefix } = generateApiKey(input.environment);
    const keyHash = hashApiKey(fullKey);
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const record = await this.prisma.apiKey.create({
      data: {
        projectId,
        name: input.name,
        keyPrefix: prefix,
        keyHash,
        permissions: input.permissions,
        bucketNames: input.bucketNames,
        expiresAt,
        createdById,
      },
    });

    return {
      success: true,
      data: {
        id: record.id,
        projectId: record.projectId,
        name: record.name,
        key: fullKey,
        keyPrefix: record.keyPrefix,
        permissions: record.permissions,
        bucketNames: record.bucketNames,
        expiresAt: record.expiresAt?.toISOString() ?? null,
        lastUsedAt: null,
        revokedAt: null,
        createdAt: record.createdAt.toISOString(),
      },
      message: 'Store this key securely — it will not be shown again.',
    };
  }

  async list(projectId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { projectId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: keys.map((key) => this.toPublicRecord(key)),
    };
  }

  async revoke(projectId: string, keyId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, projectId },
    });
    if (!key) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    return { success: true, message: 'API key revoked' };
  }

  async authenticate(presentedKey: string): Promise<AuthenticatedUser> {
    if (!presentedKey.startsWith('sk_live_') && !presentedKey.startsWith('sk_test_')) {
      throw new UnauthorizedException('Invalid API key format');
    }

    const keyHash = hashApiKey(presentedKey);
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        project: { select: { id: true, slug: true, name: true } },
      },
    });

    if (!apiKey || apiKey.revokedAt) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    void this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      id: apiKey.id,
      email: `api-key@${apiKey.project.slug}`,
      firstName: apiKey.name,
      lastName: 'API Key',
      role: 'api_key',
      permissions: apiKey.permissions,
      authType: 'api_key',
      projectId: apiKey.projectId,
      apiKeyId: apiKey.id,
      bucketAllowlist: apiKey.bucketNames.length > 0 ? apiKey.bucketNames : undefined,
    };
  }

  isApiKeyToken(token: string): boolean {
    return token.startsWith('sk_live_') || token.startsWith('sk_test_');
  }

  private toPublicRecord(key: {
    id: string;
    projectId: string;
    name: string;
    keyPrefix: string;
    permissions: string[];
    bucketNames: string[];
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: key.id,
      projectId: key.projectId,
      name: key.name,
      keyPrefix: key.keyPrefix,
      permissions: key.permissions,
      bucketNames: key.bucketNames,
      expiresAt: key.expiresAt?.toISOString() ?? null,
      lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
      revokedAt: key.revokedAt?.toISOString() ?? null,
      createdAt: key.createdAt.toISOString(),
    };
  }
}
