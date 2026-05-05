import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { FirebasePushService } from './firebase-push.service';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, FirebasePushService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
