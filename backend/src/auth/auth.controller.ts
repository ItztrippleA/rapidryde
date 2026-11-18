import { Body, Controller, Delete, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { JwtPayload, Role } from './auth.types';

class OtpDto {
  @IsString()
  phone!: string;

  @IsString()
  purpose!: string;

  @IsOptional()
  @IsString()
  email?: string;
}

class OtpVerifyDto extends OtpDto {
  @IsString()
  code!: string;
}

class LoginDto {
  @IsString()
  phone!: string;

  @IsString()
  @MinLength(4)
  password!: string;

  @IsOptional()
  @IsIn(['customer', 'driver', 'admin'])
  role?: Role;
}

class RegisterDto {
  @IsString()
  phone!: string;

  @IsString()
  @MinLength(4)
  password!: string;

  @IsIn(['customer', 'driver'])
  role!: Role;

  /** From POST /auth/otp/verify */
  @IsString()
  verificationToken!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  referral?: string;
}

class RefreshDto {
  @IsString()
  refresh!: string;
}

class ResetDto {
  @IsString()
  phone!: string;

  @IsString()
  verificationToken!: string;

  @IsString()
  @MinLength(4)
  password!: string;

  @IsOptional()
  @IsIn(['customer', 'driver', 'admin'])
  role?: Role;
}

class GoogleDto {
  @IsString()
  idToken!: string;

  @IsOptional()
  @IsIn(['customer', 'driver'])
  role?: Role;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp')
  otp(@Body() body: OtpDto) {
    return this.auth.requestOtp(body.phone, body.purpose, body.email);
  }

  @Post('otp/verify')
  verify(@Body() body: OtpVerifyDto) {
    return this.auth.verifyOtp(body.phone, body.code, body.purpose);
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body.phone, body.password, body.role);
  }

  @Post('google')
  google(@Body() body: GoogleDto) {
    return this.auth.loginWithGoogle(body.idToken, body.role || 'customer');
  }

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refresh);
  }

  @Post('reset')
  reset(@Body() body: ResetDto) {
    return this.auth.resetPassword(body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('account')
  remove(@Req() req: { user: JwtPayload }) {
    return this.auth.deleteAccount(req.user.sub);
  }
}
