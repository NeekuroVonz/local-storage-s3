import type { GrantSubjectType } from '../schemas/bucket-grant.schema';

export interface BucketAccessGrantRecord {
  id: string;
  bucketName: string;
  subjectType: GrantSubjectType;
  subjectId: string;
  permissions: string[];
  prefix: string;
  createdAt: string;
  subjectLabel?: string;
}
