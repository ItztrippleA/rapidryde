import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgStore } from '../storage/pg-store';

export type DojahSelfieMatch = {
  match: boolean;
  confidence: number;
};

export type DojahNinVerifyResult = {
  maskedNin: string;
  firstName: string;
  lastName: string;
  middleName: string;
  gender: string;
  birthdate: string;
  selfie: DojahSelfieMatch;
  raw: Record<string, unknown>;
};

export type DojahFaceHit = {
  subjectId: string;
  faceId: string;
  confidence: number;
};

/**
 * Dojah REST client (server-only).
 * Auth: Authorization = secret key (raw, no Bearer) + AppId header.
 * Docs: https://docs.dojah.io/api-reference/individual-verification/nigeria/bvn-nin-selfie
 */
@Injectable()
export class DojahService {
  private readonly log = new Logger(DojahService.name);
  private static readonly COLLECTION_KV = 'dojah_face_collection_id';

  constructor(
    private readonly config: ConfigService,
    private readonly store: PgStore,
  ) {}

  configured() {
    return Boolean(this.appId() && this.secretKey());
  }

  baseUrl() {
    const raw =
      this.config.get<string>('DOJAH_BASE_URL')?.trim() ||
      'https://sandbox.dojah.io';
    return raw.replace(/\/$/, '');
  }

  /**
   * Basic NIN lookup (no selfie). Useful in development when face capture is skipped.
   * GET /api/v1/kyc/nin?nin=
   */
  async lookupNin(ninRaw: string): Promise<DojahNinVerifyResult> {
    this.requireConfigured();
    const nin = ninRaw.replace(/\D/g, '');
    if (!/^\d{11}$/.test(nin)) {
      throw new BadRequestException('NIN must be 11 digits.');
    }

    const json = await this.request<Record<string, unknown>>(
      'GET',
      `/api/v1/kyc/nin?nin=${encodeURIComponent(nin)}`,
    );
    const entity = (json.entity || json) as Record<string, unknown>;
    return {
      maskedNin: String(entity.nin || `*******${nin.slice(-4)}`),
      firstName: String(entity.firstname || entity.first_name || ''),
      lastName: String(entity.surname || entity.last_name || ''),
      middleName: String(entity.middlename || entity.middle_name || ''),
      gender: String(entity.gender || ''),
      birthdate: String(entity.birthdate || entity.date_of_birth || ''),
      selfie: { match: true, confidence: 100 },
      raw: entity,
    };
  }

  /**
   * NIN + face match against NIMC photo in one call.
   * POST /api/v1/kyc/nin/verify
   */
  async verifyNinWithSelfie(input: {
    nin: string;
    selfieImage: string;
    firstName?: string;
    lastName?: string;
    threshold?: number;
  }): Promise<DojahNinVerifyResult> {
    this.requireConfigured();

    const nin = input.nin.replace(/\D/g, '');
    if (!/^\d{11}$/.test(nin)) {
      throw new BadRequestException('NIN must be 11 digits.');
    }

    const selfie = stripDataUrl(input.selfieImage);
    if (!selfie || selfie.length < 80) {
      throw new BadRequestException('Selfie image is missing or too small.');
    }

    const threshold =
      typeof input.threshold === 'number'
        ? Math.min(100, Math.max(50, Math.round(input.threshold)))
        : Number(this.config.get<string>('DOJAH_FACE_THRESHOLD') || 90);

    const body: Record<string, unknown> = {
      nin,
      selfie_image: selfie,
      threshold,
    };
    if (input.firstName?.trim()) body.first_name = input.firstName.trim();
    if (input.lastName?.trim()) body.last_name = input.lastName.trim();

    const json = await this.request<Record<string, unknown>>(
      'POST',
      '/api/v1/kyc/nin/verify',
      body,
    );

    const entity = (json.entity || json) as Record<string, unknown>;
    const selfieBlock = (entity.selfie_verification ||
      entity.selfie ||
      {}) as Record<string, unknown>;
    const confidence = Number(
      selfieBlock.confidence_value ?? selfieBlock.confidence ?? 0,
    );
    const match =
      selfieBlock.match === true ||
      String(selfieBlock.match).toLowerCase() === 'true';

    return {
      maskedNin: String(entity.nin || `*******${nin.slice(-4)}`),
      firstName: String(entity.firstname || entity.first_name || ''),
      lastName: String(entity.surname || entity.last_name || ''),
      middleName: String(entity.middlename || entity.middle_name || ''),
      gender: String(entity.gender || ''),
      birthdate: String(entity.birthdate || entity.date_of_birth || ''),
      selfie: { match, confidence },
      raw: entity,
    };
  }

  /** 1:N search — detect if this face already belongs to another account. */
  async searchFace(selfieImage: string, collectionId: string) {
    this.requireConfigured();
    const selfie = stripDataUrl(selfieImage);
    const threshold = Number(
      this.config.get<string>('DOJAH_FACE_SEARCH_THRESHOLD') || 0.75,
    );

    const json = await this.request<Record<string, unknown>>(
      'POST',
      '/api/v1/face/search',
      {
        face: { image: selfie, image_type: 'base64' },
        collection_id: collectionId,
        threshold,
      },
    );

    const entity = (json.entity || json) as Record<string, unknown>;
    const hitsRaw = Array.isArray(entity.hits) ? entity.hits : [];
    const hits: DojahFaceHit[] = hitsRaw.map((row) => {
      const item = row as Record<string, unknown>;
      return {
        subjectId: String(item.subject_id || ''),
        faceId: String(item.face_id || ''),
        confidence: Number(item.confidence || 0),
      };
    });
    return hits.filter((hit) => hit.subjectId);
  }

