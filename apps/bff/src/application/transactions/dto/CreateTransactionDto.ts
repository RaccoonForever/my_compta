import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsOptional,
  IsNumber,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { TransactionType } from '@my-compta/domain';
import { Currency } from '@my-compta/domain';

const TX_TYPES: TransactionType[] = ['income', 'expense', 'transfer'];
const CURRENCIES: Currency[] = ['CHF', 'EUR', 'USD', 'GBP'];

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  note?: string;
}
