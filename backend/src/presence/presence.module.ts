import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DebugPresenceController } from './debug-presence.controller';
import { DebugPresenceService } from './debug-presence.service';

@Module({
  imports: [AuthModule],
  controllers: [DebugPresenceController],
  providers: [DebugPresenceService],
  exports: [DebugPresenceService],
})
export class PresenceModule {}
