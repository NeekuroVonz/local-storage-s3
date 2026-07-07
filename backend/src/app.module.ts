import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './infrastructure/database/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { GarageModule } from './infrastructure/garage/garage.module';
import { TenancyModule } from './infrastructure/tenancy/tenancy.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { BucketsModule } from './modules/buckets/buckets.module';
import { ObjectsModule } from './modules/objects/objects.module';
import { UploadModule } from './modules/upload/upload.module';
import { DownloadModule } from './modules/download/download.module';
import { SearchModule } from './modules/search/search.module';
import { ShareModule } from './modules/share/share.module';
import { ActivityModule } from './modules/activity/activity.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { StorageEventsModule } from './modules/storage-events/storage-events.module';
import { CombinedAuthGuard } from './common/guards/combined-auth.guard';
import { JwtOnlyGuard } from './common/guards/jwt-only.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      load: [configuration],
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        level: process.env.LOG_LEVEL ?? 'info',
        redact: ['req.headers.authorization'],
      },
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 200 },
    ]),
    DatabaseModule,
    RedisModule,
    StorageModule,
    GarageModule,
    TenancyModule,
    ApiKeysModule,
    QueueModule,
    AuthModule,
    UsersModule,
    RolesModule,
    BucketsModule,
    ObjectsModule,
    UploadModule,
    DownloadModule,
    SearchModule,
    ShareModule,
    ActivityModule,
    DashboardModule,
    AnalyticsModule,
    NotificationsModule,
    AdminModule,
    ProjectsModule,
    StorageEventsModule,
    HealthModule,
    SettingsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CombinedAuthGuard },
    { provide: APP_GUARD, useClass: JwtOnlyGuard },
  ],
})
export class AppModule {}
