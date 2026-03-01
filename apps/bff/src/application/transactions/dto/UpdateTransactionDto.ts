import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, MaxLength, IsIn } from 'class-validator';
import { Currency, TransactionType } from '@my-compta/domain';

const CURRENCIES: Currency[] = ['CHF', 'EUR', 'USD', 'GBP'];
const TX_TYPES: TransactionType[] = ['income', 'expense'];

export class UpdateTransactionDto {
  @ApiPropertyOptional({ enum: TX_TYPES })
  @IsOptional()
  @IsIn(TX_TYPES)
  type?: TransactionType;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  amount?: number;

  @ApiPropertyOptional({ enum: CURRENCIES })
  @IsOptional()
  @IsIn(CURRENCIES)
  currency?: Currency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  note?: string;
}
