import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Queue,
  Worker,
  type ConnectionOptions,
  type JobsOptions,
} from 'bullmq';
import IORedis from 'ioredis';
import { MailService } from '../mail/mail.service';
import {
  QUEUE_NAMES,
  type JobName,
  type JobPayloads,
  type QueueName,
} from './job.types';

type MemoryJob = { name: JobName; data: unknown; at: number };

/**
 * Enqueue-only API for the rest of the app.
 * Uses BullMQ + Redis when REDIS_URL is set and reachable; otherwise in-process memory queue.
 */
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(JobsService.name);
  private readonly memory: MemoryJob[] = [];
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];
  private mode: 'redis' | 'memory' = 'memory';
  private connection: ConnectionOptions | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL')?.trim();
    if (redisUrl && (await this.redisReachable(redisUrl))) {
      this.mode = 'redis';
      this.connection = { url: redisUrl };
      for (const name of Object.values(QUEUE_NAMES)) {
        this.queues.set(name, new Queue(name, { connection: this.connection }));
      }
      this.workers.push(
        new Worker(
          QUEUE_NAMES.notifications,
          async (job) => this.handle(job.name as JobName, job.data),
          {
            connection: this.connection,
          },
        ),
        new Worker(
          QUEUE_NAMES.dispatch,
          async (job) => this.handle(job.name as JobName, job.data),
          {
            connection: this.connection,
          },
        ),
        new Worker(
          QUEUE_NAMES.payouts,
          async (job) => this.handle(job.name as JobName, job.data),
          {
            connection: this.connection,
          },
        ),
        new Worker(
          QUEUE_NAMES.kyc,
          async (job) => this.handle(job.name as JobName, job.data),
          {
            connection: this.connection,
          },
        ),
        new Worker(
          QUEUE_NAMES.ledger,
          async (job) => this.handle(job.name as JobName, job.data),
          {
            connection: this.connection,
          },
        ),
        new Worker(
          QUEUE_NAMES.mail,
          async (job) => this.handle(job.name as JobName, job.data),
          {
            connection: this.connection,
          },
        ),
        new Worker(
          QUEUE_NAMES.analytics,
          async (job) => this.handle(job.name as JobName, job.data),
          {
            connection: this.connection,
          },
        ),
      );
      this.log.log('Queue mode: redis (BullMQ)');
      return;
    }
    if (redisUrl) {
      this.log.warn(
        `Redis not reachable at ${redisUrl}. Falling back to in-process queue.`,
      );
    }
    this.useMemory();
  }

  private useMemory() {
    this.mode = 'memory';
    this.timer = setInterval(() => void this.drainMemory(), 250);
    this.log.warn('Queue mode: memory (set a live REDIS_URL for BullMQ)');
  }

  private async redisReachable(url: string) {
    const client = new IORedis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 800,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    client.on('error', () => undefined);
    try {
      await client.connect();
      const pong = await client.ping();
      await client.quit();
      return pong === 'PONG';
    } catch {
      client.disconnect();
      return false;
    }
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await Promise.all(this.workers.map((worker) => worker.close()));
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }

  modeLabel() {
    return this.mode;
  }

  async enqueue<K extends JobName>(
    name: K,
    data: JobPayloads[K],
    opts?: JobsOptions,
  ) {
    const queue = this.queueFor(name);
    if (this.mode === 'redis') {
      const q = this.queues.get(queue);
      if (!q) throw new Error(`Missing queue ${queue}`);
      await q.add(name, data, {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        ...opts,
      });
      return;
    }
    this.memory.push({ name, data, at: Date.now() });
  }

  private queueFor(name: JobName): QueueName {
    if (name.startsWith('notify.')) return QUEUE_NAMES.notifications;
    if (name.startsWith('mail.')) return QUEUE_NAMES.mail;
    if (name.startsWith('dispatch.')) return QUEUE_NAMES.dispatch;
    if (name.startsWith('kyc.')) return QUEUE_NAMES.kyc;
    if (name.startsWith('payouts.')) return QUEUE_NAMES.payouts;
    if (name.startsWith('ledger.')) return QUEUE_NAMES.ledger;
    return QUEUE_NAMES.analytics;
  }

  private async drainMemory() {
    const batch = this.memory.splice(0, 20);
    for (const job of batch) {
      try {
        await this.handle(job.name, job.data);
      } catch (error) {
        this.log.error(
          `Memory job ${job.name} failed`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  /** Replace push/KYC/payouts with partners later. Mail goes through Resend. */
  private async handle(name: JobName, data: unknown) {
    this.log.debug(`job ${name} ${JSON.stringify(data).slice(0, 200)}`);
    switch (name) {
      case 'mail.send': {
        const payload = data as JobPayloads['mail.send'];
        await this.mail.sendTemplate(
          payload.to,
          payload.template,
          payload.vars,
        );
        return;
      }
      case 'dispatch.match':
        // Matching runs inline from RidesService.create / ride:request (avoids Queue↔Rides cycle).
        return;
      case 'notify.push':
      case 'kyc.verify':
      case 'payouts.transfer':
      case 'ledger.settle':
      case 'analytics.track':
        return;
      default:
        return;
    }
  }
}
