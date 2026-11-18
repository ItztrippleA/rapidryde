import { Controller, Get, Query } from '@nestjs/common';
import { PlacesService } from './places.service';

@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get('autocomplete')
  autocomplete(
    @Query('input') input: string,
    @Query('sessionToken') sessionToken?: string,
    @Query('components') components?: string,
  ) {
    return this.places.autocomplete(
      input,
      sessionToken,
      components || 'country:ng',
    );
  }

  @Get('details')
  details(
    @Query('placeId') placeId: string,
    @Query('sessionToken') sessionToken?: string,
  ) {
    return this.places.details(placeId, sessionToken);
  }
}
