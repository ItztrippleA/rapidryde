import { Module } from '@nestjs/common';
import { DriversModule } from '../drivers/drivers.module';
import { PricingModule } from '../pricing/pricing.module';
import { RoutingModule } from '../routing/routing.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { CompensationController } from './compensation.controller';
import { CompensationService } from './compensation.service';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { StopChangeService } from './stop-change.service';
import { TripOpsController } from './trip-ops.controller';
import { WaitingService } from './waiting.service';

@Module({
  imports: [PricingModule, DriversModule, SchedulerModule, RoutingModule],
  controllers: [RidesController, TripOpsController, CompensationController],
  providers: [
    RidesService,
    WaitingService,
    StopChangeService,
    CompensationService,
  ],
  exports: [
    RidesService,
    WaitingService,
    StopChangeService,
    CompensationService,
  ],
})
export class RidesModule {}
