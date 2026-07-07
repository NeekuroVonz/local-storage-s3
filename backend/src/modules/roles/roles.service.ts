import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      data: roles.map((role) => ({
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        isSystem: role.isSystem,
        userCount: role._count.users,
        permissions: role.permissions.map((rp) => rp.permission.name),
      })),
    };
  }

  async findAllPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return { success: true, data: permissions };
  }

  async create(data: { name: string; displayName: string; description?: string; permissions: string[] }) {
    const permissionRecords = await this.prisma.permission.findMany({
      where: { name: { in: data.permissions } },
    });

    const role = await this.prisma.role.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        permissions: {
          create: permissionRecords.map((p) => ({ permissionId: p.id })),
        },
      },
    });

    return { success: true, data: role };
  }

  async updatePermissions(roleId: string, permissions: string[]) {
    const permissionRecords = await this.prisma.permission.findMany({
      where: { name: { in: permissions } },
    });

    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    await this.prisma.rolePermission.createMany({
      data: permissionRecords.map((p) => ({ roleId, permissionId: p.id })),
    });

    return { success: true, message: 'Permissions updated' };
  }
}
