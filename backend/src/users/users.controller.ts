import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
import type { JwtPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

class ProfileDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() middleName?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() referral?: string;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsString() dob?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() lga?: string;
  @IsOptional() @IsString() name?: string;
}

class DriverApplicationDto {
  @IsOptional() @IsObject() profile?: Record<string, unknown>;
  @IsOptional() @IsObject() identity?: Record<string, unknown>;
  @IsOptional() @IsObject() licence?: Record<string, unknown>;
  @IsOptional() @IsObject() vehicle?: Record<string, unknown>;
  @IsOptional() @IsObject() inspection?: Record<string, unknown>;
  @IsOptional() @IsObject() bank?: Record<string, unknown>;
  @IsOptional() @IsObject() emergency?: Record<string, unknown>;
  @IsOptional() @IsBoolean() submit?: boolean;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@Req() req: { user: JwtPayload }) {
    return this.users.me(req.user.sub);
  }

  @Put('me')
  updateMe(@Req() req: { user: JwtPayload }, @Body() body: ProfileDto) {
    return this.users.updateProfile(req.user.sub, body);
  }

  @Get('me/driver-application')
  getApplication(@Req() req: { user: JwtPayload }) {
    return this.users.getDriverApplication(req.user.sub);
  }

  @Put('me/driver-application')
  saveApplication(
    @Req() req: { user: JwtPayload },
    @Body() body: DriverApplicationDto,
  ) {
    return this.users.saveDriverApplication(req.user.sub, req.user.role, body);
  }
}
