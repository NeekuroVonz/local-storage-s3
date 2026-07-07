import {
  BadRequestException,
  Injectable,
  Logger,
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
  globalAliases: string[];
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
    const bucket = await this.request<GarageBucketInfo>(
      `/v2/GetBucketInfo?globalAlias=${encodeURIComponent(bucketName)}`,
      { method: 'GET' },
    );
    return bucket.id;
  }

  async allowBucketAccess(bucketName: string, accessKeyId: string): Promise<void> {
    const bucketId = await this.getBucketId(bucketName);
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
      throw new BadRequestException(`Garage admin API failed (${response.status})`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}
