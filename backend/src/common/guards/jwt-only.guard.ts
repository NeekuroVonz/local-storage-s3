import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JWT_ONLY_KEY } from '../decorators/jwt-only.decorator';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class JwtOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const jwtOnly = this.reflector.getAllAndOverride<boolean>(JWT_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!jwtOnly) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    if (request.user?.authType === 'api_key') {
      throw new ForbiddenException('This endpoint requires user authentication');
    }

    return true;
  }
}
