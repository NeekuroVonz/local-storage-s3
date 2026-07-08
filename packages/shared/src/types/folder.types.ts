export interface StorageFolderRecord {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  projectId: string | null;
  bucketName: string;
  prefix: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  fileCount?: number;
  childCount?: number;
}
