import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface GarageKeyInfo {
  accessKeyId: string;
  name: string;
  secretAccessKey?: string;
}

interface GarageBucketInfo {
  id: string;
  globalAliases?: string[];
  localAliases?: Array<{ accessKeyId: string; alias: string }>;
}

@Injectable()
export class GarageAdminService {
  private readonly logger = new Logger(GarageAdminService.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('garage.adminEndpoint') &&
        this.configService.get<string>('garage.adminToken'),
    );
  }

  async createKey(name: string): Promise<{ accessKeyId: string; secretAccessKey: string }> {
    const key = await this.request<GarageKeyInfo>('/v2/CreateKey', {
      method: 'POST',
      body: JSON.stringify({
        name,
        neverExpires: true,
        allow: { createBucket: false },
      }),
    });

    if (!key.secretAccessKey) {
      throw new BadRequestException('Garage did not return a secret access key');
    }

    return {
      accessKeyId: key.accessKeyId,
      secretAccessKey: key.secretAccessKey,
    };
  }

  async getBucketId(bucketName: string): Promise<string> {
    // Prefer globalAlias; S3 CreateBucket often only creates a local alias on the root key.
    try {
      const byGlobal = await this.request<GarageBucketInfo>(
        `/v2/GetBucketInfo?globalAlias=${encodeURIComponent(bucketName)}`,
        { method: 'GET' },
      );
      return byGlobal.id;
    } catch (error) {
      if (!this.isNotFound(error)) {
        throw error;
      }
    }

    try {
      const bySearch = await this.request<GarageBucketInfo>(
        `/v2/GetBucketInfo?search=${encodeURIComponent(bucketName)}`,
        { method: 'GET' },
      );
      if (this.bucketMatchesName(bySearch, bucketName)) {
        return bySearch.id;
      }
    } catch (error) {
      if (!this.isNotFound(error)) {
        throw error;
      }
    }

    const buckets = await this.request<GarageBucketInfo[]>('/v2/ListBuckets', { method: 'GET' });
    const match = buckets.find((bucket) => this.bucketMatchesName(bucket, bucketName));
    if (!match) {
      throw new NotFoundException(
        `Garage bucket "${bucketName}" not found (no global/local alias). Create/link the bucket first.`,
      );
    }
    return match.id;
  }

  async ensureGlobalAlias(bucketName: string): Promise<string> {
    const bucketId = await this.getBucketId(bucketName);

    try {
      const info = await this.request<GarageBucketInfo>(
        `/v2/GetBucketInfo?id=${encodeURIComponent(bucketId)}`,
        { method: 'GET' },
      );
      if (info.globalAliases?.includes(bucketName)) {
        return bucketId;
      }
    } catch {
      // Continue and attempt to add the alias.
    }

    await this.request('/v2/AddBucketAlias', {
      method: 'POST',
      body: JSON.stringify({
        bucketId,
        globalAlias: bucketName,
      }),
    });

    return bucketId;
  }

  async allowBucketAccess(bucketName: string, accessKeyId: string): Promise<void> {
    const bucketId = await this.ensureGlobalAlias(bucketName);
    await this.request('/v2/AllowBucketKey', {
      method: 'POST',
      body: JSON.stringify({
        bucketId,
        accessKeyId,
        permissions: { read: true, write: true, owner: false },
      }),
    });
  }

  async denyBucketAccess(bucketName: string, accessKeyId: string): Promise<void> {
    const bucketId = await this.getBucketId(bucketName);
    await this.request('/v2/DenyBucketKey', {
      method: 'POST',
      body: JSON.stringify({
        bucketId,
        accessKeyId,
        permissions: { read: true, write: true, owner: false },
      }),
    });
  }

  private bucketMatchesName(bucket: GarageBucketInfo, bucketName: string): boolean {
    if (bucket.globalAliases?.includes(bucketName)) {
      return true;
    }
    return Boolean(bucket.localAliases?.some((alias) => alias.alias === bucketName));
  }

  private isNotFound(error: unknown): boolean {
    return (
      error instanceof NotFoundException ||
      (error instanceof BadRequestException &&
        String(error.message).includes('(404)'))
    );
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = this.configService.get<string>('garage.adminEndpoint');
    const token = this.configService.get<string>('garage.adminToken');

    if (!baseUrl || !token) {
      throw new ServiceUnavailableException(
        'Garage admin API is not configured (GARAGE_ADMIN_ENDPOINT, GARAGE_ADMIN_TOKEN)',
      );
    }

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Garage admin ${path} failed: ${response.status} ${text}`);
      if (response.status === 404) {
        throw new NotFoundException(`Garage admin API 404 on ${path}: ${text || 'not found'}`);
      }
      throw new BadRequestException(
        `Garage admin API failed (${response.status}): ${text || response.statusText}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}
