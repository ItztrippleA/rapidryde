import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PlacesService {
  constructor(private readonly config: ConfigService) {}

  private key() {
    return (
      this.config.get<string>('GOOGLE_PLACES_API_KEY')?.trim() ||
      this.config.get<string>('GOOGLE_MAPS_API_KEY')?.trim() ||
      ''
    );
  }

  enabled() {
    return Boolean(this.key());
  }

  async autocomplete(
    input: string,
    sessionToken?: string,
    components = 'country:ng',
  ) {
    if (!input?.trim()) throw new BadRequestException('input required');
    const key = this.key();
    if (!key)
      throw new ServiceUnavailableException('GOOGLE_PLACES_API_KEY not set');

    const url = new URL(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json',
    );
    url.searchParams.set('input', input.trim());
    url.searchParams.set('key', key);
    url.searchParams.set('components', components);
    if (sessionToken) url.searchParams.set('sessiontoken', sessionToken);

    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      predictions?: unknown[];
      error_message?: string;
    };
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new BadRequestException(data.error_message || data.status);
    }
    return data;
  }

  async details(placeId: string, sessionToken?: string) {
    if (!placeId?.trim()) throw new BadRequestException('placeId required');
    const key = this.key();
    if (!key)
      throw new ServiceUnavailableException('GOOGLE_PLACES_API_KEY not set');

    const url = new URL(
      'https://maps.googleapis.com/maps/api/place/details/json',
    );
    url.searchParams.set('place_id', placeId.trim());
    url.searchParams.set('fields', 'place_id,formatted_address,geometry,name');
    url.searchParams.set('key', key);
    if (sessionToken) url.searchParams.set('sessiontoken', sessionToken);

    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      result?: unknown;
      error_message?: string;
    };
    if (data.status !== 'OK') {
      throw new BadRequestException(data.error_message || data.status);
    }
    return data;
  }
}
