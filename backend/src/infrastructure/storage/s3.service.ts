import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  PutBucketVersioningCommand,
  GetBucketVersioningCommand,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
  PutBucketTaggingCommand,
  GetBucketTaggingCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import type {
  StorageBucket,
  StorageObject,
  ListObjectsResult,
  MultipartUploadInit,
  UploadPartResult,
  PresignedUrlResult,
  ObjectMetadata,
} from '@storage/shared';
import { getNestedErrorMessage, toHttpException } from '../../common/utils/storage-error.util';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private client!: S3Client;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.client = new S3Client({
      endpoint: this.configService.get<string>('s3.endpoint'),
      region: this.configService.get<string>('s3.region'),
      credentials: {
        accessKeyId: this.configService.get<string>('s3.accessKeyId')!,
        secretAccessKey: this.configService.get<string>('s3.secretAccessKey')!,
      },
      forcePathStyle: this.configService.get<boolean>('s3.forcePathStyle'),
    });
    this.logger.log(
      `S3 client initialized (endpoint: ${this.configService.get<string>('s3.endpoint')})`,
    );

    try {
      await this.client.send(new ListBucketsCommand({}));
      this.logger.log('S3 connection verified');
    } catch (error) {
      this.logger.warn(
        `S3 storage unavailable: ${getNestedErrorMessage(error)}. Check S3_* variables in .env and ensure Garage is running.`,
      );
    }
  }

  getClient(): S3Client {
    return this.client;
  }

  private async withStorageError<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.logger.error(`S3 ${operation} failed: ${getNestedErrorMessage(error)}`);
      throw toHttpException(error, operation);
    }
  }

  async listBuckets(): Promise<StorageBucket[]> {
    return this.withStorageError('listBuckets', async () => {
      const response = await this.client.send(new ListBucketsCommand({}));
      const buckets = response.Buckets ?? [];

      return Promise.all(
        buckets.map(async (bucket) => {
          const name = bucket.Name!;
          let objectCount = 0;
          let size = 0;

          try {
            const stats = await this.getBucketStats(name);
            objectCount = stats.objectCount;
            size = stats.totalSize;
          } catch {
            // Bucket may be empty or inaccessible
          }

          return {
            name,
            creationDate: bucket.CreationDate?.toISOString() ?? new Date().toISOString(),
            region: this.configService.get<string>('s3.region') ?? 'garage',
            objectCount,
            size,
            versioning: false,
            publicAccess: false,
            tags: {},
          };
        }),
      );
    });
  }

  async createBucket(name: string): Promise<void> {
    return this.withStorageError('createBucket', async () => {
      await this.client.send(new CreateBucketCommand({ Bucket: name }));
    });
  }

  async deleteBucket(name: string): Promise<void> {
    return this.withStorageError('deleteBucket', async () => {
      await this.client.send(new DeleteBucketCommand({ Bucket: name }));
    });
  }

  async bucketExists(name: string): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: name }));
      return true;
    } catch {
      return false;
    }
  }

  async setBucketVersioning(name: string, enabled: boolean): Promise<void> {
    await this.client.send(
      new PutBucketVersioningCommand({
        Bucket: name,
        VersioningConfiguration: { Status: enabled ? 'Enabled' : 'Suspended' },
      }),
    );
  }

  async getBucketVersioning(name: string): Promise<boolean> {
    const response = await this.client.send(
      new GetBucketVersioningCommand({ Bucket: name }),
    );
    return response.Status === 'Enabled';
  }

  async setBucketCors(
    name: string,
    rules: Array<{
      allowedOrigins: string[];
      allowedMethods: string[];
      allowedHeaders?: string[];
      exposeHeaders?: string[];
      maxAgeSeconds?: number;
    }>,
  ): Promise<void> {
    await this.client.send(
      new PutBucketCorsCommand({
        Bucket: name,
        CORSConfiguration: {
          CORSRules: rules.map((rule) => ({
            AllowedOrigins: rule.allowedOrigins,
            AllowedMethods: rule.allowedMethods,
            AllowedHeaders: rule.allowedHeaders,
            ExposeHeaders: rule.exposeHeaders,
            MaxAgeSeconds: rule.maxAgeSeconds,
          })),
        },
      }),
    );
  }

  async getBucketCors(name: string): Promise<unknown[]> {
    try {
      const response = await this.client.send(new GetBucketCorsCommand({ Bucket: name }));
      return response.CORSRules ?? [];
    } catch {
      return [];
    }
  }

  async setBucketTags(name: string, tags: Record<string, string>): Promise<void> {
    await this.client.send(
      new PutBucketTaggingCommand({
        Bucket: name,
        Tagging: {
          TagSet: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
        },
      }),
    );
  }

  async getBucketTags(name: string): Promise<Record<string, string>> {
    try {
      const response = await this.client.send(new GetBucketTaggingCommand({ Bucket: name }));
      const tags: Record<string, string> = {};
      for (const tag of response.TagSet ?? []) {
        if (tag.Key && tag.Value) {
          tags[tag.Key] = tag.Value;
        }
      }
      return tags;
    } catch {
      return {};
    }
  }

  async listObjects(
    bucket: string,
    prefix = '',
    delimiter = '/',
    continuationToken?: string,
    maxKeys = 100,
  ): Promise<ListObjectsResult> {
    return this.withStorageError('listObjects', async () => {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          Delimiter: delimiter,
          ContinuationToken: continuationToken,
          MaxKeys: maxKeys,
        }),
      );

      const objects: StorageObject[] = (response.Contents ?? []).map((obj) =>
        this.mapS3Object(obj.Key!, obj.Size ?? 0, obj.LastModified, obj.ETag, obj.StorageClass),
      );

      const prefixes = (response.CommonPrefixes ?? []).map((p) => p.Prefix!);

      return {
        objects,
        prefixes,
        commonPrefixes: prefixes,
        continuationToken: response.NextContinuationToken ?? null,
        isTruncated: response.IsTruncated ?? false,
      };
    });
  }

  async getObjectMetadata(bucket: string, key: string): Promise<ObjectMetadata> {
    const response = await this.client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );

    const metadata: Record<string, string> = {};
    if (response.Metadata) {
      Object.assign(metadata, response.Metadata);
    }

    return {
      key,
      size: response.ContentLength ?? 0,
      contentType: response.ContentType ?? null,
      etag: response.ETag?.replace(/"/g, '') ?? '',
      lastModified: response.LastModified?.toISOString() ?? new Date().toISOString(),
      metadata,
      tags: {},
      storageClass: response.StorageClass ?? 'STANDARD',
      versionId: response.VersionId ?? null,
    };
  }

  async putObject(
    bucket: string,
    key: string,
    body: Buffer | Readable | Uint8Array,
    contentType?: string,
    metadata?: Record<string, string>,
  ): Promise<{ etag: string }> {
    return this.withStorageError('putObject', async () => {
      const response = await this.client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          Metadata: metadata,
        }),
      );
      return { etag: response.ETag?.replace(/"/g, '') ?? '' };
    });
  }

  async getObjectStream(bucket: string, key: string): Promise<{
    stream: Readable;
    contentType: string | null;
    contentLength: number;
    etag: string;
  }> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );

    return {
      stream: response.Body as Readable,
      contentType: response.ContentType ?? null,
      contentLength: response.ContentLength ?? 0,
      etag: response.ETag?.replace(/"/g, '') ?? '',
    };
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  async deleteObjects(bucket: string, keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: keys.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
  }

  async copyObject(
    sourceBucket: string,
    sourceKey: string,
    destinationBucket: string,
    destinationKey: string,
  ): Promise<{ etag: string }> {
    const response = await this.client.send(
      new CopyObjectCommand({
        Bucket: destinationBucket,
        Key: destinationKey,
        CopySource: `${sourceBucket}/${encodeURIComponent(sourceKey).replace(/%2F/g, '/')}`,
      }),
    );
    return { etag: response.CopyObjectResult?.ETag?.replace(/"/g, '') ?? '' };
  }

  async createFolder(bucket: string, prefix: string): Promise<void> {
    const folderKey = prefix.endsWith('/') ? prefix : `${prefix}/`;
    await this.putObject(bucket, folderKey, Buffer.alloc(0), 'application/x-directory');
  }

  async initiateMultipartUpload(
    bucket: string,
    key: string,
    contentType?: string,
    metadata?: Record<string, string>,
  ): Promise<MultipartUploadInit> {
    const response = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        Metadata: metadata,
      }),
    );

    return {
      uploadId: response.UploadId!,
      key,
      bucket,
    };
  }

  async uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer | Readable | Uint8Array,
  ): Promise<UploadPartResult> {
    const response = await this.client.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: body,
      }),
    );

    return {
      partNumber,
      etag: response.ETag?.replace(/"/g, '') ?? '',
    };
  }

  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<{ etag: string; location: string }> {
    const response = await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((p) => ({
            PartNumber: p.partNumber,
            ETag: p.etag,
          })),
        },
      }),
    );

    return {
      etag: response.ETag?.replace(/"/g, '') ?? '',
      location: response.Location ?? '',
    };
  }

  async abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }),
    );
  }

  async listParts(
    bucket: string,
    key: string,
    uploadId: string,
  ): Promise<Array<{ partNumber: number; etag: string; size: number }>> {
    const response = await this.client.send(
      new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: uploadId }),
    );

    return (response.Parts ?? []).map((part) => ({
      partNumber: part.PartNumber!,
      etag: part.ETag?.replace(/"/g, '') ?? '',
      size: part.Size ?? 0,
    }));
  }

  async getPresignedUrl(
    bucket: string,
    key: string,
    operation: 'getObject' | 'putObject',
    expiresIn = 3600,
  ): Promise<PresignedUrlResult> {
    const command =
      operation === 'getObject'
        ? new GetObjectCommand({ Bucket: bucket, Key: key })
        : new PutObjectCommand({ Bucket: bucket, Key: key });

    const url = await getSignedUrl(this.client, command, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return { url: this.rewritePresignedUrl(url), expiresAt };
  }

  rewritePresignedUrl(url: string): string {
    const publicEndpoint = this.configService.get<string>('s3.publicEndpoint');
    const internalEndpoint = this.configService.get<string>('s3.endpoint');

    if (!publicEndpoint || !internalEndpoint || publicEndpoint === internalEndpoint) {
      return url;
    }

    try {
      const parsed = new URL(url);
      const publicBase = new URL(publicEndpoint);
      parsed.protocol = publicBase.protocol;
      parsed.host = publicBase.host;
      return parsed.toString();
    } catch {
      return url;
    }
  }

  async getBucketStats(bucket: string): Promise<{ objectCount: number; totalSize: number }> {
    let objectCount = 0;
    let totalSize = 0;
    let continuationToken: string | undefined;

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        }),
      );

      for (const obj of response.Contents ?? []) {
        objectCount++;
        totalSize += obj.Size ?? 0;
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return { objectCount, totalSize };
  }

  async searchObjects(
    bucket: string,
    query: string,
    prefix = '',
    maxResults = 100,
  ): Promise<StorageObject[]> {
    return this.withStorageError('searchObjects', async () => {
      const results: StorageObject[] = [];
      let continuationToken: string | undefined;
      const normalizedPrefix = prefix ?? '';
      const lowerQuery = query.trim().toLowerCase();
      if (!lowerQuery) {
        return results;
      }

      do {
        const response = await this.client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: normalizedPrefix,
            ContinuationToken: continuationToken,
            MaxKeys: 1000,
          }),
        );

        for (const obj of response.Contents ?? []) {
          const key = obj.Key!;
          const name = key.split('/').filter(Boolean).pop() ?? key;
          const matches =
            name.toLowerCase().includes(lowerQuery) || key.toLowerCase().includes(lowerQuery);

          if (matches) {
            results.push(
              this.mapS3Object(key, obj.Size ?? 0, obj.LastModified, obj.ETag, obj.StorageClass),
            );
            if (results.length >= maxResults) {
              return results;
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken && results.length < maxResults);

      return results;
    });
  }

  private mapS3Object(
    key: string,
    size: number,
    lastModified?: Date,
    etag?: string,
    storageClass?: string,
  ): StorageObject {
    const name = key.split('/').filter(Boolean).pop() ?? key;
    const isFolder = key.endsWith('/');

    return {
      key,
      name,
      size,
      lastModified: lastModified?.toISOString() ?? new Date().toISOString(),
      etag: etag?.replace(/"/g, '') ?? '',
      storageClass: storageClass ?? 'STANDARD',
      contentType: null,
      isFolder,
      metadata: {},
      tags: {},
    };
  }
}
