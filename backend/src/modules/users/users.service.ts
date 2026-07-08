import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type {
  CreateUserInput,
  UpdateUserProjectsInput,
} from '@storage/shared';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async findAll(page = 1, limit = 20, search?: string) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          status: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          role: { select: { id: true, name: true, displayName: true } },
          projectMembers: {
            select: {
              role: true,
              project: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      success: true,
      data: data.map(({ projectMembers, ...user }) => ({
        ...user,
        projects: projectMembers.map((membership) => ({
          id: membership.project.id,
          name: membership.project.name,
          slug: membership.project.slug,
          role: membership.role,
        })),
      })),
      meta: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        status: true,
        emailVerified: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        role: { select: { id: true, name: true, displayName: true } },
        projectMembers: {
          select: {
            role: true,
            project: {
              select: {
                id: true,
                name: true,
                slug: true,
                buckets: { select: { bucketName: true, isDefault: true } },
              },
            },
          },
        },
        sessions: {
          select: {
            id: true,
            deviceName: true,
            ipAddress: true,
            lastActiveAt: true,
            createdAt: true,
          },
          orderBy: { lastActiveAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const { projectMembers, ...rest } = user;
    return {
      success: true,
      data: {
        ...rest,
        projects: projectMembers.map((membership) => ({
          id: membership.project.id,
          name: membership.project.name,
          slug: membership.project.slug,
          role: membership.role,
          buckets: membership.project.buckets,
        })),
      },
    };
  }

  async create(input: CreateUserInput) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const role = await this.prisma.role.findUnique({ where: { id: input.roleId } });
    if (!role) {
      throw new BadRequestException('Role not found');
    }

    if (input.projectIds.length > 0) {
      const projects = await this.prisma.project.findMany({
        where: { id: { in: input.projectIds } },
        select: { id: true },
      });
      if (projects.length !== input.projectIds.length) {
        throw new BadRequestException('One or more projects were not found');
      }
    } else if (role.name !== 'admin') {
      throw new BadRequestException(
        'Non-admin users must be assigned to at least one project (bucket access is project-scoped)',
      );
    }

    const passwordHash = await bcrypt.hash(
      input.password,
      this.configService.get<number>('bcrypt.rounds') ?? 12,
    );

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        roleId: input.roleId,
        status: input.status,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        projectMembers:
          input.projectIds.length > 0
            ? {
                create: input.projectIds.map((projectId) => ({
                  projectId,
                  role: input.projectRole,
                })),
              }
            : undefined,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        role: { select: { id: true, name: true, displayName: true } },
        projectMembers: {
          select: {
            role: true,
            project: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    const { projectMembers, ...rest } = user;
    return {
      success: true,
      data: {
        ...rest,
        projects: projectMembers.map((membership) => ({
          id: membership.project.id,
          name: membership.project.name,
          slug: membership.project.slug,
          role: membership.role,
        })),
      },
      message: 'User created',
    };
  }

  async updateRole(userId: string, roleId: string) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new BadRequestException('Role not found');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { roleId },
      select: {
        id: true,
        email: true,
        role: { select: { id: true, name: true, displayName: true } },
      },
    });
    return { success: true, data: user };
  }

  async updateStatus(userId: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({ where: { id: userId }, data: { status } });
    return { success: true, message: 'User status updated' };
  }

  async updateProjects(userId: string, input: UpdateUserProjectsInput) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (input.projectIds.length > 0) {
      const projects = await this.prisma.project.findMany({
        where: { id: { in: input.projectIds } },
        select: { id: true },
      });
      if (projects.length !== input.projectIds.length) {
        throw new BadRequestException('One or more projects were not found');
      }
    } else if (user.role.name !== 'admin') {
      throw new BadRequestException(
        'Non-admin users must remain assigned to at least one project',
      );
    }

    const existingMemberships = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true, role: true },
    });
    const previousRoleByProject = new Map(
      existingMemberships.map((membership) => [membership.projectId, membership.role]),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.projectMember.deleteMany({ where: { userId } });
      if (input.projectIds.length > 0) {
        await tx.projectMember.createMany({
          data: input.projectIds.map((projectId) => ({
            userId,
            projectId,
            role: previousRoleByProject.get(projectId) ?? input.projectRole,
          })),
        });
      }
    });

    return this.findOne(userId);
  }
}
