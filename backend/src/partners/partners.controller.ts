import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.types';
import { JobsService } from '../queue/jobs.service';

class NinDto {
  @IsString()
  nin!: string;

  @IsOptional()
  @IsBoolean()
  slipAttached?: boolean;
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
 * External verification / payouts always go through the queue.
 */
@Controller()
export class PartnersController {
  constructor(private readonly jobs: JobsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('kyc/nin')
  async nin(@Req() req: { user: JwtPayload }, @Body() body: NinDto) {
    await this.jobs.enqueue('kyc.verify', {
      userId: req.user.sub,
      kind: 'nin',
      payload: {
        nin: body.nin,
        slipAttached: String(Boolean(body.slipAttached)),
      },
    });
    const tail = body.nin.slice(-4);
    return { status: 'pending', masked: `****${tail}` };
  }

  @UseGuards(JwtAuthGuard)
  @Post('payouts/resolve')
  async resolve(@Req() req: { user: JwtPayload }, @Body() body: ResolveDto) {
    await this.jobs.enqueue('kyc.verify', {
      userId: req.user.sub,
      kind: 'bank',
      payload: { bankCode: body.bankCode, accountNumber: body.accountNumber },
    });
    // Demo name until the payout partner responds on the worker.
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
