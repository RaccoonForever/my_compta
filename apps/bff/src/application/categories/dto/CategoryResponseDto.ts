import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryPrimitives } from '@my-compta/domain';

export class CategoryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['income', 'expense'] }) kind!: string;
  @ApiPropertyOptional() color?: string;
  @ApiProperty() isArchived!: boolean;
  @ApiProperty() createdAt!: string;

  static from(p: CategoryPrimitives): CategoryResponseDto {
    const dto = new CategoryResponseDto();
    dto.id = p.id;
    dto.name = p.name;
    dto.kind = p.kind;
    dto.color = p.color;
    dto.isArchived = p.isArchived;
    dto.createdAt = p.createdAt.toISOString();
    return dto;
  }
}
