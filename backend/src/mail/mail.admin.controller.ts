import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { EmailAudience, EmailTheme } from './email.types';
import { MailAdminService } from './mail-admin.service';

class ThemeDto implements Partial<EmailTheme> {
  @IsOptional() @IsString() brandName?: string;
  @IsOptional() @IsString() logoText?: string;
  @IsOptional() @IsString() accent?: string;
  @IsOptional() @IsString() accentAlt?: string;
  @IsOptional() @IsString() background?: string;
  @IsOptional() @IsString() paper?: string;
  @IsOptional() @IsString() ink?: string;
  @IsOptional() @IsString() muted?: string;
  @IsOptional() @IsString() fontFamily?: string;
  @IsOptional() @IsString() footerText?: string;
  @IsOptional() @IsString() headerHtml?: string;
  @IsOptional() @IsString() footerHtml?: string;
  @IsOptional() @IsString() shellHtml?: string;
}

class TemplateDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(1) subject!: string;
  @IsString() @MinLength(1) html!: string;
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsString() systemKey?: string;
}

class PreviewDto {
  @IsOptional() @IsString() templateId?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() html?: string;
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsObject() vars?: Record<string, string | number>;
  @IsOptional() @IsBoolean() useTheme?: boolean;
}

class SendDto {
  @IsIn(['anyone', 'customers', 'drivers', 'admins', 'all_users', 'custom'])
  audience!: EmailAudience;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emails?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @IsOptional() @IsString() templateId?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() html?: string;
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsBoolean() useTheme?: boolean;
  @IsOptional() @IsObject() vars?: Record<string, string | number>;
}

@Controller('admin/mail')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class MailAdminController {
  constructor(private readonly admin: MailAdminService) {}

  @Get('theme')
  theme() {
    return this.admin.theme();
  }

  @Put('theme')
  saveTheme(@Body() body: ThemeDto) {
    return this.admin.saveTheme(body);
  }

  @Get('templates')
  templates() {
    return this.admin.templates();
  }

  @Post('templates')
  saveTemplate(@Body() body: TemplateDto) {
    return this.admin.saveTemplate(body);
  }

  @Delete('templates/:id')
  removeTemplate(@Param('id') id: string) {
    return this.admin.removeTemplate(id);
  }

  @Post('preview')
  preview(@Body() body: PreviewDto) {
    return this.admin.preview(body);
  }

  @Get('directory')
  directory() {
    return this.admin.directory();
  }

  @Get('outbox')
  outbox(@Query('limit') limit?: string) {
    return this.admin.outbox(limit ? Number(limit) : 40);
  }

  @Post('send')
  send(@Body() body: SendDto) {
    return this.admin.send(body);
  }
}
