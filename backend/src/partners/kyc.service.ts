import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgStore } from '../storage/pg-store';
import type { DriverApplication, UserIdentity } from '../storage/types';
import { DojahService } from './dojah.service';
import { hashNin } from './nin-hash';

@Injectable()
export class KycService {
  private readonly log = new Logger(KycService.name);

  constructor(
    private readonly store: PgStore,
    private readonly dojah: DojahService,
    private readonly config: ConfigService,
  ) {}

  /**
   * NIN verify via Dojah, with uniqueness:
   * - same NIN cannot verify on two accounts
   * - same face cannot enroll on two accounts (when selfie is provided)
   *
   * In development, selfie is optional — NIN lookup alone is enough.
   */
  async verifyNin(
    userId: string,
    input: {
      nin: string;
      selfieImage?: string;
      slipAttached?: boolean;
      threshold?: number;
    },
  ) {
    const nin = String(input.nin || '').replace(/\D/g, '');
    if (!/^\d{11}$/.test(nin)) {
      throw new BadRequestException('Enter a valid 11-digit NIN.');
    }

    const selfie = input.selfieImage?.trim() || '';
    const allowWithoutSelfie = this.allowNinWithoutSelfie();
    if (!selfie && !allowWithoutSelfie) {
      throw new BadRequestException('Take a clear selfie to continue.');
    }

    const user = await this.store.findUserById(userId);
    if (!user) throw new NotFoundException('User not found');

    const ninHash = hashNin(nin, this.ninPepper());
    const sandboxNin = this.isDevSandboxNin(nin);
    if (sandboxNin) {
      this.log.warn(
        `[kyc/nin] (dev) allowing reusable sandbox NIN *******${nin.slice(-4)}`,
      );
    } else {
      const ninOwner = await this.store.findUserByNinHash(ninHash, userId);
      if (ninOwner) {
        throw new ConflictException(
          'This NIN is already registered on another Rapyd Ryd account.',
        );
      }
    }

    let collectionId = '';
    if (selfie) {
      collectionId = await this.dojah.ensureFaceCollection();
      const faceHits = await this.dojah.searchFace(selfie, collectionId);
      const foreignFace = faceHits.find((hit) => hit.subjectId !== userId);
      if (foreignFace) {
        throw new ConflictException(
          'This face is already registered on another Rapyd Ryd account.',
        );
      }
    }

    this.log.log(
      `[kyc/nin] user=${userId} mode=${selfie ? 'nin+selfie' : 'nin-lookup-only'} nin=*******${nin.slice(-4)}`,
    );

    const result = selfie
      ? await this.dojah.verifyNinWithSelfie({
          nin,
          selfieImage: selfie,
          firstName: user.firstName,
          lastName: user.lastName,
          threshold: input.threshold,
        })
      : await this.dojah.lookupNin(nin);

    this.log.log(
      `[kyc/nin] dojah parsed result=${JSON.stringify({
        maskedNin: result.maskedNin,
        firstName: result.firstName,
        lastName: result.lastName,
        middleName: result.middleName,
        gender: result.gender,
        birthdate: result.birthdate,
        selfie: result.selfie,
      })}`,
    );

    const approved = result.selfie.match === true;
    const failureReason = approved
      ? ''
      : `Face did not match the NIN photo (score ${Math.round(result.selfie.confidence)}). Retake in even light, face the camera, no glasses if possible.`;

    let faceId = user.identity?.faceId || '';
    if (approved) {
      if (!sandboxNin) {
        const raced = await this.store.findUserByNinHash(ninHash, userId);
        if (raced) {
          throw new ConflictException(
            'This NIN is already registered on another Rapyd Ryd account.',
          );
        }
      }

      if (selfie && collectionId) {
        try {
          const enrolled = await this.dojah.enrollFace({
            selfieImage: selfie,
            subjectId: userId,
            collectionId,
          });
          faceId = enrolled.faceId || faceId;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Face enrollment failed.';
          throw new BadRequestException(
            `Identity matched, but we could not lock your face for uniqueness: ${message}`,
          );
        }
      }
    }

    const identity: UserIdentity = {
      maskedNin: maskNin(nin),
      slipAttached: Boolean(input.slipAttached),
      status: approved ? 'approved' : 'rejected',
      failureReason,
      consented: true,
      matchConfidence: result.selfie.confidence,
      provider: selfie ? 'dojah' : 'dojah-dev-nin-only',
      faceId: faceId || undefined,
      verifiedAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await this.store.upsertUser({
        ...user,
        identity,
        // Sandbox NIN is shared in (dev) — do not lock uniqueness on it.
        ninHash: approved && !sandboxNin ? ninHash : user.ninHash,
        firstName: user.firstName || result.firstName || user.firstName,
        lastName: user.lastName || result.lastName || user.lastName,
        middleName: user.middleName || result.middleName || user.middleName,
        gender: user.gender || result.gender || user.gender,
        dob: user.dob || normalizeDob(result.birthdate) || user.dob,
        updatedAt: Date.now(),
      });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (/users_nin_hash_uidx|nin_hash/i.test(text)) {
        throw new ConflictException(
          'This NIN is already registered on another Rapyd Ryd account.',
        );
      }
      throw error;
    }

    if (user.role === 'driver') {
      await this.mergeApplicationIdentity(userId, {
        maskedNin: identity.maskedNin,
        slipAttached: identity.slipAttached,
        status: approved ? 'approved' : 'rejected',
        failureReason,
        consented: true,
        matchConfidence: result.selfie.confidence,
        provider: identity.provider,
        faceId: identity.faceId,
        verifiedAt: identity.verifiedAt,
      });
    }

    const payload = {
      status: identity.status,
      masked: identity.maskedNin,
      match: result.selfie.match,
      confidence: result.selfie.confidence,
      failureReason: failureReason || undefined,
      firstName: result.firstName || undefined,
      lastName: result.lastName || undefined,
      selfieRequired: !allowWithoutSelfie,
    };
    this.log.log(`[kyc/nin] client response=${JSON.stringify(payload)}`);
    return payload;
  }

