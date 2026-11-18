import { Body, Controller, Get, Put, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { QUEUED_ACTIONS, SYNC_ACTIONS } from '../queue/job.types';
import { JobsService } from '../queue/jobs.service';
import { QuoteDto } from './dto/quote.dto';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { PricingService } from './pricing.service';

@Controller()
export class PricingController {
  constructor(
    private readonly pricing: PricingService,
    private readonly jobs: JobsService,
  ) {}

  /** Public factors for customer/driver apps (fallback when offline is local). */
  @Get('pricing')
  factors() {
    return this.pricing.getFactors();
  }

  /** Fare = B + (D × Rd) + (T × Rt) + E — sync, never queued. */
  @Post('pricing/quote')
  quote(@Body() body: QuoteDto) {
    return this.pricing.quote(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/pricing')
  adminFactors() {
    return this.pricing.getFactors();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put('admin/pricing')
  update(@Body() body: UpdatePricingDto) {
    return this.pricing.updateFactors(body);
  }

  @Get('admin/ops')
  ops() {
    return {
      queueMode: this.jobs.modeLabel(),
      formula: 'Fare = B + (D × Rd) + (T × Rt) + E',
      sync: SYNC_ACTIONS,
      queued: QUEUED_ACTIONS,
    };
  }
}
