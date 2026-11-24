import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import type { JwtPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DebugPresenceService } from './debug-presence.service';

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
  name?: string;
}

@Controller('debug/presence')
export class DebugPresenceController {
  constructor(private readonly presence: DebugPresenceService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'driver')
  @Post()
  ping(@Req() req: { user: JwtPayload }, @Body() body: PingDto) {
    const role = req.user.role === 'driver' ? 'driver' : 'customer';
    const self = this.presence.upsert({
      id: req.user.sub,
      role,
      name: body.name || req.user.phone || undefined,
      latitude: body.latitude,
      longitude: body.longitude,
      heading: body.heading,
    });
    return { ok: true, self };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'driver')
  @Get('nearby')
  nearby(
    @Req() req: { user: JwtPayload },
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { peers: [] as const };
    }
    const role = req.user.role === 'driver' ? 'driver' : 'customer';
    const peers = this.presence.nearby({
      latitude,
      longitude,
      radiusKm: radiusKm != null ? Number(radiusKm) : 25,
      excludeId: req.user.sub,
      excludeRole: role,
    });
    return {
      peers,
      selfRole: role,
      selfId: req.user.sub,
      boardSize: this.presence.listAll().length,
    };
  }
}
