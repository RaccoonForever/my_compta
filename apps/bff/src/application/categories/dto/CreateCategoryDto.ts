import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { CategoryKind } from '@my-compta/domain';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Housing' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ enum: ['income', 'expense'] })
  @IsIn(['income', 'expense'])
  kind!: CategoryKind;

  @ApiPropertyOptional({ example: '#6366f1', description: 'Hex color code' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a valid hex color' })
  color?: string;
}
