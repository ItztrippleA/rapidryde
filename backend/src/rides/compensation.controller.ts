import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CompensationService } from './compensation.service';

@Controller('compensation')
export class CompensationController {
  constructor(private readonly compensation: CompensationService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver', 'admin')
  @Get('mine')
  mine(@Req() req: { user: JwtPayload }) {
    return this.compensation.list(req.user.sub);
  }
}
