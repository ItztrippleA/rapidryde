import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
import type { JwtPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
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

class RidePrefsDto {
  @IsOptional()
  @IsBoolean()
  alongEnabled?: boolean;
}

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/customers')
  listCustomers(@Query('limit') limit?: string) {
    return this.users.listCustomers(limit != null ? Number(limit) : undefined);
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/me')
  me(@Req() req: { user: JwtPayload }) {
    return this.users.me(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Put('users/me')
  updateMe(@Req() req: { user: JwtPayload }, @Body() body: ProfileDto) {
    return this.users.updateProfile(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @Get('users/me/ride-prefs')
  ridePrefs(@Req() req: { user: JwtPayload }) {
    return this.users.getRidePrefs(req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @Put('users/me/ride-prefs')
  setRidePrefs(@Req() req: { user: JwtPayload }, @Body() body: RidePrefsDto) {
    return this.users.setRidePrefs(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/me/driver-application')
  getApplication(@Req() req: { user: JwtPayload }) {
    return this.users.getDriverApplication(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Put('users/me/driver-application')
  saveApplication(
    @Req() req: { user: JwtPayload },
    @Body() body: DriverApplicationDto,
  ) {
    return this.users.saveDriverApplication(req.user.sub, req.user.role, body);
  }
}
