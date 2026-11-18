import { Global, Module } from '@nestjs/common';
import { MailAdminController } from './mail.admin.controller';
import { MailAdminService } from './mail-admin.service';
import { MailService } from './mail.service';

@Global()
@Module({
  controllers: [MailAdminController],
  providers: [MailService, MailAdminService],
  exports: [MailService, MailAdminService],
})
export class MailModule {}
