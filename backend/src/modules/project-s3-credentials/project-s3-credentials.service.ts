import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { GarageAdminService } from '../../infrastructure/garage/garage-admin.service';
import { EncryptionService } from '../../common/services/encryption.service';

@Injectable()
export class ProjectS3CredentialsService {
  private readonly logger = new Logger(ProjectS3CredentialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly garageAdmin: GarageAdminService,
    private readonly encryption: EncryptionService,
    private readonly configService: ConfigService,
  ) {}

  async getStatus(projectId: string) {
    const project = await this.getProjectOrThrow(projectId);

    return {
      success: true,
      data: {
        provisioned: Boolean(project.s3AccessKeyId),
        keyName: project.s3KeyName,
        accessKeyId: project.s3AccessKeyId,
        provisionedAt: project.s3CredentialsProvisionedAt?.toISOString() ?? null,
        endpoint: this.getPublicS3Endpoint(),
        region: this.configService.get<string>('s3.region') ?? 'garage',
        forcePathStyle: this.configService.get<boolean>('s3.forcePathStyle') ?? true,
        garageAdminConfigured: this.garageAdmin.isConfigured(),
      },
    };
  }

  async provision(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { buckets: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.s3AccessKeyId) {
      throw new ConflictException('S3 credentials already provisioned for this project');
    }

    if (!this.garageAdmin.isConfigured()) {
      throw new BadRequestException('Garage admin API is not configured');
    }

    const keyName = `project-${project.slug}`;
    const created = await this.garageAdmin.createKey(keyName);

    for (const bucket of project.buckets) {
      await this.garageAdmin.allowBucketAccess(bucket.bucketName, created.accessKeyId);
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        s3KeyName: keyName,
        s3AccessKeyId: created.accessKeyId,
        s3SecretAccessKeyEnc: this.encryption.encrypt(created.secretAccessKey),
        s3CredentialsProvisionedAt: new Date(),
      },
    });

    return {
      success: true,
      data: this.buildCredentialResponse(created.accessKeyId, created.secretAccessKey),
      message: 'S3 credentials provisioned — save the secret now, it will not be shown again',
    };
  }

  async rotate(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { buckets: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!project.s3AccessKeyId) {
      throw new BadRequestException('S3 credentials are not provisioned for this project');
    }

    if (!this.garageAdmin.isConfigured()) {
      throw new BadRequestException('Garage admin API is not configured');
    }

    const previousAccessKeyId = project.s3AccessKeyId;
    const keyName = `project-${project.slug}`;
    const created = await this.garageAdmin.createKey(`${keyName}-rotated`);

    for (const bucket of project.buckets) {
      await this.garageAdmin.allowBucketAccess(bucket.bucketName, created.accessKeyId);
    }

    for (const bucket of project.buckets) {
      try {
        await this.garageAdmin.denyBucketAccess(bucket.bucketName, previousAccessKeyId);
      } catch (error) {
        this.logger.warn(
          `Failed to revoke old key on bucket "${bucket.bucketName}": ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        s3KeyName: `${keyName}-rotated`,
        s3AccessKeyId: created.accessKeyId,
        s3SecretAccessKeyEnc: this.encryption.encrypt(created.secretAccessKey),
        s3CredentialsProvisionedAt: new Date(),
      },
    });

    return {
      success: true,
      data: this.buildCredentialResponse(created.accessKeyId, created.secretAccessKey),
      message: 'S3 credentials rotated — save the new secret now',
    };
  }

  async revoke(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { buckets: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!project.s3AccessKeyId) {
      throw new BadRequestException('S3 credentials are not provisioned for this project');
    }

    if (this.garageAdmin.isConfigured()) {
      for (const bucket of project.buckets) {
        try {
          await this.garageAdmin.denyBucketAccess(bucket.bucketName, project.s3AccessKeyId);
        } catch (error) {
          this.logger.warn(
            `Failed to revoke key on bucket "${bucket.bucketName}": ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        s3KeyName: null,
        s3AccessKeyId: null,
        s3SecretAccessKeyEnc: null,
        s3CredentialsProvisionedAt: null,
      },
    });

    return { success: true, message: 'S3 credentials revoked' };
  }

  async grantBucketAccess(projectId: string, bucketName: string): Promise<void> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project?.s3AccessKeyId || !this.garageAdmin.isConfigured()) {
      return;
    }

    await this.garageAdmin.allowBucketAccess(bucketName, project.s3AccessKeyId);
  }

  async revokeBucketAccess(projectId: string, bucketName: string): Promise<void> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project?.s3AccessKeyId || !this.garageAdmin.isConfigured()) {
      return;
    }

    try {
      await this.garageAdmin.denyBucketAccess(bucketName, project.s3AccessKeyId);
    } catch (error) {
      this.logger.warn(
        `Failed to revoke bucket "${bucketName}" from project key: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private buildCredentialResponse(accessKeyId: string, secretAccessKey: string) {
    return {
      accessKeyId,
      secretAccessKey,
      endpoint: this.getPublicS3Endpoint(),
      region: this.configService.get<string>('s3.region') ?? 'garage',
      forcePathStyle: this.configService.get<boolean>('s3.forcePathStyle') ?? true,
    };
  }

  private getPublicS3Endpoint(): string {
    return (
      this.configService.get<string>('s3.publicEndpoint') ??
      this.configService.get<string>('s3.endpoint') ??
      ''
    );
  }

  private async getProjectOrThrow(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }
}
