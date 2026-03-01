import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Rent & Housing' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name?: string;

  @ApiPropertyOptional({ example: '#6366f1' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a valid hex color' })
  color?: string;
}
