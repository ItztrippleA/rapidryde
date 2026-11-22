import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import type { JwtPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CompensationService } from './compensation.service';
import { StopChangeService } from './stop-change.service';
import { WaitingService } from './waiting.service';

class ProposeStopDto {
  @IsString()
  label!: string;

  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsString()
  id?: string;
}

class ConfirmStopDto {
  @IsBoolean()
  accept!: boolean;
}

class WaitingStartDto {
  @IsIn(['pickup', 'stop'])
  kind!: 'pickup' | 'stop';

  @IsOptional()
  @IsString()
  stopId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}

class WaitingEndDto {
  @IsOptional()
  @IsString()
  sessionId?: string;
}

@Controller('rides')
export class TripOpsController {
  constructor(
    private readonly stops: StopChangeService,
    private readonly waiting: WaitingService,
    private readonly compensation: CompensationService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'admin')
  @Post(':id/stops/propose')
  propose(
    @Req() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: ProposeStopDto,
  ) {
    return this.stops.propose(id, req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'admin')
  @Post(':id/stops/confirm')
  confirm(
    @Req() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: ConfirmStopDto,
  ) {
    return this.stops.confirm(id, req.user.sub, body.accept);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'admin')
  @Delete(':id/stops/:stopId')
  remove(
    @Req() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('stopId') stopId: string,
  ) {
    return this.stops.remove(id, req.user.sub, stopId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver', 'admin')
  @Post(':id/waiting/start')
  startWaiting(@Param('id') id: string, @Body() body: WaitingStartDto) {
    return this.waiting.start(id, body.kind, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver', 'admin', 'customer')
  @Post(':id/waiting/end')
  endWaiting(@Param('id') id: string, @Body() body: WaitingEndDto) {
    return this.waiting.end(id, body.sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/waiting')
  waitingStatus(@Param('id') id: string) {
    return this.waiting.status(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/charges')
  charges(@Param('id') id: string) {
    return this.waiting.ledger(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver', 'admin')
  @Post(':id/traffic/observe')
  observe(@Param('id') id: string) {
    return this.compensation.observe(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver', 'admin')
  @Post(':id/compensation/calculate')
  calculate(@Param('id') id: string) {
    return this.compensation.calculate(id);
  }
}
