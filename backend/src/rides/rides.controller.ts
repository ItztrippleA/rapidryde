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
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import type { JwtPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { PaymentMethod, RideStatus } from './ride.types';
import { RidesService } from './rides.service';

class StopDto {
  @IsString()
  id!: string;

  @IsString()
  label!: string;

  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  longitude!: number;
}

class CreateRideDto {
  @IsString()
  pickup!: string;

  @IsString()
  dropoff!: string;

  @Type(() => Number)
  @IsNumber()
  pickupLat!: number;

  @Type(() => Number)
  @IsNumber()
  pickupLng!: number;

  @Type(() => Number)
  @IsNumber()
  dropLat!: number;

  @Type(() => Number)
  @IsNumber()
  dropLng!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  km!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minutes!: number;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fareOverride?: number;

  @IsOptional()
  @IsIn(['cash', 'wallet', 'card', 'transfer'])
  payment?: PaymentMethod;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StopDto)
  stops?: StopDto[];

  @IsOptional()
  along?: boolean;

  @IsOptional()
  @IsString()
  poolId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  seatIndex?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  scheduledAt?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  joinPoolId?: string;
}

class AssignDto {
  @IsString()
  driverId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fare?: number;

  @IsOptional()
  @IsString()
  driverName?: string;

  @IsOptional()
  @IsString()
  driverPhone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsString()
  vehicle?: string;

  @IsOptional()
  @IsString()
  plate?: string;

  @IsOptional()
  @IsString()
  colour?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  byAdmin?: boolean;
}

class StageDto {
  @IsIn([
    'searching',
    'assigned',
    'to_pickup',
    'arrived',
    'on_trip',
    'completed',
    'cancelled',
    'timeout',
    'no_drivers',
  ])
  status!: RideStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

class FareDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fare!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

class LocationDto {
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
}

class ChatDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsIn(['text', 'voice'])
  kind?: 'text' | 'voice';

  @IsOptional()
  @IsString()
  audioUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  durationMs?: number;
}

@Controller('rides')
export class RidesController {
  constructor(private readonly rides: RidesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'admin')
  @Post()
  create(@Req() req: { user: JwtPayload }, @Body() body: CreateRideDto) {
    const payload = {
      ...body,
      customerId:
        req.user.role === 'admin' && body.customerPhone
          ? body.customerPhone
          : req.user.sub,
      customerPhone: body.customerPhone || req.user.phone,
    };
    if (
      body.along ||
      body.classId === 'along' ||
      body.joinPoolId ||
      body.poolId
    ) {
      return this.rides.createOrJoinPool(payload);
    }
    return this.rides.create(payload);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pools/open')
  pools(@Query('city') city?: string) {
    return this.rides.listPools(city);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'driver', 'customer')
  @Get()
  list(
    @Req() req: { user: JwtPayload },
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const role = req.user.role;
    return this.rides.list({
      status,
      limit: limit ? Number(limit) : undefined,
      customerId: role === 'customer' ? req.user.sub : undefined,
      driverId: role === 'driver' ? req.user.sub : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('active/current')
  active(@Req() req: { user: JwtPayload }) {
    return this.rides.activeFor(req.user.sub, req.user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  one(@Param('id') id: string) {
    return this.rides.get(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/summary')
  summary(@Param('id') id: string) {
    return this.rides.summary(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'driver')
  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() body: AssignDto, @Req() req: { user: JwtPayload }) {
    return this.rides.assign(id, body.driverId, {
      ...body,
      byAdmin: req.user.role === 'admin',
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'driver', 'customer')
  @Post(':id/stage')
  stage(
    @Req() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: StageDto,
  ) {
    const by =
      req.user.role === 'admin'
        ? 'admin'
        : req.user.role === 'driver'
          ? 'driver'
          : 'customer';
    return this.rides.stage(id, body.status, by, body.note);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'driver', 'customer')
  @Post(':id/fare')
  fare(
    @Req() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: FareDto,
  ) {
    const by =
      req.user.role === 'driver'
        ? 'driver'
        : req.user.role === 'customer'
          ? 'customer'
          : 'system';
    return this.rides.updateFare(id, body.fare, by, body.note);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'driver', 'customer')
  @Post(':id/location')
  location(
    @Req() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: LocationDto,
  ) {
    const role = req.user.role === 'driver' ? 'driver' : 'customer';
    return this.rides.pingLocation(id, role, req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'driver', 'customer')
  @Post(':id/chat')
  chat(
    @Req() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: ChatDto,
  ) {
    const from = req.user.role === 'driver' ? 'driver' : 'customer';
    return this.rides.addChat(id, from, req.user.sub, body);
  }
}
