export interface StoredFileRecord {
  id: string;
  bucketName: string;
  objectKey: string;
  path: string;
  originalName: string;
  contentType: string;
  size: string;
  contentHash: string;
  module: string;
  ownerId: string;
  projectId: string | null;
  folderId: string | null;
  description: string | null;
  tags: string[];
  customMetadata: Record<string, unknown>;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  url?: string;
  /** False when the S3 object was removed (e.g. deleted from Bucket explorer). */
  storageAvailable?: boolean;
}

export interface FileUploadResult {
  fileId: string;
  path: string;
  url: string;
  size: string;
  hash: string;
  metadata: StoredFileRecord;
}

export interface FileBatchUploadItemResult {
  success: boolean;
  fileName: string;
  data?: FileUploadResult;
  error?: string;
}
