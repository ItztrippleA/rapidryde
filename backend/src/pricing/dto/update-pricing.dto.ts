import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class BandDto {
  @IsString()
  id!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  upToKm!: number | null;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  perKm!: number;
}

class ClassDto {
  @IsString()
  id!: string;

  @IsString()
  label!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(10)
  multiplier!: number;
}

class OpsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxStops?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minorDetourMeters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  moderateDetourMeters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  freeWaitMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  waitWarningMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  waitGraceMinutes?: number;

  @IsOptional()
  @IsBoolean()
  waitAppliesToPickup?: boolean;

  @IsOptional()
  @IsBoolean()
  waitAppliesToStops?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  arrivalGeofenceMeters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  trafficCompMinDelayMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  trafficCompPerMinute?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  trafficCompMaxPerTrip?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trafficCompClassIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trafficCompCities?: string[];

  @IsOptional()
  @IsBoolean()
  chargePassengerForTraffic?: boolean;
}

export class UpdatePricingDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseFare?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  perKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  perMinute?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minimumFare?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bookingFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cancellationFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  waitPerMinute?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  airportMultiplier?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  nightMultiplier?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  rainMultiplier?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  intercityPerKm?: number;

  @IsOptional()
  @IsIn(['flat', 'banded'])
  distanceMode?: 'flat' | 'banded';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BandDto)
  bands?: BandDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassDto)
  classes?: ClassDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OpsDto)
  ops?: OpsDto;
}
