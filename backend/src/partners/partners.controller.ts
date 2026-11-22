import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.types';
import { JobsService } from '../queue/jobs.service';
import { KycService } from './kyc.service';

class NinDto {
  @IsString()
  nin!: string;

  /** Base64 selfie (optional in development). */
  @IsOptional()
  @IsString()
  selfieImage?: string;

  @IsOptional()
  @IsBoolean()
  slipAttached?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(50)
  @Max(100)
  threshold?: number;
}

class ResolveDto {
  @IsString()
  bankCode!: string;

  @IsString()
  accountNumber!: string;
}

class BvnDto {
  @IsString()
  bvn!: string;
}

class FundDto {
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  amount!: number;
}

/**
 * Partner-facing routes from the mobile contract.
 * NIN + face runs live via Dojah (no raw NIN/selfie stored). Bank/BVN still enqueue.
 */
@Controller()
export class PartnersController {
  constructor(
    private readonly jobs: JobsService,
    private readonly kyc: KycService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('kyc/nin')
  async nin(@Req() req: { user: JwtPayload }, @Body() body: NinDto) {
    return this.kyc.verifyNin(req.user.sub, {
      nin: body.nin,
      selfieImage: body.selfieImage,
      slipAttached: body.slipAttached,
      threshold: body.threshold,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('payouts/resolve')
  async resolve(@Req() req: { user: JwtPayload }, @Body() body: ResolveDto) {
    await this.jobs.enqueue('kyc.verify', {
      userId: req.user.sub,
      kind: 'bank',
      payload: { bankCode: body.bankCode, accountNumber: body.accountNumber },
    });
    return { accountName: 'Pending name check' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('payouts/bvn')
  async bvn(@Req() req: { user: JwtPayload }, @Body() body: BvnDto) {
    await this.jobs.enqueue('kyc.verify', {
      userId: req.user.sub,
      kind: 'bvn',
      payload: { bvn: body.bvn },
    });
    return { status: 'pending' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('wallet/fund')
  async fund(@Req() req: { user: JwtPayload }, @Body() body: FundDto) {
    await this.jobs.enqueue('ledger.settle', {
      rideId: `fund_${req.user.sub}_${body.amount}`,
    });
    return { balance: body.amount };
  }
}
