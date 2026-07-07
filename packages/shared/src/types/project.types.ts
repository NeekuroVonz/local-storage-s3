export type ProjectMemberRole = 'OWNER' | 'MEMBER';

export interface Organization {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectBucket {
  id: string;
  projectId: string;
  bucketName: string;
  isDefault: boolean;
  createdAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface ProjectDetail extends Project {
  organization?: Organization;
  buckets: ProjectBucket[];
  members: ProjectMember[];
}
