import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ActivityService } from '../activity/activity.service';
import type { LoginInput, RegisterInput, AuthUser, AuthTokens, LoginResponse } from '@storage/shared';
import type { AuthenticatedUser, JwtPayload } from '../../common/interfaces/authenticated-user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly activityService: ActivityService,
  ) {}

  async register(input: RegisterInput): Promise<LoginResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const viewerRole = await this.prisma.role.findUnique({ where: { name: 'viewer' } });
    if (!viewerRole) {
      throw new BadRequestException('Default role not configured');
    }

    const passwordHash = await bcrypt.hash(
      input.password,
      this.configService.get<number>('bcrypt.rounds')!,
    );

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        roleId: viewerRole.id,
        status: 'ACTIVE',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    return this.createSession(user.id, user.email, user.firstName, user.lastName, user.role.name, this.extractPermissions(user.role), false);
  }

  async login(input: LoginInput, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const response = await this.createSession(
      user.id,
      user.email,
      user.firstName,
      user.lastName,
      user.role.name,
      this.extractPermissions(user.role),
      input.rememberMe,
      ipAddress,
      userAgent,
    );

    await this.activityService.log({
      userId: user.id,
      action: 'LOGIN',
      resource: 'auth',
      ipAddress,
      userAgent,
    });

    return response;
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    const permissions = this.extractPermissions(stored.user.role);
    const tokens = await this.generateTokens(
      stored.user.id,
      stored.user.email,
      stored.user.role.name,
      permissions,
      stored.sessionId ?? undefined,
      stored.expiresAt.getTime() - Date.now() > 7 * 24 * 60 * 60 * 1000,
    );

    return tokens;
  }

  async logout(userId: string, refreshToken?: string, ipAddress?: string): Promise<void> {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { token: refreshToken, userId },
        data: { revoked: true },
      });
    }

    await this.activityService.log({
      userId,
      action: 'LOGOUT',
      resource: 'auth',
      ipAddress,
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.configService.get<number>('bcrypt.rounds')!);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
  }

  async validateUser(payload: JwtPayload): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    if (!user || user.status !== 'ACTIVE') {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      permissions: this.extractPermissions(user.role),
      authType: 'jwt',
    };
  }

  private async createSession(
    userId: string,
    email: string,
    firstName: string,
    lastName: string,
    role: string,
    permissions: string[],
    rememberMe: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResponse> {
    const session = await this.prisma.session.create({
      data: {
        userId,
        ipAddress,
        userAgent,
        deviceName: this.parseDeviceName(userAgent),
        expiresAt: new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000),
      },
    });

    const tokens = await this.generateTokens(userId, email, role, permissions, session.id, rememberMe);

    const authUser: AuthUser = {
      id: userId,
      email,
      firstName,
      lastName,
      avatarUrl: null,
      role,
      permissions,
      emailVerified: true,
      twoFactorEnabled: false,
    };

    return { user: authUser, tokens };
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    permissions: string[],
    sessionId?: string,
    rememberMe = false,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email, role, permissions, sessionId };

    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn')!;
    const refreshExpiresIn = rememberMe
      ? this.configService.get<string>('jwt.refreshExpiresInRemember')!
      : this.configService.get<string>('jwt.refreshExpiresIn')!;

    const accessToken = this.jwtService.sign(payload, { expiresIn: accessExpiresIn });
    const refreshTokenValue = uuidv4();

    const refreshMs = this.parseDuration(refreshExpiresIn);
    await this.prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
        userId,
        sessionId,
        expiresAt: new Date(Date.now() + refreshMs),
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: this.parseDuration(accessExpiresIn) / 1000,
    };
  }

  private extractPermissions(role: {
    permissions: Array<{ permission: { name: string } }>;
  }): string[] {
    return role.permissions.map((rp) => rp.permission.name);
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 900000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 900000;
    }
  }

  private parseDeviceName(userAgent?: string): string | null {
    if (!userAgent) return null;
    if (userAgent.includes('Mobile')) return 'Mobile Device';
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Linux')) return 'Linux';
    return 'Unknown Device';
  }
}
