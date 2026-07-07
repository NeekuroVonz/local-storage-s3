import { ForbiddenException, Injectable } from '@nestjs/common';
import { GrantSubjectType } from '@prisma/client';
import { Permission } from '@storage/shared';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

interface SubjectRef {
  type: GrantSubjectType;
  id: string;
}

@Injectable()
export class BucketAccessService {
  constructor(private readonly prisma: PrismaService) {}

  hasGlobalBucketAccess(user: AuthenticatedUser): boolean {
    if (user.authType === 'api_key') {
      return false;
    }

    return (
      user.role === 'admin' ||
      user.permissions.includes(Permission.BUCKETS_MANAGE) ||
      user.permissions.includes(Permission.PROJECTS_MANAGE)
    );
  }

  normalizePrefix(prefix: string): string {
    const trimmed = prefix.trim();
    if (!trimmed) {
      return '';
    }
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }

  keyMatchesPrefix(key: string, grantPrefix: string): boolean {
    const normalized = this.normalizePrefix(grantPrefix);
    if (!normalized) {
      return true;
    }

    const folderName = normalized.slice(0, -1);
    return key === folderName || key.startsWith(normalized);
  }

  listPrefixAllowed(requestedPrefix: string, grantPrefix: string): boolean {
    const request = this.normalizePrefix(requestedPrefix);
    const grant = this.normalizePrefix(grantPrefix);
    if (!grant) {
      return true;
    }
    if (!request) {
      return true;
    }
    return request.startsWith(grant) || grant.startsWith(request);
  }

  async getAccessibleBucketNames(user: AuthenticatedUser): Promise<string[] | null> {
    if (this.hasGlobalBucketAccess(user)) {
      return null;
    }

    if (user.authType === 'api_key' && user.projectId) {
      const projectBuckets = await this.getApiKeyBucketNames(user.projectId, user.bucketAllowlist);
      return this.mergeBucketNames(projectBuckets, await this.getGrantBucketNames(user));
    }

    const projectBuckets = await this.getProjectMemberBucketNames(user.id);
    const grantBuckets = await this.getGrantBucketNames(user);

    if (projectBuckets.length === 0 && grantBuckets.length === 0) {
      return null;
    }

    return this.mergeBucketNames(projectBuckets, grantBuckets);
  }

  async assertBucketAccess(user: AuthenticatedUser, bucketName: string): Promise<void> {
    if (this.hasGlobalBucketAccess(user)) {
      return;
    }

    const allowed = await this.getAccessibleBucketNames(user);
    if (allowed === null) {
      return;
    }

    if (!allowed.includes(bucketName)) {
      throw new ForbiddenException(`Access denied to bucket "${bucketName}"`);
    }
  }

  async assertObjectKeyAccess(
    user: AuthenticatedUser,
    bucketName: string,
    objectKey: string,
  ): Promise<void> {
    await this.assertBucketAccess(user, bucketName);

    const restrictions = await this.getPrefixRestrictions(user, bucketName);
    if (restrictions === null) {
      return;
    }

    const allowed = restrictions.some((prefix) => this.keyMatchesPrefix(objectKey, prefix));
    if (!allowed) {
      throw new ForbiddenException(`Access denied to object "${objectKey}"`);
    }
  }

  async assertListPrefixAccess(
    user: AuthenticatedUser,
    bucketName: string,
    requestedPrefix: string,
  ): Promise<void> {
    await this.assertBucketAccess(user, bucketName);

    const restrictions = await this.getPrefixRestrictions(user, bucketName);
    if (restrictions === null) {
      return;
    }

    const allowed = restrictions.some((prefix) =>
      this.listPrefixAllowed(requestedPrefix, prefix),
    );
    if (!allowed) {
      throw new ForbiddenException(`Access denied to prefix "${requestedPrefix}"`);
    }
  }

  async filterObjectsByPrefix<T extends { key: string }>(
    user: AuthenticatedUser,
    bucketName: string,
    objects: T[],
  ): Promise<T[]> {
    const restrictions = await this.getPrefixRestrictions(user, bucketName);
    if (restrictions === null) {
      return objects;
    }

    return objects.filter((object) =>
      restrictions.some((prefix) => this.keyMatchesPrefix(object.key, prefix)),
    );
  }

