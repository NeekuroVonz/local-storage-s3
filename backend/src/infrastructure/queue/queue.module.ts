import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

export const UPLOAD_QUEUE = 'upload';
export const ANALYTICS_QUEUE = 'analytics';
export const NOTIFICATION_QUEUE = 'notification';
export const WEBHOOK_QUEUE = 'webhook';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: UPLOAD_QUEUE },
      { name: ANALYTICS_QUEUE },
      { name: NOTIFICATION_QUEUE },
      { name: WEBHOOK_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
