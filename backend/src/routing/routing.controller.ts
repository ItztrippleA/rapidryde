import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import {
  RoutingService,
  type RoutingPreference,
} from './routing.service';

class EstimateQuery {
  @Type(() => Number)
  @IsNumber()
  fromLat!: number;

  @Type(() => Number)
  @IsNumber()
  fromLng!: number;

  @Type(() => Number)
  @IsNumber()
  toLat!: number;

  @Type(() => Number)
  @IsNumber()
  toLng!: number;

  /** Optional waypoints as "lat,lng|lat,lng". */
  @IsOptional()
  @IsString()
  via?: string;

  @IsOptional()
  @IsIn(['TRAFFIC_UNAWARE', 'TRAFFIC_AWARE', 'TRAFFIC_AWARE_OPTIMAL'])
  preference?: RoutingPreference;
}

@Controller('routes')
export class RoutingController {
  constructor(private readonly routing: RoutingService) {}

  /**
   * Distance + traffic-aware ETA.
   * Prefer polling this periodically (e.g. every 60–90s), not on every GPS tick.
   */
  @Get('estimate')
  async estimate(@Query() query: EstimateQuery) {
    const waypoints = (query.via || '')
      .split('|')
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const [lat, lng] = chunk.split(',').map(Number);
        return { latitude: lat, longitude: lng };
      })
      .filter(
        (point) =>
          Number.isFinite(point.latitude) && Number.isFinite(point.longitude),
      );

    return this.routing.route(
      { latitude: query.fromLat, longitude: query.fromLng },
      { latitude: query.toLat, longitude: query.toLng },
      waypoints,
      query.preference || 'TRAFFIC_AWARE',
    );
  }
}
