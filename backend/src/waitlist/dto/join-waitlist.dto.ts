import { IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class JoinWaitlistDto {
  @IsIn(['rider', 'driver', 'passenger'])
  role!: 'rider' | 'driver' | 'passenger';

  /** Preferred: single full name from the landing form. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @ValidateIf((body: JoinWaitlistDto) => !String(body.fullName || '').trim())
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @ValidateIf((body: JoinWaitlistDto) => !String(body.fullName || '').trim())
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(20)
  phone!: string;

  /** Required for passengers / riders. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  vehicleType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  interest?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;
}
