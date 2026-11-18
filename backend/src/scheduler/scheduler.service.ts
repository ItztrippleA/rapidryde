import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { JobsService } from '../queue/jobs.service';
import { PgStore } from '../storage/pg-store';

/**
 * Fires scheduled ride reminders and due reminder rows.
 * Runs in-process every 30s (works with memory or Redis queues).
 */
@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly store: PgStore,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 30_000);
    this.log.log('Scheduler started (30s tick)');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Schedule standard ride reminders: T-60m, T-15m, T-5m */
  async scheduleRideReminders(
    rideId: string,
    scheduledAt: number,
    userIds: string[],
  ) {
    const offsets = [
      { kind: 'ride_reminder_60m', ms: 60 * 60_000 },
      { kind: 'ride_reminder_15m', ms: 15 * 60_000 },
      { kind: 'ride_reminder_5m', ms: 5 * 60_000 },
    ];
    for (const offset of offsets) {
      const fireAt = scheduledAt - offset.ms;
      if (fireAt <= Date.now()) continue;
      for (const userId of userIds) {
        await this.store.saveReminder({
          id: `${offset.kind}_${rideId}_${userId}`,
          kind: offset.kind,
          rideId,
          userId,
          fireAt,
          payload: { rideId, scheduledAt },
        });
      }
    }
  }

  private async tick() {
    try {
      await this.ensureScheduledRideReminders();
      const due = await this.store.dueReminders(Date.now(), 40);
      for (const row of due) {
        try {
          await this.jobs.enqueue('notify.push', {
            userIds: row.userId ? [row.userId] : [],
            title: this.titleFor(row.kind),
            body: this.bodyFor(row.kind, row.payload),
            data: {
              kind: row.kind,
              rideId: row.rideId || '',
            },
          });
          if (row.userId) {
            const user = await this.store.findUserById(row.userId);
            if (user?.email) {
              await this.jobs.enqueue('mail.send', {
                to: user.email,
                template: 'support',
                vars: {
                  subject: this.titleFor(row.kind),
                  body: this.bodyFor(row.kind, row.payload),
                  email: user.email,
                  name: user.name || 'there',
                },
              });
            }
          }
          await this.store.markReminder(row.id, 'sent');
        } catch (err) {
          this.log.error(
            `Reminder ${row.id} failed`,
            err instanceof Error ? err.stack : String(err),
          );
          await this.store.markReminder(row.id, 'failed');
        }
      }
    } catch (err) {
      this.log.error(
        'Scheduler tick failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async ensureScheduledRideReminders() {
    const soon = Date.now() + 2 * 60 * 60_000;
    const rides = await this.store.listScheduledRides(soon, Date.now());
    for (const ride of rides) {
      if (!ride.scheduledAt) continue;
      const users = [
        ride.customerId,
        ...(ride.driverId ? [ride.driverId] : []),
      ];
      await this.scheduleRideReminders(ride.id, ride.scheduledAt, users);
    }
  }

  private titleFor(kind: string) {
    if (kind.includes('60m')) return 'Trip in about an hour';
    if (kind.includes('15m')) return 'Trip in 15 minutes';
    if (kind.includes('5m')) return 'Trip starting soon';
    if (kind === 'pool_ready') return 'Your shared ride is filling up';
    return 'Rapyd Ryd reminder';
  }

  private bodyFor(kind: string, payload: Record<string, unknown>) {
    const rideId =
      typeof payload.rideId === 'string' || typeof payload.rideId === 'number'
        ? String(payload.rideId)
        : '';
    if (kind.includes('60m'))
      return `Your scheduled Rapyd Ryd trip ${rideId} is in about an hour.`;
    if (kind.includes('15m'))
      return `Your scheduled trip ${rideId} is in 15 minutes. Be ready.`;
    if (kind.includes('5m'))
      return `Your trip ${rideId} starts in about 5 minutes.`;
    return `Reminder for ${rideId || 'your trip'}.`;
  }
}
