import { IsIn } from 'class-validator';

export class UpdateWaitlistStatusDto {
  @IsIn(['new', 'contacted', 'invited', 'archived'])
  status!: 'new' | 'contacted' | 'invited' | 'archived';
}
