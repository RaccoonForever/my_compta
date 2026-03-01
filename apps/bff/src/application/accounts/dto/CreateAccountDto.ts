import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsIn, IsOptional, MinLength, MaxLength, IsNumber, Min, IsDateString } from 'class-validator';
import { AccountType } from '@my-compta/domain';
import { Currency } from '@my-compta/domain';

const ACCOUNT_TYPES: AccountType[] = ['bank', 'wallet', 'envelope', 'crypto', 'broker'];
const CURRENCIES: Currency[] = ['CHF', 'EUR', 'USD', 'GBP'];

export class CreateAccountDto {
  @ApiProperty({ example: 'UBS - Main' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ enum: ACCOUNT_TYPES })
  @IsIn(ACCOUNT_TYPES)
  type!: AccountType;

  @ApiProperty({ enum: CURRENCIES })
  @IsIn(CURRENCIES)
  currency!: Currency;

  @ApiPropertyOptional({ example: 8200, description: 'Initial balance' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  balance?: number;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Account opening date (defaults to today)' })
  @IsOptional()
  @IsDateString()
  createdAt?: string;
}