  async filterCommonPrefixes(
    user: AuthenticatedUser,
    bucketName: string,
    prefixes: string[],
  ): Promise<string[]> {
    const restrictions = await this.getPrefixRestrictions(user, bucketName);
    if (restrictions === null) {
      return prefixes;
    }

    return prefixes.filter((prefix) =>
      restrictions.some((grantPrefix) => this.listPrefixAllowed(prefix, grantPrefix)),
    );
  }

  async filterBucketNames(user: AuthenticatedUser, bucketNames: string[]): Promise<string[]> {
    if (this.hasGlobalBucketAccess(user)) {
      return bucketNames;
    }

    const allowed = await this.getAccessibleBucketNames(user);
    if (allowed === null) {
      return bucketNames;
    }

    const allowedSet = new Set(allowed);
    return bucketNames.filter((name) => allowedSet.has(name));
  }

  async filterBuckets<T extends { name: string }>(
    user: AuthenticatedUser,
    buckets: T[],
  ): Promise<T[]> {
    if (this.hasGlobalBucketAccess(user)) {
      return buckets;
    }

    const allowed = await this.getAccessibleBucketNames(user);
    if (allowed === null) {
      return buckets;
    }

    const allowedSet = new Set(allowed);
    return buckets.filter((bucket) => allowedSet.has(bucket.name));
  }

  private async getPrefixRestrictions(
    user: AuthenticatedUser,
    bucketName: string,
  ): Promise<string[] | null> {
    if (this.hasGlobalBucketAccess(user)) {
      return null;
    }

    const subject = this.getSubjectRef(user);
    if (!subject) {
      return null;
    }

    const grants = await this.prisma.bucketAccessGrant.findMany({
      where: {
        bucketName,
        subjectType: subject.type,
        subjectId: subject.id,
      },
      select: { prefix: true },
    });

    if (grants.length === 0) {
      return null;
    }

    return grants.map((grant) => this.normalizePrefix(grant.prefix));
  }

  private getSubjectRef(user: AuthenticatedUser): SubjectRef | null {
    if (user.authType === 'api_key' && user.apiKeyId) {
      return { type: GrantSubjectType.API_KEY, id: user.apiKeyId };
    }

    if (user.authType !== 'api_key') {
      return { type: GrantSubjectType.USER, id: user.id };
    }

    return null;
  }

  private async getGrantBucketNames(user: AuthenticatedUser): Promise<string[]> {
    const subject = this.getSubjectRef(user);
    if (!subject) {
      return [];
    }

    const grants = await this.prisma.bucketAccessGrant.findMany({
      where: {
        subjectType: subject.type,
        subjectId: subject.id,
      },
      select: { bucketName: true },
      distinct: ['bucketName'],
    });

    return grants.map((grant) => grant.bucketName);
  }

  private async getProjectMemberBucketNames(userId: string): Promise<string[]> {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      select: {
        project: {
          select: {
            buckets: {
              select: { bucketName: true },
            },
          },
        },
      },
    });

    const bucketNames = new Set<string>();
    for (const membership of memberships) {
      for (const bucket of membership.project.buckets) {
        bucketNames.add(bucket.bucketName);
      }
    }

    return Array.from(bucketNames);
  }

  private async getApiKeyBucketNames(
    projectId: string,
    bucketAllowlist?: string[],
  ): Promise<string[]> {
    const projectBuckets = await this.prisma.projectBucket.findMany({
      where: { projectId },
      select: { bucketName: true },
    });

    const names = projectBuckets.map((bucket) => bucket.bucketName);

    if (bucketAllowlist && bucketAllowlist.length > 0) {
      const allowSet = new Set(bucketAllowlist);
      return names.filter((name) => allowSet.has(name));
    }

    return names;
  }

  private mergeBucketNames(first: string[], second: string[]): string[] {
    return Array.from(new Set([...first, ...second]));
  }
}
