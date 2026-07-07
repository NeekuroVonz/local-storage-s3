import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { S3Service } from '../../infrastructure/storage/s3.service';
import { BucketsService } from '../buckets/buckets.service';
import { BucketAccessService } from '../../common/services/bucket-access.service';
import { ProjectS3CredentialsService } from '../project-s3-credentials/project-s3-credentials.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import type {
  AddProjectMemberInput,
  CreateOrganizationInput,
  CreateProjectBucketInput,
  CreateProjectInput,
  LinkProjectBucketInput,
  UpdateOrganizationInput,
  UpdateProjectInput,
} from '@storage/shared';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly bucketsService: BucketsService,
    private readonly bucketAccess: BucketAccessService,
    private readonly projectS3Credentials: ProjectS3CredentialsService,
  ) {}

  async listOrganizations(user: AuthenticatedUser) {
    const organizations = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: organizations };
  }

  async createOrganization(input: CreateOrganizationInput) {
    const existing = await this.prisma.organization.findUnique({ where: { name: input.name } });
    if (existing) {
      throw new ConflictException(`Organization "${input.name}" already exists`);
    }

    const organization = await this.prisma.organization.create({
      data: {
        name: input.name,
        displayName: input.displayName,
        description: input.description,
      },
    });

    return { success: true, data: organization };
  }

  async updateOrganization(orgId: string, input: UpdateOrganizationInput) {
    await this.getOrganizationOrThrow(orgId);
    const organization = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        displayName: input.displayName,
        description: input.description,
      },
    });
    return { success: true, data: organization };
  }

  async deleteOrganization(orgId: string) {
    await this.getOrganizationOrThrow(orgId);
    await this.prisma.organization.delete({ where: { id: orgId } });
    return { success: true, message: 'Organization deleted' };
  }

  async listProjects(user: AuthenticatedUser, organizationId?: string) {
    if (this.bucketAccess.hasGlobalBucketAccess(user)) {
      const projects = await this.prisma.project.findMany({
        where: organizationId ? { organizationId } : undefined,
        include: {
          organization: true,
          buckets: true,
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return { success: true, data: projects };
    }

    const projects = await this.prisma.project.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        members: { some: { userId: user.id } },
      },
      include: {
        organization: true,
        buckets: true,
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: projects };
  }

  async getProject(projectId: string, user: AuthenticatedUser) {
    const project = await this.getProjectOrThrow(projectId);
    await this.assertProjectAccess(projectId, user);

    const detail = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        organization: true,
        buckets: { orderBy: { createdAt: 'asc' } },
        members: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return { success: true, data: detail };
  }

  async createProject(input: CreateProjectInput, user: AuthenticatedUser) {
    await this.getOrganizationOrThrow(input.organizationId);

    const existingSlug = await this.prisma.project.findUnique({ where: { slug: input.slug } });
    if (existingSlug) {
      throw new ConflictException(`Project slug "${input.slug}" already exists`);
    }

    const project = await this.prisma.project.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
      include: {
        organization: true,
        buckets: true,
        members: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    return { success: true, data: project, message: 'Project created' };
  }

  async updateProject(projectId: string, input: UpdateProjectInput, user: AuthenticatedUser) {
    await this.assertProjectAccess(projectId, user, true);
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: input.name,
        description: input.description,
      },
    });
    return { success: true, data: project };
  }

  async deleteProject(projectId: string, user: AuthenticatedUser) {
    await this.assertProjectAccess(projectId, user, true);

    const buckets = await this.prisma.projectBucket.findMany({ where: { projectId } });
    if (buckets.length > 0) {
      throw new ConflictException('Remove or reassign project buckets before deleting the project');
    }

    await this.prisma.project.delete({ where: { id: projectId } });
    return { success: true, message: 'Project deleted' };
  }

  async addMember(projectId: string, input: AddProjectMemberInput, user: AuthenticatedUser) {
    await this.assertProjectAccess(projectId, user, true);

    const memberUser = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!memberUser) {
      throw new NotFoundException('User not found');
    }

    const member = await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: input.userId } },
      create: {
        projectId,
        userId: input.userId,
        role: input.role,
      },
      update: { role: input.role },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    return { success: true, data: member, message: 'Member added' };
  }

  async removeMember(projectId: string, userId: string, user: AuthenticatedUser) {
    await this.assertProjectAccess(projectId, user, true);
    await this.prisma.projectMember.deleteMany({ where: { projectId, userId } });
    return { success: true, message: 'Member removed' };
  }

  async createProjectBucket(
    projectId: string,
    input: CreateProjectBucketInput,
    user: AuthenticatedUser,
  ) {
    await this.assertProjectAccess(projectId, user, true);

    const linked = await this.prisma.projectBucket.findUnique({
      where: { bucketName: input.name },
    });
    if (linked) {
      throw new ConflictException(`Bucket "${input.name}" is already assigned to a project`);
    }

    await this.bucketsService.createForProject(
      {
        name: input.name,
        versioning: input.versioning,
        publicAccess: input.publicAccess,
        tags: input.tags,
      },
      user.id,
      projectId,
    );

    if (input.isDefault) {
      await this.prisma.projectBucket.updateMany({
        where: { projectId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const projectBucket = await this.prisma.projectBucket.create({
      data: {
        projectId,
        bucketName: input.name,
        isDefault: input.isDefault,
      },
    });

    await this.projectS3Credentials.grantBucketAccess(projectId, input.name);

    return { success: true, data: projectBucket, message: 'Bucket created and linked to project' };
  }

  async linkProjectBucket(
    projectId: string,
    input: LinkProjectBucketInput,
    user: AuthenticatedUser,
  ) {
    await this.assertProjectAccess(projectId, user, true);

    const exists = await this.s3.bucketExists(input.bucketName);
    if (!exists) {
      throw new NotFoundException(`Bucket "${input.bucketName}" not found`);
    }

    const linked = await this.prisma.projectBucket.findUnique({
      where: { bucketName: input.bucketName },
    });
    if (linked) {
      throw new ConflictException(`Bucket "${input.bucketName}" is already assigned to a project`);
    }

    await this.prisma.bucketMetadata.upsert({
      where: { name: input.bucketName },
      create: {
        name: input.bucketName,
        projectId,
        createdById: user.id,
      },
      update: { projectId },
    });

    if (input.isDefault) {
      await this.prisma.projectBucket.updateMany({
        where: { projectId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const projectBucket = await this.prisma.projectBucket.create({
      data: {
        projectId,
        bucketName: input.bucketName,
        isDefault: input.isDefault,
      },
    });

    await this.projectS3Credentials.grantBucketAccess(projectId, input.bucketName);

    return { success: true, data: projectBucket, message: 'Bucket linked to project' };
  }

  async unlinkProjectBucket(projectId: string, bucketName: string, user: AuthenticatedUser) {
    await this.assertProjectAccess(projectId, user, true);

    const link = await this.prisma.projectBucket.findFirst({
      where: { projectId, bucketName },
    });
    if (!link) {
      throw new NotFoundException(`Bucket "${bucketName}" is not linked to this project`);
    }

    await this.prisma.projectBucket.delete({ where: { id: link.id } });
    await this.prisma.bucketMetadata.updateMany({
      where: { name: bucketName, projectId },
      data: { projectId: null },
    });

    await this.projectS3Credentials.revokeBucketAccess(projectId, bucketName);

    return { success: true, message: 'Bucket unlinked from project' };
  }

  private async getOrganizationOrThrow(orgId: string) {
    const organization = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  private async getProjectOrThrow(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  private async assertProjectAccess(
    projectId: string,
    user: AuthenticatedUser,
    requireOwner = false,
  ): Promise<void> {
    if (this.bucketAccess.hasGlobalBucketAccess(user)) {
      return;
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });

    if (!membership) {
      throw new ForbiddenException('Access denied to this project');
    }

    if (requireOwner && membership.role !== 'OWNER') {
      throw new ForbiddenException('Project owner access required');
    }
  }
}
