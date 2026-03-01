import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsOptional,
  IsNumber,
  IsPositive,
  IsNotEmpty,
  MaxLength,
  ValidateNested,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecurringFrequency, TransactionType, Currency } from '@my-compta/domain';

class RecurringScheduleDto {
  @ApiProperty({ enum: ['daily', 'weekly', 'monthly', 'custom'] })
  @IsIn(['daily', 'weekly', 'monthly', 'custom'])
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
}

const TX_TYPES: TransactionType[] = ['income', 'expense'];
const CURRENCIES: Currency[] = ['CHF', 'EUR', 'USD', 'GBP'];

export class CreateRecurringTemplateDto {
  @ApiProperty({ example: 'Salary' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  label!: string;

  @ApiProperty({ example: 7500 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: CURRENCIES })
  @IsIn(CURRENCIES)
  currency!: Currency;

  @ApiProperty({ enum: TX_TYPES })
  @IsIn(TX_TYPES)
  type!: TransactionType;

  @ApiProperty({ example: 'account-id' })
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ type: RecurringScheduleDto })
  @ValidateNested()
  @Type(() => RecurringScheduleDto)
  schedule!: RecurringScheduleDto;

  @ApiProperty({ example: '2026-04-01', description: 'First occurrence date' })
  @IsString()
  @IsNotEmpty()
  nextRunDate!: string;

  @ApiPropertyOptional({ example: 'Europe/Zurich' })
  @IsOptional()
  @IsString()
  tz?: string;
}
