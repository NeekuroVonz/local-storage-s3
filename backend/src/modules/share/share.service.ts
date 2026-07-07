import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { S3Service } from '../../infrastructure/storage/s3.service';
import { ActivityService } from '../activity/activity.service';
import type { CreateShareInput } from '@storage/shared';

@Injectable()
export class ShareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly configService: ConfigService,
    private readonly activityService: ActivityService,
  ) {}

  async create(input: CreateShareInput, userId: string) {
    let passwordHash: string | undefined;
    if (input.password) {
      passwordHash = await bcrypt.hash(input.password, this.configService.get<number>('bcrypt.rounds')!);
    }

    const share = await this.prisma.share.create({
      data: {
        userId,
        bucketName: input.bucketName,
        objectKey: input.objectKey,
        permission: input.permission === 'view' ? 'VIEW' : 'DOWNLOAD',
        passwordHash,
        maxDownloads: input.maxDownloads,
        allowedIps: input.allowedIps ?? [],
        expiresAt: input.expiresAt,
      },
    });

    const appUrl = this.configService.get<string>('appUrl');
    const shareUrl = `${appUrl}/share/${share.token}`;

    await this.activityService.log({
      userId,
      action: 'SHARE',
      resource: 'share',
      resourceId: share.id,
      metadata: { bucket: input.bucketName, key: input.objectKey },
    });

    return {
      success: true,
      data: {
        id: share.id,
        token: share.token,
        url: shareUrl,
        expiresAt: share.expiresAt?.toISOString() ?? null,
        permission: share.permission.toLowerCase(),
      },
    };
  }

  async findAll(userId: string) {
    const shares = await this.prisma.share.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: shares };
  }

  async revoke(userId: string, id: string) {
    await this.prisma.share.updateMany({
      where: { id, userId },
      data: { active: false },
    });
    return { success: true, message: 'Share revoked' };
  }

  async accessShare(token: string, password?: string, ipAddress?: string) {
    const share = await this.prisma.share.findUnique({ where: { token } });

    if (!share || !share.active) {
      throw new NotFoundException('Share not found');
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new ForbiddenException('Share has expired');
    }

    if (share.maxDownloads && share.downloadCount >= share.maxDownloads) {
      throw new ForbiddenException('Download limit reached');
    }

    if (share.allowedIps.length > 0 && ipAddress && !share.allowedIps.includes(ipAddress)) {
      throw new ForbiddenException('Access denied from this IP');
    }

    if (share.passwordHash) {
      if (!password) {
        throw new ForbiddenException('Password required');
      }
      const valid = await bcrypt.compare(password, share.passwordHash);
      if (!valid) {
        throw new ForbiddenException('Invalid password');
      }
    }

    const presigned = await this.s3.getPresignedUrl(
      share.bucketName,
      share.objectKey,
      'getObject',
      3600,
    );

    await this.prisma.share.update({
      where: { id: share.id },
      data: { downloadCount: { increment: 1 } },
    });

    return {
      success: true,
      data: {
        url: presigned.url,
        permission: share.permission.toLowerCase(),
        bucketName: share.bucketName,
        objectKey: share.objectKey,
      },
    };
  }
}
