import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RidesModule } from '../rides/rides.module';
import { SupportController } from './support.controller';
import { SupportGateway } from './support.gateway';
import { SupportService } from './support.service';

@Module({
  imports: [AuthModule, RidesModule],
  controllers: [SupportController],
  providers: [SupportService, SupportGateway],
  exports: [SupportService],
})
export class SupportModule {}
