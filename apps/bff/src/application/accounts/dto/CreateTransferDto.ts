import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsIn, IsNumber, IsPositive } from 'class-validator';
import { Currency } from '@my-compta/domain';

const CURRENCIES: Currency[] = ['CHF', 'EUR', 'USD', 'GBP'];

export class CreateTransferDto {
  @ApiProperty({ example: 'account-id-1', description: 'Source account ID' })
  @IsString()
  fromAccountId!: string;

  @ApiProperty({ example: 'account-id-2', description: 'Destination account ID' })
  @IsString()
  toAccountId!: string;

  @ApiProperty({ example: 500 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: CURRENCIES })
  @IsIn(CURRENCIES)
  currency!: Currency;

  @ApiProperty({ example: '2026-03-01' })
  @IsString()
  date!: string;

  @ApiProperty({ example: 'Transfer to Revolut' })
  @IsString()
  label!: string;
}
