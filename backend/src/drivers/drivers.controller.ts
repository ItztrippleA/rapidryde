import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';
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

  /** Admin fleet map — live drivers with lat/lng + duty status */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/drivers/live')
  live(@Query('city') city?: string, @Query('onlineOnly') onlineOnly?: string) {
    return this.drivers.liveForAdmin(city, onlineOnly !== 'false');
  }
}
