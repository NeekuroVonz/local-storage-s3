import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { HealthDocs } from '../../common/swagger/docs';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  @DocumentedEndpoint(HealthDocs.health)
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  @DocumentedEndpoint(HealthDocs.ready)
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    await this.redis.getClient().ping();
    return { status: 'ready', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('live')
  @DocumentedEndpoint(HealthDocs.live)
  live() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }
}
