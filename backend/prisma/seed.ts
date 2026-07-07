import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS, SystemRole } from '@storage/shared';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

  const permissionRecords = await Promise.all(
    ALL_PERMISSIONS.map((name) => {
      const category = name.split(':')[0];
      return prisma.permission.upsert({
        where: { name },
        create: {
          name,
          displayName: name.replace(':', ' ').replace(/_/g, ' '),
          category,
          description: `Permission: ${name}`,
        },
        update: {},
      });
    }),
  );

  const permissionMap = new Map(permissionRecords.map((p) => [p.name, p.id]));

  for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      create: {
        name: roleName,
        displayName: roleName.charAt(0).toUpperCase() + roleName.slice(1),
        description: `System ${roleName} role`,
        isSystem: Object.values(SystemRole).includes(roleName as typeof SystemRole.ADMIN),
      },
      update: {},
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    for (const permName of permissions) {
      const permId = permissionMap.get(permName);
      if (permId) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: permId },
        });
      }
    }
  }

  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
  if (adminRole) {
    const passwordHash = await bcrypt.hash('Admin123!', 12);
    await prisma.user.upsert({
      where: { email: 'admin@storage.local' },
      create: {
        email: 'admin@storage.local',
        passwordHash,
        firstName: 'System',
        lastName: 'Admin',
        roleId: adminRole.id,
        status: 'ACTIVE',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      update: {},
    });
  }

  console.log('Seed completed.');
  console.log('Default admin: admin@storage.local / Admin123!');

  const defaultOrg = await prisma.organization.upsert({
    where: { name: 'platform' },
    create: {
      name: 'platform',
      displayName: 'Platform',
      description: 'Default organization for internal projects',
    },
    update: {},
  });

  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@storage.local' } });
  if (adminUser) {
    await prisma.project.upsert({
      where: { slug: 'platform-default' },
      create: {
        organizationId: defaultOrg.id,
        name: 'Default',
        slug: 'platform-default',
        description: 'Default project for platform administration',
        members: {
          create: {
            userId: adminUser.id,
            role: 'OWNER',
          },
        },
      },
      update: {},
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
