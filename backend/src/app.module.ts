import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DriversModule } from './drivers/drivers.module';
import { MailModule } from './mail/mail.module';
import { PartnersModule } from './partners/partners.module';
import { PlacesModule } from './places/places.module';
import { PricingModule } from './pricing/pricing.module';
import { QueueModule } from './queue/queue.module';
import { RidesModule } from './rides/rides.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    StorageModule,
    MailModule,
    QueueModule,
    SchedulerModule,
    AuthModule,
    UsersModule,
    DriversModule,
    PricingModule,
    RidesModule,
    PartnersModule,
    PlacesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
