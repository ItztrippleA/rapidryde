import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail/mail.service';
import { PlacesService } from './places/places.service';
import { JobsService } from './queue/jobs.service';
import { QUEUED_ACTIONS, SYNC_ACTIONS } from './queue/job.types';

@Controller()
export class HealthController {
  constructor(
    private readonly jobs: JobsService,
    private readonly mail: MailService,
    private readonly places: PlacesService,
    private readonly config: ConfigService,
  ) {}

  @Get('health')
  health() {
    return {
      ok: true,
      service: 'rapyd-ryd-api',
      env: this.config.get<string>('NODE_ENV') || 'development',
      database: Boolean(this.config.get<string>('DATABASE_URL')),
      queueMode: this.jobs.modeLabel(),
      resend: this.mail.enabled(),
      places: this.places.enabled(),
      googleAuth: Boolean(
        this.config.get<string>('GOOGLE_CLIENT_ID_WEB') ||
        this.config.get<string>('GOOGLE_CLIENT_ID_IOS') ||
        this.config.get<string>('GOOGLE_CLIENT_ID_ANDROID'),
      ),
      formula: 'Fare = B + (D × Rd) + (T × Rt) + E',
    };
  }

  @Get()
  root() {
    return {
      name: 'Rapyd Ryd API',
      formula: 'Fare = B + (D × Rd) + (T × Rt) + E',
      sync: SYNC_ACTIONS,
      queued: QUEUED_ACTIONS,
      queueMode: this.jobs.modeLabel(),
      resend: this.mail.enabled(),
      places: this.places.enabled(),
    };
  }
}
