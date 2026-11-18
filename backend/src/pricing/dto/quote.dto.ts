import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QuoteDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2000)
  km!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(24 * 60)
  minutes!: number;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  waitMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(10)
  surge?: number;

  @IsOptional()
  @IsBoolean()
  airport?: boolean;

  @IsOptional()
  @IsBoolean()
  night?: boolean;

  @IsOptional()
  @IsBoolean()
  rain?: boolean;

  @IsOptional()
  @IsBoolean()
  intercity?: boolean;

  @IsOptional()
  @IsString()
  promoCode?: string;
}
