import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      success: true,
      data,
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
        sessions: {
          select: { id: true, deviceName: true, ipAddress: true, lastActiveAt: true, createdAt: true },
          orderBy: { lastActiveAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return { success: true, data: user };
  }

  async updateRole(userId: string, roleId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { roleId },
      select: { id: true, email: true, role: { select: { name: true } } },
    });
    return { success: true, data: user };
  }

  async updateStatus(userId: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    await this.prisma.user.update({ where: { id: userId }, data: { status } });
    return { success: true, message: 'User status updated' };
  }
}
