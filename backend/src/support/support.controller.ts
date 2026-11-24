import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { JwtPayload } from '../auth/auth.types';
import { SupportService } from './support.service';

class SupportMessageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
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

  @IsOptional()
  @IsString()
  city?: string;
}

class StaffReplyDto extends SupportMessageDto {
  @IsOptional()
  @IsString()
  author?: string;
}

class StatusDto {
  @IsIn(['waiting', 'open', 'closed'])
  status!: 'waiting' | 'open' | 'closed';
}

@Controller()
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver', 'customer')
  @Get('support/me')
  myThread(@Req() req: { user: JwtPayload }) {
    const party = req.user.role === 'driver' ? 'driver' : 'customer';
    return this.support.myThread(party, req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver', 'customer')
  @Post('support/messages')
  postMine(
    @Req() req: { user: JwtPayload },
    @Body() body: SupportMessageDto,
  ) {
    const party = req.user.role === 'driver' ? 'driver' : 'customer';
    return this.support.postFromParty({
      party,
      partyId: req.user.sub,
      partyPhone: req.user.phone,
      city: body.city,
      text: body.text,
      kind: body.kind,
      audioUrl: body.audioUrl,
      durationMs: body.durationMs,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/support')
  list(
    @Query('party') party?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.support.list({
      party: party || undefined,
      status: status || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/support/:id')
  getOne(@Param('id') id: string) {
    return this.support.get(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin/support/:id/messages')
  reply(
    @Param('id') id: string,
    @Body() body: StaffReplyDto,
  ) {
    return this.support.postFromStaff(id, {
      author: body.author || 'Rapyd Ryd',
      text: body.text,
      kind: body.kind,
      audioUrl: body.audioUrl,
      durationMs: body.durationMs,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('admin/support/:id/status')
  setStatus(@Param('id') id: string, @Body() body: StatusDto) {
    return this.support.setStatus(id, body.status);
  }
}
