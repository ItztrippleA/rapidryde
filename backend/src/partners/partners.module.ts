import { Module } from '@nestjs/common';
import { PartnersController } from './partners.controller';
import { DojahService } from './dojah.service';
import { KycService } from './kyc.service';

@Module({
  controllers: [PartnersController],
  providers: [DojahService, KycService],
  exports: [DojahService, KycService],
})
export class PartnersModule {}
