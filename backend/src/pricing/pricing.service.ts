import { Injectable } from '@nestjs/common';
import { JobsService } from '../queue/jobs.service';
import { PgStore } from '../storage/pg-store';
import { calculateFare, mergeFactors } from './fare.engine';
import type { FareFactors, QuoteInput } from './fare.types';
import type { UpdatePricingDto } from './dto/update-pricing.dto';

@Injectable()
export class PricingService {
  constructor(
    private readonly store: PgStore,
    private readonly jobs: JobsService,
  ) {}

  getFactors(): Promise<FareFactors> {
    return this.store.getPricing();
  }

  async updateFactors(patch: UpdatePricingDto): Promise<FareFactors> {
    const current = await this.store.getPricing();
    const next = mergeFactors(current, patch);
    await this.store.setPricing(next);
    void this.jobs.enqueue('analytics.track', {
      name: 'pricing_updated',
      props: {
        baseFare: next.baseFare,
        perKm: next.perKm,
        perMinute: next.perMinute,
        distanceMode: next.distanceMode,
      },
    });
    return next;
  }

  async quote(input: QuoteInput) {
    return calculateFare(input, await this.getFactors());
  }
}
