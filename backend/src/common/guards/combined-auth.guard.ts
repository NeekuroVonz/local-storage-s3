import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service';

@Injectable()
export class CombinedAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeysService: ApiKeysService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: unknown;
    }>();

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }

    const token = authHeader.slice(7);

    if (this.apiKeysService.isApiKeyToken(token)) {
      request.user = await this.apiKeysService.authenticate(token);
      return true;
    }

    const result = await super.canActivate(context);
    return result as boolean;
  }

  handleRequest<T>(err: Error | null, user: T, _info: unknown, context: ExecutionContext): T {
    const request = context.switchToHttp().getRequest<{ user?: T }>();
    if (request.user) {
      return request.user;
    }

    if (err || !user) {
      throw err ?? new UnauthorizedException('Authentication required');
    }

    return user;
  }
}
