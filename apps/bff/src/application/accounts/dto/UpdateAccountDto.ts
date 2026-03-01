import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsIn, IsOptional, MinLength, MaxLength } from 'class-validator';
import { AccountType } from '@my-compta/domain';

const ACCOUNT_TYPES: AccountType[] = ['bank', 'wallet', 'envelope', 'crypto', 'broker'];

export class UpdateAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name?: string;

  @ApiPropertyOptional({ enum: ACCOUNT_TYPES })
  @IsOptional()
  @IsIn(ACCOUNT_TYPES)
  type?: AccountType;
}
