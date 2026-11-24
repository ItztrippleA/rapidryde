import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { JwtPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DriversService } from './drivers.service';

class PresenceDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  heading?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(3)
  @Max(50)
  maxDispatchRadiusKm?: number;

  @IsOptional()
  @IsBoolean()
  expandRadiusWhenIdle?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(3)
  @Max(50)
  effectiveRadiusKm?: number;

  @IsOptional()
  @IsBoolean()
  destinationEnabled?: boolean;

  @IsOptional()
  @IsString()
  destinationLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  destinationLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  destinationLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  @Max(30)
  destinationRadiusKm?: number;
}

class PreferencesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(3)
  @Max(50)
  maxDispatchRadiusKm?: number;

  @IsOptional()
  @IsBoolean()
  expandRadiusWhenIdle?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(3)
  @Max(50)
  effectiveRadiusKm?: number;

  @IsOptional()
  @IsBoolean()
  destinationEnabled?: boolean;

  @IsOptional()
  @IsString()
  destinationLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  destinationLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  destinationLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  @Max(30)
  destinationRadiusKm?: number;
}

class ExtendRangeDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(3)
  @Max(50)
  toKm?: number;

  @IsOptional()
  @IsString()
  rideId?: string;
}

class PingDto {
  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  heading?: number;

  @IsOptional()
  @IsString()
  city?: string;
}

@Controller()
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @Get('drivers/me/presence')
  me(@Req() req: { user: JwtPayload }) {
    return this.drivers.me(req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @Post('drivers/me/online')
  online(@Req() req: { user: JwtPayload }, @Body() body: PresenceDto) {
    return this.drivers.goOnline(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @Post('drivers/me/offline')
  offline(@Req() req: { user: JwtPayload }) {
    return this.drivers.goOffline(req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @Post('drivers/me/location')
  ping(@Req() req: { user: JwtPayload }, @Body() body: PingDto) {
    return this.drivers.ping(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  @Post('drivers/me/preferences')
  preferences(@Req() req: { user: JwtPayload }, @Body() body: PreferencesDto) {
    return this.drivers.savePreferences(req.user.sub, body);
  }

  /** Rider map: available drivers near pickup / current location. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'admin')
  @Get('drivers/nearby')
  nearby(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('city') city?: string,
  ) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return [];
    }
    return this.drivers.nearbyForCustomer({
      latitude,
      longitude,
      radiusKm: radiusKm != null ? Number(radiusKm) : undefined,
      city,
    });
  }

  /** Admin: full driver onboarding applications for desk review */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/drivers/applications')
  applications(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.drivers.listApplications({
      status: status || undefined,
      limit: limit != null ? Number(limit) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/drivers/:id/application')
  application(@Param('id') id: string) {
    return this.drivers.getApplication(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin/drivers/:id/decide')
  decide(
    @Param('id') id: string,
    @Body() body: { decision?: 'approve' | 'reject'; note?: string },
  ) {
    const decision = body?.decision === 'reject' ? 'reject' : 'approve';
    return this.drivers.decideApplication(id, decision, body?.note);
  }

  /** Admin fleet map — live drivers with lat/lng + duty status */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/drivers/live')
  live(@Query('city') city?: string, @Query('onlineOnly') onlineOnly?: string) {
    return this.drivers.liveForAdmin(city, onlineOnly !== 'false');
  }

  /** Admin: customers currently searching for a driver */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/rides/looking')
  looking(@Query('city') city?: string) {
    return this.drivers.lookingForRide(city);
  }

  /** Admin: widen a driver's dispatch range so they can see a nearby searcher */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin/drivers/:id/extend-range')
  extendRange(
    @Param('id') id: string,
    @Body() body: ExtendRangeDto,
  ) {
    return this.drivers.extendRange(id, body);
  }
}
