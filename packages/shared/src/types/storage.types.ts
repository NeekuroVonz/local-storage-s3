export interface StorageObject {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  etag: string;
  storageClass: string;
  contentType: string | null;
  isFolder: boolean;
  metadata: Record<string, string>;
  tags: Record<string, string>;
}

export interface StorageBucket {
  name: string;
  creationDate: string;
  region: string;
  objectCount: number;
  size: number;
  versioning: boolean;
  publicAccess: boolean;
  tags: Record<string, string>;
}

export interface ListObjectsResult {
  objects: StorageObject[];
  prefixes: string[];
  continuationToken: string | null;
  isTruncated: boolean;
  commonPrefixes: string[];
}

export interface UploadPartResult {
  partNumber: number;
  etag: string;
}

export interface MultipartUploadInit {
  uploadId: string;
  key: string;
  bucket: string;
}

export interface PresignedUrlResult {
  url: string;
  expiresAt: string;
}

export interface ObjectMetadata {
  key: string;
  size: number;
  contentType: string | null;
  etag: string;
  lastModified: string;
  metadata: Record<string, string>;
  tags: Record<string, string>;
  storageClass: string;
  versionId: string | null;
}

export interface BucketStats {
  objectCount: number;
  totalSize: number;
  fileTypeDistribution: Record<string, number>;
}

export interface StorageAnalytics {
  storageByBucket: Array<{ bucket: string; size: number; objectCount: number }>;
  uploadsPerDay: Array<{ date: string; count: number }>;
  downloadsPerDay: Array<{ date: string; count: number }>;
  fileTypes: Array<{ type: string; count: number; size: number }>;
  largestFiles: StorageObject[];
  largestBuckets: StorageBucket[];
}

export type ActivityAction =
  | 'login'
  | 'logout'
  | 'upload'
  | 'download'
  | 'delete'
  | 'rename'
  | 'move'
  | 'copy'
  | 'share'
  | 'bucket_create'
  | 'bucket_delete'
  | 'permission_change';
