import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { Currency, SUPPORTED_CURRENCIES } from '@my-compta/domain';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES })
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  baseCurrency?: Currency;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { EUR: 0.93, USD: 0.91 },
  })
  @IsOptional()
  @IsObject()
  fxRates?: Record<string, number>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  privacyMode?: boolean;
}
