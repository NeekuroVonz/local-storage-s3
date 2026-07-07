export const SystemRole = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
  GUEST: 'guest',
} as const;

export type SystemRoleName = (typeof SystemRole)[keyof typeof SystemRole];

export const SYSTEM_ROLES: SystemRoleName[] = [
  SystemRole.ADMIN,
  SystemRole.MANAGER,
  SystemRole.OPERATOR,
  SystemRole.VIEWER,
  SystemRole.GUEST,
];

export const ROLE_HIERARCHY: Record<SystemRoleName, number> = {
  [SystemRole.ADMIN]: 100,
  [SystemRole.MANAGER]: 80,
  [SystemRole.OPERATOR]: 60,
  [SystemRole.VIEWER]: 40,
  [SystemRole.GUEST]: 20,
};
