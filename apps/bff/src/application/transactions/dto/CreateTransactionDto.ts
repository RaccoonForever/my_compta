import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsOptional,
  IsNumber,
  IsNotEmpty,
  MaxLength,
  IsBoolean,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '@my-compta/domain';
import { Currency } from '@my-compta/domain';
import { RecurringFrequency } from '@my-compta/domain';

const TX_TYPES: TransactionType[] = ['income', 'expense'];
const CURRENCIES: Currency[] = ['CHF', 'EUR', 'USD', 'GBP'];
const RECURRING_FREQUENCIES: RecurringFrequency[] = ['daily', 'weekly', 'monthly', 'custom'];

class RecurringConfigDto {
  @ApiProperty({ enum: RECURRING_FREQUENCIES })
  @IsIn(RECURRING_FREQUENCIES)
  frequency!: RecurringFrequency;

  @ApiProperty({ example: 1, description: 'Repeat every N intervals' })
  @IsInt()
  @Min(1)
  interval!: number;

  @ApiPropertyOptional({ example: 1, description: 'Day of month (1-31) for monthly' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  byMonthDay?: number;

  @ApiPropertyOptional({ example: 1, description: 'Day of week (0=Sun) for weekly' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  byDay?: number;

  @ApiProperty({
    example: '2027-03-01',
    description: 'Inclusive end date for recurring generation (max 2 years after transaction date)',
  })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ example: 'Europe/Zurich' })
  @IsOptional()
  @IsString()
  tz?: string;
}

export class CreateTransactionDto {
  @ApiProperty({ example: 2100 })
  @IsNumber({ maxDecimalPlaces: 2 })
  amount!: number;

  @ApiProperty({ enum: CURRENCIES })
  @IsIn(CURRENCIES)
  currency!: Currency;

  @ApiProperty({ enum: TX_TYPES })
  @IsIn(TX_TYPES)
  type!: TransactionType;

  @ApiProperty({ example: '2026-03-01', description: 'ISO date string' })
  @IsString()
  @IsNotEmpty()
  date!: string;

  @ApiProperty({ example: 'account-id' })
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @ApiProperty({ example: 'Rent' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  label!: string;

  @ApiPropertyOptional({ example: 'category-id' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'Groceries' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  subcategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  note?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isForecasted?: boolean;

  @ApiPropertyOptional({ example: ['project-id-1', 'project-id-2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  projectIds?: string[];

  @ApiPropertyOptional({ type: RecurringConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecurringConfigDto)
  recurring?: RecurringConfigDto;
}