  /** Enroll face after a successful NIN + selfie match. */
  async enrollFace(input: {
    selfieImage: string;
    subjectId: string;
    collectionId: string;
  }) {
    this.requireConfigured();
    const selfie = stripDataUrl(input.selfieImage);
    const json = await this.request<Record<string, unknown>>(
      'POST',
      '/api/v1/face/enroll',
      {
        face: { image: selfie, image_type: 'base64' },
        subject_id: input.subjectId,
        collection_id: input.collectionId,
      },
    );
    const entity = (json.entity || json) as Record<string, unknown>;
    return {
      faceId: String(entity.face_id || ''),
      subjectId: String(entity.subject_id || input.subjectId),
      collectionId: String(entity.collection_id || input.collectionId),
      deduplicated: Boolean(entity.deduplicated),
    };
  }

  /**
   * Resolve the Rapyd Ryd face collection (env → kv → create once).
   */
  async ensureFaceCollection() {
    const fromEnv = this.config.get<string>('DOJAH_FACE_COLLECTION_ID')?.trim();
    if (fromEnv) return fromEnv;

    const stored = await this.store.getKv(DojahService.COLLECTION_KV);
    if (stored) return stored;

    this.requireConfigured();
    const json = await this.request<Record<string, unknown>>(
      'POST',
      '/api/v1/face/collection',
      { name: 'Rapyd Ryd identities' },
    );
    const entity = (json.entity || json) as Record<string, unknown>;
    const id = String(entity.collection_id || '');
    if (!id) {
      throw new BadGatewayException('Dojah did not return a face collection id.');
    }
    await this.store.setKv(DojahService.COLLECTION_KV, id);
    this.log.warn(
      `Created Dojah face collection ${id}. Set DOJAH_FACE_COLLECTION_ID=${id} to pin it.`,
    );
    return id;
  }

  private requireConfigured() {
    if (!this.configured()) {
      throw new ServiceUnavailableException(
        'Dojah is not configured. Set DOJAH_APP_ID and DOJAH_SECRET_KEY.',
      );
    }
  }

  private appId() {
    return this.config.get<string>('DOJAH_APP_ID')?.trim() || '';
  }

  private secretKey() {
    return (
      this.config.get<string>('DOJAH_SECRET_KEY')?.trim() ||
      this.config.get<string>('DOJAH_PRIVATE_KEY')?.trim() ||
      ''
    );
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl()}${path}`;
    this.log.log(
      `[Dojah] → ${method} ${redactUrl(url)}${body ? ` body=${JSON.stringify(sanitizeForLog(body))}` : ''}`,
    );

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: this.secretKey(),
          AppId: this.appId(),
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      this.log.error(`Dojah network error ${method} ${path}`, error as Error);
      throw new BadGatewayException('Could not reach Dojah.');
    }

    const text = await response.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      json = { message: text };
    }

    this.log.log(
      `[Dojah] ← ${response.status} ${method} ${redactUrl(url)} response=${JSON.stringify(sanitizeForLog(json))}`,
    );

    if (!response.ok) {
      const message = dojahErrorMessage(response.status, json);
      this.log.warn(`Dojah ${response.status} ${path}: ${message}`);
      if (response.status === 400) throw new BadRequestException(message);
      if (response.status === 402) {
        throw new ServiceUnavailableException(
          'Dojah wallet needs funding before verification can run.',
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new ServiceUnavailableException(
          'Dojah rejected the API keys. Check DOJAH_APP_ID and DOJAH_SECRET_KEY (no Bearer prefix).',
        );
      }
      throw new BadGatewayException(message);
    }

    return json as T;
  }
}

/** Mask full NIN in query strings for logs. */
function redactUrl(url: string) {
  return url.replace(/([?&]nin=)\d{5}(\d{4,})/gi, '$1*****$2');
}

/** Truncate base64 blobs so logs stay readable. */
function sanitizeForLog(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeForLog);
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 120 && looksBase64(value)) {
      return `[base64 ${value.length} chars]`;
    }
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (
      /selfie|image|photo|face/i.test(key) &&
      typeof item === 'string' &&
      item.length > 80
    ) {
      out[key] = `[base64 ${item.length} chars]`;
      continue;
    }
    if (key === 'nin' && typeof item === 'string' && /^\d{11}$/.test(item)) {
      out[key] = `*******${item.slice(-4)}`;
      continue;
    }
    out[key] = sanitizeForLog(item);
  }
  return out;
}

function looksBase64(value: string) {
  return /^[A-Za-z0-9+/=\s]+$/.test(value.slice(0, 80));
}

function stripDataUrl(input: string) {
  const value = input.trim();
  const marker = ';base64,';
  const at = value.indexOf(marker);
  if (at >= 0) return value.slice(at + marker.length).replace(/\s/g, '');
  return value.replace(/\s/g, '');
}

function dojahErrorMessage(status: number, json: Record<string, unknown>) {
  const error = json.error;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  if (typeof json.message === 'string' && json.message.trim()) {
    return json.message;
  }
  return `Dojah request failed (${status}).`;
}
