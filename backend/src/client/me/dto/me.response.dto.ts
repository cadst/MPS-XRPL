// me.response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class CompanyDto {
  @ApiProperty() @Expose() id!: number;
  @ApiProperty() @Expose() name!: string;
  @ApiProperty({ enum: ['Free','Standard','Business'] }) @Expose() grade!: 'Free'|'Standard'|'Business';
  @ApiProperty({ nullable: true, required: false }) @Expose() profile_image_url?: string|null;
  @ApiProperty({ nullable: true, required: false }) @Expose() smart_account_address?: string|null;
  @ApiProperty() @Expose() total_rewards_earned!: number;
  @ApiProperty() @Expose() total_rewards_used!: number;
  @ApiProperty() @Expose() reward_balance!: number;
}

export class SubscriptionDto {
  @ApiProperty({ enum: ['free','standard','business'] }) @Expose() plan!: 'free'|'standard'|'business';
  @ApiProperty({ enum: ['active','none'] }) @Expose() status!: 'active'|'none';
  @ApiProperty({ nullable: true, required: false }) @Expose() start_date?: string|null;
  @ApiProperty({ nullable: true, required: false }) @Expose() end_date?: string|null;
  @ApiProperty({ nullable: true, required: false }) @Expose() next_billing_at?: string|null;
  @ApiProperty({ nullable: true }) @Expose() remaining_days!: number|null;
}

export class ApiKeyPreviewDto {
  @ApiProperty({ nullable: true }) @Expose() last4!: string|null;
}

export class UsingSummaryDto {
  @ApiProperty() @Expose() using_count!: number;
}

export class UsingItemDto {
  @ApiProperty() @Expose() id!: number;
  @ApiProperty() @Expose() title!: string;
  @ApiProperty({ required: false, nullable: true }) @Expose() artist?: string|null;
  @ApiProperty({ required: false, nullable: true }) @Expose() cover?: string|null;
  @ApiProperty({ required: false, nullable: true }) @Expose() lastUsedAt?: string|null;
  @ApiProperty({ required: false }) @Expose() leadersEarned?: number;
}

export class MeResponseDto {
  @ApiProperty({ type: CompanyDto, nullable: true })
  @Type(() => CompanyDto) @Expose() company!: CompanyDto|null;

  @ApiProperty({ type: SubscriptionDto })
  @Type(() => SubscriptionDto) @Expose() subscription!: SubscriptionDto;

  @ApiProperty({ type: ApiKeyPreviewDto })
  @Type(() => ApiKeyPreviewDto) @Expose() api_key!: ApiKeyPreviewDto;

  @ApiProperty({ type: UsingSummaryDto })
  @Type(() => UsingSummaryDto) @Expose() using_summary!: UsingSummaryDto;

  @ApiProperty({ type: [UsingItemDto] })
  @Type(() => UsingItemDto) @Expose() using_list!: UsingItemDto[];
}
