import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { BucketAccessService } from '../services/bucket-access.service';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class BucketAccessGuard implements CanActivate {
  constructor(private readonly bucketAccess: BucketAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
      params: { bucket?: string };
    }>();

    const bucket = request.params.bucket;
    if (bucket && request.user) {
      await this.bucketAccess.assertBucketAccess(request.user, bucket);
    }

    return true;
  }
}
