import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { UpdateWaitlistStatusDto } from './dto/update-waitlist-status.dto';
import { WaitlistService } from './waitlist.service';

@Controller()
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  /** Public — landing page waitlist form. */
  @Post('waitlist')
  join(@Body() body: JoinWaitlistDto) {
    return this.waitlist.join(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/waitlist')
  list(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.waitlist.list({
      role: role || undefined,
      status: status || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('admin/waitlist/:id/status')
  setStatus(@Param('id') id: string, @Body() body: UpdateWaitlistStatusDto) {
    return this.waitlist.setStatus(id, body.status);
  }
}