  /** Dev / explicit opt-out: NIN alone is enough. Production requires selfie. */
  private allowNinWithoutSelfie() {
    if (this.config.get<string>('DOJAH_REQUIRE_SELFIE') === 'true') return false;
    if (this.config.get<string>('DOJAH_REQUIRE_SELFIE') === 'false') return true;
    return this.config.get<string>('NODE_ENV') !== 'production';
  }

  /** Dojah sandbox test NIN — reusable while not in production. */
  private isDevSandboxNin(nin: string) {
    if (this.config.get<string>('NODE_ENV') === 'production') return false;
    return nin === '70123456789';
  }

  private ninPepper() {
    return (
      this.config.get<string>('DOJAH_NIN_PEPPER')?.trim() ||
      this.config.get<string>('JWT_SECRET')?.trim() ||
      'rapyd-ryd'
    );
  }

  private async mergeApplicationIdentity(
    userId: string,
    identity: Record<string, unknown>,
  ) {
    const current =
      (await this.store.getDriverApplication(userId)) ||
      ({
        userId,
        profile: {},
        identity: {},
        licence: {},
        vehicle: {},
        inspection: {},
        bank: {},
        emergency: {},
        status: 'draft',
        submittedAt: null,
        updatedAt: Date.now(),
      } satisfies DriverApplication);

    await this.store.upsertDriverApplication({
      ...current,
      identity: { ...current.identity, ...identity },
      updatedAt: Date.now(),
    });
  }
}

function maskNin(nin: string) {
  return `*******${nin.slice(-4)}`;
}

function normalizeDob(value: string) {
  const raw = value.trim();
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return raw;
}
