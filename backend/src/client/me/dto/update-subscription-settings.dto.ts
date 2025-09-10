import { IsBoolean, IsInt, Min, IsOptional } from 'class-validator';

export class UpdateSubscriptionSettingsDto {
  @IsInt()
  @Min(0)
  useMileage!: number;

  @IsOptional()
  @IsBoolean()
  reset?: boolean;
}